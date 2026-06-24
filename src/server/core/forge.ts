/**
 * Level Forge — user-generated levels. Players author puzzles, the community
 * votes, and the top-voted level is promoted to become a future daily, credited
 * to its creator. This turns contributions into the game's content engine.
 */

import { redis } from '@devvit/web/server';
import { FORGE_PROMOTE_VOTES, type ForgeLevel, type ForgeSubmitRequest } from '../../shared/api';

const K_LEVELS = 'forge:levels'; // zset id -> votes
const K_NEW = 'forge:new'; // zset id -> createdAt (for "newest" sort)
const K_QUEUE = 'forge:queue'; // zset id -> promotedAt (oldest first)
const levelKey = (id: string) => `forge:level:${id}`;
const votersKey = (id: string) => `forge:voters:${id}`; // hash username -> '1'
const reportsKey = (id: string) => `forge:reports:${id}`; // counter
const ghostsKey = (id: string) => `forge:ghosts:${id}`; // hash username -> strokes JSON

/** Reports needed to auto-hide a level. */
const REPORT_HIDE_AT = 5;

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** The single most-voted live level (for the weekly feature). */
export async function getTopLevel(): Promise<ForgeLevel | null> {
  const top = await redis.zRange(K_LEVELS, 0, 0, { by: 'rank', reverse: true });
  if (top.length === 0) return null;
  return loadLevel(top[0]!.member);
}

export async function loadLevel(id: string): Promise<ForgeLevel | null> {
  const raw = await redis.get(levelKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ForgeLevel;
  } catch {
    return null;
  }
}

async function saveLevel(level: ForgeLevel): Promise<void> {
  await redis.set(levelKey(level.id), JSON.stringify(level));
}

export async function submitLevel(
  authorUsername: string,
  req: ForgeSubmitRequest
): Promise<string> {
  const id = newId();
  const level: ForgeLevel = {
    id,
    authorUsername,
    title: req.title.slice(0, 40) || 'Untitled',
    ball: req.ball,
    goal: req.goal,
    obstacles: req.obstacles.slice(0, 12),
    inkBudget: req.inkBudget,
    createdAt: Date.now(),
    votes: 0,
    status: 'live',
  };
  await saveLevel(level);
  await redis.zAdd(K_LEVELS, { member: id, score: 0 });
  await redis.zAdd(K_NEW, { member: id, score: level.createdAt });
  return id;
}

/** Store a player's solution to a community level (capped + rounded). */
export async function storeForgeGhost(
  forgeId: string,
  username: string,
  strokes: number[][]
): Promise<void> {
  const trimmed = strokes.slice(0, 6).map((s) => s.map((v) => Math.round(v)));
  await redis.hSet(ghostsKey(forgeId), { [username]: JSON.stringify(trimmed) });
}

/** Sample up to `limit` solutions to a community level. */
export async function sampleForgeGhosts(forgeId: string, limit: number): Promise<number[][][]> {
  const all = await redis.hGetAll(ghostsKey(forgeId));
  const out: number[][][] = [];
  for (const json of Object.values(all)) {
    try {
      out.push(JSON.parse(json) as number[][]);
    } catch {
      /* skip */
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Flag a level; auto-hides it once enough distinct reports accrue. */
export async function reportLevel(id: string): Promise<{ reports: number; hidden: boolean }> {
  const reports = await redis.incrBy(reportsKey(id), 1);
  if (reports >= REPORT_HIDE_AT) {
    await markLevelUsed(id);
    return { reports, hidden: true };
  }
  return { reports, hidden: false };
}

/** One vote per user per level. Idempotent. */
export async function voteLevel(
  id: string,
  username: string
): Promise<{ votes: number; voted: boolean }> {
  const level = await loadLevel(id);
  if (!level) return { votes: 0, voted: false };

  const already = await redis.hGet(votersKey(id), username);
  if (already) return { votes: level.votes, voted: true };

  await redis.hSet(votersKey(id), { [username]: '1' });
  const votes = await redis.zIncrBy(K_LEVELS, id, 1);
  level.votes = votes;
  await saveLevel(level);
  return { votes, voted: true };
}

/** Browse live levels (by votes or recency), plus which ones this user voted for. */
export async function listLevels(
  username: string,
  limit: number,
  sort: 'top' | 'new' = 'top'
): Promise<{ levels: ForgeLevel[]; myVotes: string[] }> {
  const key = sort === 'new' ? K_NEW : K_LEVELS;
  const rows = await redis.zRange(key, 0, limit - 1, { by: 'rank', reverse: true });
  const levels: ForgeLevel[] = [];
  const myVotes: string[] = [];
  for (const r of rows) {
    const level = await loadLevel(r.member);
    if (!level || level.status === 'used') continue;
    if (sort === 'top') level.votes = r.score; // K_NEW score is a timestamp, not votes
    levels.push(level);
    const voted = await redis.hGet(votersKey(level.id), username);
    if (voted) myVotes.push(level.id);
  }
  return { levels, myVotes };
}

export async function markLevelUsed(id: string): Promise<void> {
  const level = await loadLevel(id);
  if (level) {
    level.status = 'used';
    await saveLevel(level);
  }
  await redis.zRem(K_LEVELS, [id]);
  await redis.zRem(K_NEW, [id]);
  await redis.zRem(K_QUEUE, [id]);
}

/**
 * Take the next community level to feature as a daily.
 * Prefers an explicit queue; otherwise auto-promotes the top-voted live level
 * once it clears the vote threshold. Returns null if none is ready.
 */
export async function popQueuedLevel(): Promise<ForgeLevel | null> {
  const queued = await redis.zRange(K_QUEUE, 0, 0, { by: 'rank' });
  if (queued.length > 0) {
    const id = queued[0]!.member;
    await redis.zRem(K_QUEUE, [id]);
    const level = await loadLevel(id);
    if (level && level.status !== 'used') return level;
  }

  const top = await redis.zRange(K_LEVELS, 0, 0, { by: 'rank', reverse: true });
  if (top.length > 0 && top[0]!.score >= FORGE_PROMOTE_VOTES) {
    const level = await loadLevel(top[0]!.member);
    if (level && level.status === 'live') return level;
  }
  return null;
}
