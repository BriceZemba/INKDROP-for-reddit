/**
 * Scoring, leaderboard, ghost storage, and streaks — all backed by Redis.
 * Lower ink is better, so sorted-set rank 0 == best solution of the day.
 */

import { redis } from '@devvit/web/server';
import type { RankRow, Streak } from '../../shared/api';

const solvedKey = (dayId: string) => `solved:${dayId}`; // zset username -> inkUsed
const ghostsKey = (dayId: string) => `ghosts:${dayId}`; // hash username -> JSON {inkUsed, strokes}
const streakKey = (username: string) => `streak:${username}`; // hash
const weekKey = (week: number) => `wsolved:${week}`; // zset username -> days solved this week
const K_ALLTIME = 'allsolves'; // zset username -> total days solved

export function weekOf(dayNumber: number): number {
  return Math.floor((dayNumber - 1) / 7);
}

const MAX_GHOST_POINTS = 48; // cap stored stroke detail to keep memory small
const DAY_TTL_SEC = 70 * 24 * 60 * 60; // expire per-day boards after ~10 weeks

/** Downsample a flattened stroke to at most n points to bound storage. */
function downsample(flat: number[], maxPoints: number): number[] {
  const pts = flat.length / 2;
  if (pts <= maxPoints) return flat.map((v) => Math.round(v));
  const out: number[] = [];
  const step = (pts - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step) * 2;
    out.push(Math.round(flat[idx]!), Math.round(flat[idx + 1]!));
  }
  return out;
}

export type SolveOutcome = {
  improved: boolean;
  firstSolve: boolean;
  bestInk: number;
  rank: number;
  total: number;
  percentile: number; // % of solvers you used less ink than
};

/** Record a successful solution; only overwrites if it beats the prior best. */
export async function recordSolve(
  dayId: string,
  username: string,
  inkUsed: number,
  strokes: number[][]
): Promise<SolveOutcome> {
  const prior = await redis.zScore(solvedKey(dayId), username);
  const firstSolve = prior === undefined;
  const improved = firstSolve || inkUsed < prior!;

  if (improved) {
    await redis.zAdd(solvedKey(dayId), { member: username, score: inkUsed });
    const trimmed = strokes.slice(0, 6).map((s) => downsample(s, MAX_GHOST_POINTS));
    await redis.hSet(ghostsKey(dayId), {
      [username]: JSON.stringify({ inkUsed, strokes: trimmed }),
    });
    await redis.expire(solvedKey(dayId), DAY_TTL_SEC);
    await redis.expire(ghostsKey(dayId), DAY_TTL_SEC);
  }

  const bestInk = improved ? inkUsed : prior!;
  const rank = (await redis.zRank(solvedKey(dayId), username)) ?? 0;
  const total = await redis.zCard(solvedKey(dayId));
  const percentile =
    total <= 1 ? 100 : Math.round(((total - (rank + 1)) / total) * 100);

  return { improved, firstSolve, bestInk, rank, total, percentile };
}

/** Top N solvers for a day (lowest ink first). */
export async function leaderboard(dayId: string, limit: number): Promise<RankRow[]> {
  const rows = await redis.zRange(solvedKey(dayId), 0, limit - 1, { by: 'rank' });
  return rows.map((r, i) => ({ username: r.member, score: r.score, rank: i + 1 }));
}

/** Record a day solved toward the weekly + all-time consistency boards. */
export async function recordDailyProgress(username: string, dayNumber: number): Promise<void> {
  await Promise.all([
    redis.zIncrBy(weekKey(weekOf(dayNumber)), username, 1),
    redis.zIncrBy(K_ALLTIME, username, 1),
  ]);
}

/** A descending (higher = better) leaderboard with the caller's standing. */
async function descBoard(
  key: string,
  username: string,
  limit: number
): Promise<{ rows: RankRow[]; total: number; myRank: number | null; myScore: number | null }> {
  const raw = await redis.zRange(key, 0, limit - 1, { by: 'rank', reverse: true });
  const rows = raw.map((r, i) => ({ username: r.member, score: r.score, rank: i + 1 }));
  const total = await redis.zCard(key);
  const myScore = await redis.zScore(key, username);
  let myRank: number | null = null;
  if (myScore !== undefined) {
    const ascRank = (await redis.zRank(key, username)) ?? 0;
    myRank = total - ascRank; // convert ascending index to descending rank
  }
  return { rows, total, myRank, myScore: myScore ?? null };
}

