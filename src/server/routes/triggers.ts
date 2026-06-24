import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { ensureTodayPosted } from '../core/daily';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const postId = await ensureTodayPosted();
    const input = await c.req.json<OnAppInstallRequest>();
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `INKDROP installed in r/${context.subredditName}; first puzzle ${postId ?? 'already present'} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error on install: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Install setup failed' }, 400);
  }
});
