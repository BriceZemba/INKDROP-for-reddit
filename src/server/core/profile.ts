/**
 * Player profile: achievements earned, total solves, cosmetics unlocked/equipped,
 * and the logic that grants rewards when a puzzle is solved.
 */

import { redis } from '@devvit/web/server';
import {
  DEFAULT_EQUIP,
  cosmeticById,
  unlockedCosmetics,
  type CosmeticKind,
} from '../../shared/cosmetics';
import type { EquippedCosmetics } from '../../shared/api';

const achKey = (u: string) => `ach:${u}`;
const equipKey = (u: string) => `equip:${u}`;
const solvesKey = (u: string) => `solves:${u}`;
const streakKey = (u: string) => `streak:${u}`;

export async function getAchievements(username: string): Promise<string[]> {
  const h = await redis.hGetAll(achKey(username));
  return Object.keys(h);
}

export async function getSolves(username: string): Promise<number> {
  const v = await redis.get(solvesKey(username));
  return v ? parseInt(v, 10) : 0;
}

async function incrSolves(username: string): Promise<number> {
  return redis.incrBy(solvesKey(username), 1);
}

async function getStreakBest(username: string): Promise<number> {
  const v = await redis.hGet(streakKey(username), 'best');
  return v ? parseInt(v, 10) : 0;
}

export async function getFreezeTokens(username: string): Promise<number> {
  const v = await redis.hGet(streakKey(username), 'freeze');
  return v ? parseInt(v, 10) : 0;
}

/** Grant achievement ids; returns those that were newly earned. */
export async function grant(username: string, ids: string[]): Promise<string[]> {
  const have = new Set(await getAchievements(username));
  const fresh = ids.filter((id) => !have.has(id));
  if (fresh.length) {
    const obj: Record<string, string> = {};
    for (const id of fresh) obj[id] = '1';
    await redis.hSet(achKey(username), obj);
  }
  return fresh;
}

export async function getEquipped(username: string): Promise<EquippedCosmetics> {
  const h = await redis.hGetAll(equipKey(username));
  return {
    ink: h.ink || DEFAULT_EQUIP.ink,
    ball: h.ball || DEFAULT_EQUIP.ball,
    trail: h.trail || DEFAULT_EQUIP.trail,
  };
}

export async function getUnlocked(username: string): Promise<string[]> {
  const [achievements, solves, streakBest] = await Promise.all([
    getAchievements(username),
    getSolves(username),
    getStreakBest(username),
  ]);
  return unlockedCosmetics({ streakBest, solves, achievements });
}

/** Equip a cosmetic if the player owns it. Returns the new loadout, or null if not allowed. */
export async function equipCosmetic(
  username: string,
  kind: CosmeticKind,
  id: string
): Promise<EquippedCosmetics | null> {
  const c = cosmeticById(id);
  if (!c || c.kind !== kind) return null;
  const unlocked = new Set(await getUnlocked(username));
  if (!unlocked.has(id)) return null;
  await redis.hSet(equipKey(username), { [kind]: id });
  return getEquipped(username);
}

export type SolveEval = {
  firstSolve: boolean;
  stars: number;
  percentile: number;
  streakCurrent: number;
  streakBest: number;
  strokeCount: number;
};

/** Grant achievements + cosmetics earned by a solve; returns the newly unlocked ids. */
export async function evaluateOnSolve(
  username: string,
  p: SolveEval
): Promise<{ newAchievements: string[]; newCosmetics: string[] }> {
  const ach0 = await getAchievements(username);
  const solves0 = await getSolves(username);
  const before = new Set(
    unlockedCosmetics({ streakBest: p.streakBest, solves: solves0, achievements: ach0 })
  );

  // count distinct days solved
  const solves1 = p.firstSolve ? await incrSolves(username) : solves0;

  const want: string[] = ['first-solve'];
  if (p.stars >= 3) want.push('three-star');
  if (p.strokeCount === 1) want.push('one-stroke');
  if (p.streakCurrent >= 3) want.push('streak-3');
  if (p.streakCurrent >= 7) want.push('streak-7');
  if (p.percentile >= 90) want.push('top-10');
  if (solves1 >= 10) want.push('solves-10');

  const newAchievements = await grant(username, want);
  const ach1 = [...ach0, ...newAchievements];
  const after = new Set(
    unlockedCosmetics({ streakBest: p.streakBest, solves: solves1, achievements: ach1 })
  );
  const newCosmetics = [...after].filter((id) => !before.has(id));
  return { newAchievements, newCosmetics };
}
