/**
 * Personal campaign progression  each player advances through the 1..50 level
 * curve at their own pace. Progress is server-side so it follows the user across
 * devices. Levels can only be cleared in sequence (you can't jump to 50), which
 * is enough anti-skip protection for a solo track.
 */

import { redis } from '@devvit/web/server';
import { CAMPAIGN_LEVELS } from '../../shared/api';

const furthestKey = (u: string) => `campaign:${u}`;
const starsKey = (u: string) => `campaignStars:${u}`; // hash level -> stars

export async function getFurthest(username: string): Promise<number> {
  const v = await redis.get(furthestKey(username));
  return v ? parseInt(v, 10) : 0;
}

export async function getStars(username: string): Promise<Record<string, number>> {
  const h = await redis.hGetAll(starsKey(username));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(h)) out[k] = parseInt(v, 10);
  return out;
}

/** Record a clear. Advances the frontier by at most one (sequential), stores best stars. */
export async function clearLevel(
  username: string,
  level: number,
  stars: number
): Promise<number> {
  const lvl = Math.max(1, Math.min(CAMPAIGN_LEVELS, Math.floor(level)));
  const furthest = await getFurthest(username);

  if (lvl <= furthest + 1) {
    const next = Math.max(furthest, lvl);
    await redis.set(furthestKey(username), String(next));
  }

  // store best stars for the grid
  const prev = parseInt((await redis.hGet(starsKey(username), String(lvl))) ?? '0', 10);
  const best = Math.max(prev, Math.max(1, Math.min(3, Math.floor(stars))));
  if (best !== prev) await redis.hSet(starsKey(username), { [String(lvl)]: String(best) });

  return getFurthest(username);
}
