import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from './stubs/devvit-server';
import {
  evaluateOnSolve,
  getSolves,
  getEquipped,
  equipCosmetic,
} from '../src/server/core/profile';

describe('profile core', () => {
  beforeEach(() => __reset());

  it('grants first-solve and counts a distinct solve', async () => {
    const r = await evaluateOnSolve('alice', {
      firstSolve: true,
      stars: 2,
      percentile: 50,
      streakCurrent: 1,
      streakBest: 1,
      strokeCount: 2,
    });
    expect(r.newAchievements).toContain('first-solve');
    expect(await getSolves('alice')).toBe(1);
  });

  it('grants three-star, one-stroke, streak and top-10 when earned', async () => {
    const r = await evaluateOnSolve('alice', {
      firstSolve: true,
      stars: 3,
      percentile: 95,
      streakCurrent: 3,
      streakBest: 3,
      strokeCount: 1,
    });
    for (const a of ['first-solve', 'three-star', 'one-stroke', 'streak-3', 'top-10']) {
      expect(r.newAchievements).toContain(a);
    }
  });

  it('defaults the loadout and only equips unlocked cosmetics', async () => {
    expect((await getEquipped('alice')).ink).toBe('ink-blue');
    expect(await equipCosmetic('alice', 'ink', 'ink-charcoal')).not.toBeNull(); // default-unlocked
    expect(await equipCosmetic('alice', 'ink', 'ink-gold')).toBeNull(); // needs a 7-day streak
    expect((await getEquipped('alice')).ink).toBe('ink-charcoal');
  });
});
