import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from './stubs/devvit-server';
import { getFurthest, clearLevel, getStars } from '../src/server/core/campaign';

describe('campaign progression', () => {
  beforeEach(() => __reset());

  it('starts at level 0', async () => {
    expect(await getFurthest('alice')).toBe(0);
  });

  it('advances one level at a time', async () => {
    expect(await clearLevel('alice', 1, 3)).toBe(1);
    expect(await clearLevel('alice', 2, 2)).toBe(2);
    expect(await clearLevel('alice', 3, 1)).toBe(3);
  });

  it('refuses to skip ahead', async () => {
    await clearLevel('alice', 1, 3);
    expect(await clearLevel('alice', 5, 3)).toBe(1); // frontier stays at 1
  });

  it('keeps the best star rating per level', async () => {
    await clearLevel('alice', 1, 2);
    await clearLevel('alice', 1, 1); // worse run shouldn't lower it
    expect((await getStars('alice'))['1']).toBe(2);
    await clearLevel('alice', 1, 3);
    expect((await getStars('alice'))['1']).toBe(3);
  });
});
