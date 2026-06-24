/** Tiny fixed-window rate limiter backed by Redis (incr + expire). */

import { redis } from '@devvit/web/server';

/** Returns true if the action is allowed; false once the window budget is spent. */
export async function allow(bucket: string, max: number, windowSec: number): Promise<boolean> {
  const key = `rl:${bucket}`;
  const n = await redis.incrBy(key, 1);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= max;
}
