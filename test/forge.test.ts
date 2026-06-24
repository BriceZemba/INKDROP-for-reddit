import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from './stubs/devvit-server';
import { submitLevel, voteLevel, listLevels, reportLevel } from '../src/server/core/forge';

const level = {
  title: 'Test',
  ball: { x: 200, y: 160, r: 26 },
  goal: { x: 400, y: 1000, w: 130, h: 84 },
  obstacles: [],
  inkBudget: 1000,
};

describe('forge core', () => {
  beforeEach(() => __reset());

  it('submits and lists a level with its author', async () => {
    const id = await submitLevel('alice', level);
    const { levels } = await listLevels('bob', 10);
    expect(levels).toHaveLength(1);
    expect(levels[0]!.id).toBe(id);
    expect(levels[0]!.authorUsername).toBe('alice');
  });

  it('dedupes votes per user', async () => {
    const id = await submitLevel('alice', level);
    expect((await voteLevel(id, 'bob')).votes).toBe(1);
    const repeat = await voteLevel(id, 'bob');
    expect(repeat.votes).toBe(1);
    expect(repeat.voted).toBe(true);
    expect((await voteLevel(id, 'carol')).votes).toBe(2);
  });

  it('reflects votes + the caller’s own votes in the listing', async () => {
    const id = await submitLevel('alice', level);
    await voteLevel(id, 'bob');
    const { levels, myVotes } = await listLevels('bob', 10);
    expect(levels[0]!.votes).toBe(1);
    expect(myVotes).toContain(id);
  });

  it('auto-hides a level after enough reports', async () => {
    const id = await submitLevel('alice', level);
    let res = { hidden: false };
    for (let i = 0; i < 5; i++) res = await reportLevel(id);
    expect(res.hidden).toBe(true);
    const { levels } = await listLevels('x', 10);
    expect(levels).toHaveLength(0);
  });
});
