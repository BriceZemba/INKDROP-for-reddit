import { describe, it, expect } from 'vitest';
import { WORLD_W, WORLD_H } from '../src/shared/api';
import {
  generateScene,
  mulberry32,
  dayIdFromTime,
  dayNumberFromTime,
} from '../src/shared/scenes';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('produces values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateScene', () => {
  it('is deterministic: same day number yields an identical scene', () => {
    expect(generateScene(42, '2026-08-01')).toEqual(generateScene(42, '2026-08-01'));
  });

  it('opens with a clean, obstacle-free Day 1', () => {
    const s = generateScene(1, 'x');
    expect(s.title.length).toBeGreaterThan(0);
    expect(s.obstacles).toHaveLength(0);
    expect(s.modifier).toBeUndefined();
  });

  it('keeps the puzzle inside the world and above the control band', () => {
    for (let d = 1; d <= 60; d++) {
      const s = generateScene(d, 'x');
      expect(s.ball.x).toBeGreaterThan(0);
      expect(s.ball.x).toBeLessThan(WORLD_W);
      expect(s.goal.x).toBeGreaterThan(0);
      expect(s.goal.x).toBeLessThan(WORLD_W);
      // the goal never reaches into the reserved bottom UI band
      expect(s.goal.y).toBeLessThanOrEqual(WORLD_H - 240);
      // the goal is always meaningfully below the ball
      expect(s.goal.y).toBeGreaterThan(s.ball.y + 200);
    }
  });

  it('ramps difficulty monotonically from day 1 to day 50', () => {
    const easy = generateScene(2, 'x');
    const hard = generateScene(50, 'x');
    expect(hard.obstacles.length).toBeGreaterThan(easy.obstacles.length);
    expect(hard.goal.w).toBeLessThan(easy.goal.w);
    // ink budget per unit distance is tighter when it's harder
    const ratio = (s: typeof easy) =>
      s.inkBudget / Math.hypot(s.goal.x - s.ball.x, s.goal.y - s.ball.y);
    expect(ratio(hard)).toBeLessThan(ratio(easy));
  });

  it('gives a positive ink budget and par', () => {
    const s = generateScene(12, 'x');
    expect(s.inkBudget).toBeGreaterThan(0);
    expect(s.par).toBeGreaterThan(0);
    expect(s.par).toBeLessThanOrEqual(s.inkBudget);
  });
});

describe('day helpers', () => {
  it('formats a UTC day id', () => {
    expect(dayIdFromTime(Date.parse('2026-06-20T15:30:00Z'))).toBe('2026-06-20');
  });
  it('day number grows by one each day from launch', () => {
    const launch = Date.parse('2026-06-17T00:00:00Z');
    expect(dayNumberFromTime(launch)).toBe(1);
    expect(dayNumberFromTime(launch + 3 * 86_400_000)).toBe(4);
  });
});
