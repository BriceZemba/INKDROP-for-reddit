import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type {
  EquipRequest,
  EquipResponse,
  ErrorResponse,
  ProfileResponse,
} from '../../shared/api';
import {
  equipCosmetic,
  getAchievements,
  getEquipped,
  getFreezeTokens,
  getSolves,
  getUnlocked,
} from '../core/profile';
import { getStreak } from '../core/ranking';

export const profile = new Hono();

profile.get('/', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const [equipped, unlocked, achievements, solves, streak, freezeTokens] = await Promise.all([
    getEquipped(username),
    getUnlocked(username),
    getAchievements(username),
    getSolves(username),
    getStreak(username),
    getFreezeTokens(username),
  ]);
  return c.json<ProfileResponse>({
    type: 'profile',
    username,
    equipped,
    unlockedCosmetics: unlocked,
    achievements,
    solves,
    streak,
    freezeTokens,
  });
});

profile.post('/equip', async (c) => {
  const { kind, id } = await c.req.json<EquipRequest>();
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') {
    return c.json<ErrorResponse>({ status: 'error', message: 'Log in to equip.' }, 401);
  }
  const equipped = await equipCosmetic(username, kind, id);
  if (!equipped) {
    return c.json<ErrorResponse>({ status: 'error', message: 'That item is not unlocked.' }, 400);
  }
  return c.json<EquipResponse>({ type: 'equip', equipped });
});
