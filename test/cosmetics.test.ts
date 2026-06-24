import { describe, it, expect } from 'vitest';
import { unlockedCosmetics, colorOf, DEFAULT_EQUIP } from '../src/shared/cosmetics';

describe('unlockedCosmetics', () => {
  it('a brand-new player only has the default items', () => {
    const ids = unlockedCosmetics({ streakBest: 0, solves: 0, achievements: [] });
    expect(ids).toContain('ink-blue');
    expect(ids).toContain('ball-vermillion');
    expect(ids).toContain('trail-blue');
    expect(ids).not.toContain('ink-gold'); // needs a 7-day streak
    expect(ids).not.toContain('ink-vermillion'); // needs 3 solves
  });

  it('unlocks streak- and solve-gated items as stats grow', () => {
    const ids = unlockedCosmetics({ streakBest: 7, solves: 10, achievements: [] });
    expect(ids).toContain('ink-emerald'); // 3-day streak
    expect(ids).toContain('ink-gold'); // 7-day streak
    expect(ids).toContain('ink-vermillion'); // 3 solves
    expect(ids).toContain('ink-violet'); // 10 solves
  });

  it('unlocks achievement-gated cosmetics', () => {
    const without = unlockedCosmetics({ streakBest: 0, solves: 0, achievements: [] });
    expect(without).not.toContain('ball-emerald');
    const withAch = unlockedCosmetics({ streakBest: 0, solves: 0, achievements: ['three-star'] });
    expect(withAch).toContain('ball-emerald');
  });
});

describe('colorOf', () => {
  it('returns the catalog colour for a known id', () => {
    expect(colorOf('ink-gold', 0x000000)).toBe(0xe7a93a);
  });
  it('falls back for an unknown id', () => {
    expect(colorOf('does-not-exist', 0x123456)).toBe(0x123456);
  });
  it('default equip ids are all real cosmetics', () => {
    for (const id of Object.values(DEFAULT_EQUIP)) {
      expect(colorOf(id, -1)).not.toBe(-1);
    }
  });
});
