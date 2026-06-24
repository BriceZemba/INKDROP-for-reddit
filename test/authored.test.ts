import { describe, it, expect } from 'vitest';
import { WORLD_W, WORLD_H } from '../src/shared/api';
import { AUTHORED, AUTHORED_COUNT, authoredScene } from '../src/shared/authored';
import { sceneForLevel, generateScene } from '../src/shared/scenes';

describe('authored opening levels', () => {
  it('has a tuned opening run', () => {
    expect(AUTHORED_COUNT).toBeGreaterThanOrEqual(10);
  });

  it('keeps every authored level in-bounds, solvable-shaped, and above the control band', () => {
    AUTHORED.forEach((_, i) => {
      const s = authoredScene(i + 1, 'x')!;
      // ball + goal inside the world
      expect(s.ball.x).toBeGreaterThan(0);
      expect(s.ball.x).toBeLessThan(WORLD_W);
      expect(s.goal.x).toBeGreaterThan(0);
      expect(s.goal.x).toBeLessThan(WORLD_W);
      // goal stays clear of the reserved bottom UI band
      expect(s.goal.y).toBeLessThanOrEqual(WORLD_H - 240);
      // goal sits meaningfully below the ball (there's a drop to solve)
      expect(s.goal.y).toBeGreaterThan(s.ball.y + 200);
      // budget is forgiving relative to par, and par is positive
      expect(s.par).toBeGreaterThan(0);
      expect(s.par).toBeLessThanOrEqual(s.inkBudget);
    });
  });

  it('sceneForLevel uses authored levels for the opening, then procedural after', () => {
    expect(sceneForLevel(1, 'x').title).toBe(AUTHORED[0]!.title);
    const beyond = AUTHORED_COUNT + 1;
    expect(sceneForLevel(beyond, 'x')).toEqual(generateScene(beyond, 'x'));
  });
});
