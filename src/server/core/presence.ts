/**
 * Lightweight live presence: each client heartbeats while on a puzzle. We keep a
 * sorted set of userId -> last-seen timestamp per post and count members seen
 * within a short window. The count is also broadcast over realtime so other
 * players' labels update between their own heartbeats.
 */

import { redis, realtime } from '@devvit/web/server';

const key = (postId: string) => `presence:${postId}`;
export const presenceChannel = (postId: string) => `presence:${postId}`;

const WINDOW_MS = 12_000; // counted as "present" if seen within this window
const STALE_MS = 60_000; // prune entries older than this

async function activeCount(postId: string, now: number): Promise<number> {
  const active = await redis.zRange(key(postId), now - WINDOW_MS, now + 1000, { by: 'score' });
  return active.length;
}

/** Record a heartbeat for the user, prune stragglers, broadcast + return the count. */
export async function heartbeat(postId: string, userId: string): Promise<number> {
  const now = Date.now();
  await redis.zAdd(key(postId), { member: userId, score: now });
  await redis.expire(key(postId), 300); // presence is ephemeral

  const stale = await redis.zRange(key(postId), 0, now - STALE_MS, { by: 'score' });
  if (stale.length) await redis.zRem(key(postId), stale.map((s) => s.member));

  const count = await activeCount(postId, now);
  try {
    await realtime.send(presenceChannel(postId), { count });
  } catch {
    /* realtime optional — count still returned */
  }
  return count;
}

/** Read-only count (for viewers who can't heartbeat, e.g. logged out). */
export async function readPresence(postId: string): Promise<number> {
  return activeCount(postId, Date.now());
}
