import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { reddit } from '@devvit/web/server';
import type {
  CampaignClearRequest,
  CampaignClearResponse,
  CampaignResponse,
  ErrorResponse,
} from '../../shared/api';
import { clearLevel, getFurthest, getStars } from '../core/campaign';

export const campaign = new Hono();

const err = (c: Context, message: string, code: ContentfulStatusCode = 400) =>
  c.json<ErrorResponse>({ status: 'error', message }, code);

campaign.get('/', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const [furthest, stars] = await Promise.all([getFurthest(username), getStars(username)]);
  return c.json<CampaignResponse>({ type: 'campaign', furthest, stars });
});

campaign.post('/clear', async (c) => {
  const { level, stars } = await c.req.json<CampaignClearRequest>();
  if (typeof level !== 'number') return err(c, 'Missing level.');
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return err(c, 'Log in to save progress.', 401);
  const furthest = await clearLevel(username, level, stars ?? 1);
  return c.json<CampaignClearResponse>({ type: 'campaign-clear', furthest });
});
