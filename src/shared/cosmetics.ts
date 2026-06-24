/**
 * Cosmetic catalog — ink colours, ball skins, and trail tints players unlock
 * through streaks, achievements, and total solves. Shared by client (rendering)
 * and server (unlock logic).
 */

export type CosmeticKind = 'ink' | 'ball' | 'trail';

export type Unlock =
  | { type: 'default' }
  | { type: 'streak'; n: number }
  | { type: 'solves'; n: number }
  | { type: 'achievement'; id: string };

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  color: number;
  unlock: Unlock;
};

export const COSMETICS: Cosmetic[] = [
  // ---- ink colours ----
  { id: 'ink-blue', kind: 'ink', name: 'Royal Blue', color: 0x3b82c4, unlock: { type: 'default' } },
  { id: 'ink-charcoal', kind: 'ink', name: 'Charcoal', color: 0x2b2b3a, unlock: { type: 'default' } },
  { id: 'ink-vermillion', kind: 'ink', name: 'Vermillion', color: 0xe2574c, unlock: { type: 'solves', n: 3 } },
  { id: 'ink-emerald', kind: 'ink', name: 'Emerald', color: 0x4f9d69, unlock: { type: 'streak', n: 3 } },
  { id: 'ink-violet', kind: 'ink', name: 'Violet', color: 0x8158c4, unlock: { type: 'solves', n: 10 } },
  { id: 'ink-gold', kind: 'ink', name: 'Gold Leaf', color: 0xe7a93a, unlock: { type: 'streak', n: 7 } },

  // ---- ball skins ----
  { id: 'ball-vermillion', kind: 'ball', name: 'Vermillion', color: 0xe2574c, unlock: { type: 'default' } },
  { id: 'ball-ink', kind: 'ball', name: 'Inkwell', color: 0x2b2b3a, unlock: { type: 'default' } },
  { id: 'ball-sky', kind: 'ball', name: 'Sky', color: 0x3b82c4, unlock: { type: 'solves', n: 5 } },
  { id: 'ball-emerald', kind: 'ball', name: 'Emerald', color: 0x4f9d69, unlock: { type: 'achievement', id: 'three-star' } },
  { id: 'ball-gold', kind: 'ball', name: 'Golden', color: 0xe7a93a, unlock: { type: 'streak', n: 5 } },

  // ---- trail tints ----
  { id: 'trail-blue', kind: 'trail', name: 'Blue Trail', color: 0x3b82c4, unlock: { type: 'default' } },
  { id: 'trail-gold', kind: 'trail', name: 'Gold Trail', color: 0xe7a93a, unlock: { type: 'achievement', id: 'top-10' } },
  { id: 'trail-violet', kind: 'trail', name: 'Violet Trail', color: 0x8158c4, unlock: { type: 'solves', n: 10 } },
];

export const DEFAULT_EQUIP: Record<CosmeticKind, string> = {
  ink: 'ink-blue',
  ball: 'ball-vermillion',
  trail: 'trail-blue',
};

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): Cosmetic | undefined {
  return BY_ID.get(id);
}

export function colorOf(id: string, fallback: number): number {
  return BY_ID.get(id)?.color ?? fallback;
}

/** Resolve which cosmetics a player has unlocked, given their stats + achievements. */
export function unlockedCosmetics(stats: {
  streakBest: number;
  solves: number;
  achievements: string[];
}): string[] {
  const ach = new Set(stats.achievements);
  return COSMETICS.filter((c) => {
    switch (c.unlock.type) {
      case 'default':
        return true;
      case 'streak':
        return stats.streakBest >= c.unlock.n;
      case 'solves':
        return stats.solves >= c.unlock.n;
      case 'achievement':
        return ach.has(c.unlock.id);
    }
  }).map((c) => c.id);
}
