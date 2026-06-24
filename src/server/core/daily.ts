/**
 * Daily lifecycle: which scene is live, day numbering per-community, and the
 * rollover that posts a fresh puzzle each day.
 *
 * Each community starts at "Day 1" on the day it installs the app (epoch), but
 * the puzzle for a given day number is the same everywhere, so the whole platform
 * shares an identical daily challenge sequence.
 */

import { redis, reddit, context } from '@devvit/web/server';
import type { JsonObject } from '@devvit/web/shared';
import { type Scene, type ForgeLevel } from '../../shared/api';
import { generateScene } from '../../shared/scenes';
import { loadLevel, popQueuedLevel, markLevelUsed, getTopLevel } from './forge';
import { leaderboard, solvedCount } from './ranking';

const DAY_MS = 86_400_000;
const DAY_TTL_SEC = 70 * 24 * 60 * 60; // keep per-day data ~10 weeks then expire

const K_EPOCH = 'app:epochMs';
const K_LAST_POSTED = 'daily:lastPostedDayId';
const sceneMetaKey = (dayId: string) => `scene:meta:${dayId}`;
const postIdKey = (dayId: string) => `daily:postId:${dayId}`;
const K_DAYS = 'archive:days'; // zset dayId -> dayNumber

/** What we stamp on every post so it knows which scene to render. */
export type PostMeta = {
  dayId: string;
  dayNumber: number;
  forgeId?: string;
};

