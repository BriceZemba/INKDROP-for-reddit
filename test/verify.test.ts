import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/shared/api';
import { verifySolution } from '../src/server/core/verify';

function scene(partial: Partial<Scene>): Scene {
  return {
    dayId: 't',
    dayNumber: 1,
    seed: 0,
    ball: { x: 400, y: 150, r: 26 },
    goal: { x: 400, y: 1000, w: 200, h: 110 },
    obstacles: [],
    inkBudget: 1000,
    par: 800,
    title: 'test',
    ...partial,
  };
}

describe('verifySolution (anti-cheat replay)', () => {
  it('accepts a legitimate free-fall (ball directly above the goal)', () => {
    const v = verifySolution(scene({}), []);
    expect(v.solved).toBe(true);
    expect(v.ok).toBe(true);
  });

  it('rejects a no-ink "solve" on a lateral puzzle (the ball never reaches the goal)', () => {
    const lateral = scene({
      ball: { x: 200, y: 150, r: 26 },
      goal: { x: 620, y: 1005, w: 150, h: 92 },
    });
    const v = verifySolution(lateral, []);
    expect(v.solved).toBe(false);
    expect(v.ok).toBe(false);
  });

  it('never throws on malformed strokes (returns ok so real players are never blocked)', () => {
    const v = verifySolution(scene({}), [[Number.NaN, 0, 1, 1]]);
    expect(v).toHaveProperty('ok');
  });
});