export function weeklyBoard(dayNumber: number, username: string, limit: number) {
  return descBoard(weekKey(weekOf(dayNumber)), username, limit);
}

export function alltimeBoard(username: string, limit: number) {
  return descBoard(K_ALLTIME, username, limit);
}

export async function solvedCount(dayId: string): Promise<number> {
  return redis.zCard(solvedKey(dayId));
}

/** Bucket the day's ink scores into a small histogram. */
export async function inkDistribution(
  dayId: string,
  bins = 10
): Promise<{ counts: number[]; binMin: number; binSize: number; total: number }> {
  const rows = await redis.zRange(solvedKey(dayId), 0, 999, { by: 'rank' });
  if (rows.length === 0) return { counts: [], binMin: 0, binSize: 0, total: 0 };
  const scores = rows.map((r) => r.score);
  const min = scores[0]!;
  const max = scores[scores.length - 1]!;
  const binSize = Math.max(1, (max - min) / bins);
  const counts = new Array<number>(bins).fill(0);
  for (const s of scores) {
    const idx = Math.min(bins - 1, Math.floor((s - min) / binSize));
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return { counts, binMin: min, binSize, total: scores.length };
}

export async function myStanding(
  dayId: string,
  username: string
): Promise<{ bestInk: number | null; rank: number | null; percentile: number | null }> {
  const score = await redis.zScore(solvedKey(dayId), username);
  if (score === undefined) return { bestInk: null, rank: null, percentile: null };
  const rank = (await redis.zRank(solvedKey(dayId), username)) ?? 0;
  const total = await redis.zCard(solvedKey(dayId));
  const percentile = total <= 1 ? 100 : Math.round(((total - (rank + 1)) / total) * 100);
  return { bestInk: score, rank: rank + 1, percentile };
}

/** Sample up to `limit` ghost solutions spread across the skill range. */
export async function sampleGhosts(
  dayId: string,
  limit: number
): Promise<{ username: string; inkUsed: number; strokes: number[][] }[]> {
  const all = await redis.hGetAll(ghostsKey(dayId));
  const parsed = Object.entries(all)
    .map(([username, json]) => {
      try {
        const v = JSON.parse(json) as { inkUsed: number; strokes: number[][] };
        return { username, inkUsed: v.inkUsed, strokes: v.strokes };
      } catch {
        return null;
      }
    })
    .filter((v): v is { username: string; inkUsed: number; strokes: number[][] } => v !== null)
    .sort((a, b) => a.inkUsed - b.inkUsed);

  if (parsed.length <= limit) return parsed;
  // Evenly sample across the sorted range so replays show variety.
  const out: typeof parsed = [];
  const step = (parsed.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i++) out.push(parsed[Math.round(i * step)]!);
  return out;
}

/* --------------------------------- Streaks --------------------------------- */

export async function getStreak(username: string): Promise<Streak> {
  const h = await redis.hGetAll(streakKey(username));
  return {
    current: h.current ? parseInt(h.current, 10) : 0,
    best: h.best ? parseInt(h.best, 10) : 0,
  };
}

/** Max streak-freeze tokens a player can bank. */
const MAX_FREEZE = 3;

/**
 * Bump the streak when a user solves the *current* day for the first time.
 * Consecutive days extend it; a single missed day is forgiven if the player has a
 * streak-freeze token; a bigger gap resets to 1. Tokens are earned every 5 days.
 */
export async function bumpStreak(username: string, dayNumber: number): Promise<Streak> {
  const h = await redis.hGetAll(streakKey(username));
  const lastDay = h.lastDayNumber ? parseInt(h.lastDayNumber, 10) : 0;
  let current = h.current ? parseInt(h.current, 10) : 0;
  let best = h.best ? parseInt(h.best, 10) : 0;
  let freeze = h.freeze ? parseInt(h.freeze, 10) : 0;

  const gap = dayNumber - lastDay;
  if (lastDay === dayNumber) {
    // already counted today; no change
  } else if (gap === 1) {
    current += 1;
  } else if (gap === 2 && freeze > 0) {
    current += 1;
    freeze -= 1; // a token covers the single missed day
  } else {
    current = 1;
  }

  // award a freeze token each time the streak passes a new multiple of 5
  if (lastDay !== dayNumber && current > 0 && current % 5 === 0) {
    freeze = Math.min(MAX_FREEZE, freeze + 1);
  }
  best = Math.max(best, current);

  await redis.hSet(streakKey(username), {
    current: String(current),
    best: String(best),
    lastDayNumber: String(dayNumber),
    freeze: String(freeze),
  });
  return { current, best };
}
