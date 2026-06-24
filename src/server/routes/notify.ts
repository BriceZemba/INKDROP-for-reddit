import { Hono } from 'hono';
import type { NotifyStatusResponse } from '../../shared/api';
import { isOptedIn, optIn, optOut } from '../core/notify';

export const notify = new Hono();

notify.get('/', async (c) => {
  return c.json<NotifyStatusResponse>({ type: 'notify', optedIn: await isOptedIn() });
});

notify.post('/toggle', async (c) => {
  const { on } = await c.req.json<{ on: boolean }>();
  const optedIn = on ? await optIn() : await optOut();
  return c.json<NotifyStatusResponse>({ type: 'notify', optedIn });
});
