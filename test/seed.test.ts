import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from './stubs/devvit-server';
import { seedDemo } from '../src/server/core/seed';
import { currentDayId } from '../src/server/core/daily';
import { leaderboard, solvedCount } from '../src/server/core/ranking';
import { listLevels } from '../src/server/core/forge';

describe('seed demo', () => {
  beforeEach(() => __reset());

  it('populates the leaderboard and community levels', async () => {
    const res = await seedDemo();
    expect(res.solvers).toBeGreaterThan(0);
    expect(res.levels).toBeGreaterThan(0);

    const dayId = await currentDayId();
    expect(await solvedCount(dayId)).toBe(res.solvers);

    const board = await leaderboard(dayId, 20);
    expect(board.length).toBe(res.solvers);
    // sorted ascending by ink (best first)
    expect(board[0]!.score).toBeLessThanOrEqual(board[board.length - 1]!.score);

    const { levels } = await listLevels('judge', 20);
    expect(levels.length).toBe(res.levels);
    // top community level carries its votes
    expect(levels[0]!.votes).toBeGreaterThan(0);
  });

  it('is idempotent: re-running does not duplicate community levels', async () => {
    await seedDemo();
    const before = (await listLevels('judge', 50)).levels.length;
    const second = await seedDemo();
    expect(second.levels).toBe(0); // guarded
    const after = (await listLevels('judge', 50)).levels.length;
    expect(after).toBe(before);
  });
});