function midnightUtc(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** First-install epoch (UTC midnight). Created lazily on first read. */
async function getEpochMs(): Promise<number> {
  const raw = await redis.get(K_EPOCH);
  if (raw) return parseInt(raw, 10);
  const epoch = midnightUtc(Date.now());
  await redis.set(K_EPOCH, String(epoch));
  return epoch;
}

export function dayIdOf(ms: number): string {
  return new Date(midnightUtc(ms)).toISOString().slice(0, 10);
}

export async function currentDayId(): Promise<string> {
  return dayIdOf(Date.now());
}

/** Day number for a given dayId, measured from this community's install epoch. */
export async function dayNumberForDayId(dayId: string): Promise<number> {
  const epoch = await getEpochMs();
  const ms = Date.parse(dayId + 'T00:00:00Z');
  return Math.max(1, Math.floor((ms - epoch) / DAY_MS) + 1);
}

export async function currentDayNumber(): Promise<number> {
  return dayNumberForDayId(await currentDayId());
}

/** Build a Scene from a community-authored level for a given day. */
function sceneFromForge(level: ForgeLevel, dayNumber: number, dayId: string): Scene {
  const dist = Math.hypot(level.goal.x - level.ball.x, level.goal.y - level.ball.y);
  return {
    dayId,
    dayNumber,
    seed: 0,
    ball: level.ball,
    goal: level.goal,
    obstacles: level.obstacles,
    inkBudget: level.inkBudget,
    par: Math.round(dist * 1.05),
    title: level.title,
    authorUsername: level.authorUsername,
    forgeId: level.id,
  };
}

/** Resolve the scene a post should show, from its stamped metadata. */
export async function resolveScene(meta: PostMeta): Promise<Scene> {
  // Prefer the stored, fully-resolved scene (covers Forge levels + any tuning).
  const stored = await redis.get(sceneMetaKey(meta.dayId));
  if (stored) {
    try {
      return JSON.parse(stored) as Scene;
    } catch {
      /* fall through to regeneration */
    }
  }
  if (meta.forgeId) {
    const level = await loadLevel(meta.forgeId);
    if (level) return sceneFromForge(level, meta.dayNumber, meta.dayId);
  }
  return generateScene(meta.dayNumber, meta.dayId);
}

/** Read the current post's stamped metadata (set at creation time). */
export function postMetaFromContext(): PostMeta | null {
  const data = context.postData as (JsonObject & Partial<PostMeta>) | undefined;
  if (!data || typeof data.dayId !== 'string' || typeof data.dayNumber !== 'number') {
    return null;
  }
  return {
    dayId: data.dayId,
    dayNumber: data.dayNumber,
    forgeId: typeof data.forgeId === 'string' ? data.forgeId : undefined,
  };
}

/**
 * Create a puzzle post for a given day. Resolves the scene (queued Forge level
 * first, else the generated daily), stores it, and stamps the post.
 * Returns the new post id, or null on failure.
 */
export async function postDailyFor(dayNumber: number, dayId: string): Promise<string | null> {
  // A community-promoted level takes priority and becomes today's puzzle.
  const queued = await popQueuedLevel();
  let scene: Scene;
  if (queued) {
    scene = sceneFromForge(queued, dayNumber, dayId);
    await markLevelUsed(queued.id);
  } else {
    scene = generateScene(dayNumber, dayId);
  }

  await redis.set(sceneMetaKey(dayId), JSON.stringify(scene));
  await redis.expire(sceneMetaKey(dayId), DAY_TTL_SEC);
  await redis.zAdd(K_DAYS, { member: dayId, score: dayNumber });

  const titleAuthor = scene.authorUsername ? ` — by u/${scene.authorUsername}` : '';
  const meta: PostMeta = { dayId, dayNumber, forgeId: scene.forgeId };

  try {
    const post = await reddit.submitCustomPost({
      title: `INKDROP — Day ${dayNumber}: "${scene.title}"${titleAuthor}`,
      entry: 'default',
      postData: meta as unknown as JsonObject,
    });
    await redis.set(K_LAST_POSTED, dayId);
    await redis.set(postIdKey(dayId), post.id);
    await redis.expire(postIdKey(dayId), DAY_TTL_SEC);

    // Post flair (Reddit-y). Harmless if the subreddit hasn't enabled flair.
    try {
      await reddit.setPostFlair({
        subredditName: context.subredditName,
        postId: post.id,
        text: scene.authorUsername ? 'Community Level' : 'Daily Puzzle',
        backgroundColor: scene.authorUsername ? '#3b82c4' : '#e2574c',
        textColor: 'light',
      });
    } catch {
      /* flair not configured — ignore */
    }
    return post.id;
  } catch (err) {
    console.error('postDailyFor failed:', err);
    return null;
  }
}

/** Past daily puzzles (newest first) for practice replay, excluding today. */
export async function listArchive(limit: number): Promise<Scene[]> {
  const todayId = await currentDayId();
  const rows = await redis.zRange(K_DAYS, 0, limit, { by: 'rank', reverse: true });
  const out: Scene[] = [];
  for (const r of rows) {
    if (r.member === todayId) continue;
    const raw = await redis.get(sceneMetaKey(r.member));
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as Scene);
    } catch {
      /* skip */
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Celebrate the week's top community level with its own post (Reddit-y / UGC). */
export async function postFeaturedLevel(): Promise<void> {
  const lvl = await getTopLevel();
  if (!lvl || lvl.votes < 1) return;
  const text = [
    `🏆 **Featured Level of the Week**`,
    '',
    `**“${lvl.title}”** by u/${lvl.authorUsername} — ${lvl.votes} community votes.`,
    '',
    `Forge your own puzzle in the app and rally votes to be featured next week — top levels also become a daily!`,
  ].join('\n');
  try {
    await reddit.submitPost({
      subredditName: context.subredditName,
      title: `🏆 INKDROP — Featured Level: “${lvl.title}” by u/${lvl.authorUsername}`,
      text,
    });
  } catch (err) {
    console.error('postFeaturedLevel failed:', err);
  }
}

/** Post a "yesterday's top solvers" recap comment on a given day's post (Reddit-y). */
export async function postRecapComment(dayId: string): Promise<void> {
  const postId = await redis.get(postIdKey(dayId));
  if (!postId) return;
  const [rows, total] = await Promise.all([leaderboard(dayId, 5), solvedCount(dayId)]);
  if (total === 0) return;

  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
  const lines = rows.map(
    (r, i) => `${medals[i] ?? '•'} u/${r.username} — ${r.score} ink`
  );
  const text = [
    `**INKDROP recap** ✒️ ${total} redditor${total === 1 ? '' : 's'} solved this one.`,
    '',
    'Lowest ink wins:',
    ...lines,
    '',
    'A fresh puzzle just dropped — keep your streak alive! 🔥',
  ].join('\n');

  try {
    await reddit.submitComment({ id: postId as `t3_${string}`, text });
  } catch (err) {
    console.error('postRecapComment failed:', err);
  }
}

export async function getLastPostedDayId(): Promise<string | null> {
  return (await redis.get(K_LAST_POSTED)) ?? null;
}

/** Ensure today's post exists; returns the post id if one was created. */
export async function ensureTodayPosted(): Promise<string | null> {
  const dayId = await currentDayId();
  const last = await redis.get(K_LAST_POSTED);
  if (last === dayId) return null; // already posted today
  const dayNumber = await currentDayNumber();
  return postDailyFor(dayNumber, dayId);
}

/** Force the next day's puzzle (used by the mod "advance day" test menu item). */
export async function forceNextDay(): Promise<string | null> {
  // Synthetic dayId one day past the last posted day, so repeated testing advances.
  const last = await redis.get(K_LAST_POSTED);
  const baseMs = last ? Date.parse(last + 'T00:00:00Z') : midnightUtc(Date.now());
  const dayId = dayIdOf(baseMs + DAY_MS);
  const dayNumber = await dayNumberForDayId(dayId);
  return postDailyFor(dayNumber, dayId);
}
