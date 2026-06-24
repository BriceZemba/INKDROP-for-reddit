import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { reddit } from '@devvit/web/server';
import {
  WORLD_W,
  WORLD_H,
  type ErrorResponse,
  type ForgeGhostsResponse,
  type ForgeListResponse,
  type ForgeReportResponse,
  type ForgeSort,
  type ForgeSubmitRequest,
  type ForgeSubmitResponse,
  type ForgeVoteResponse,
  type Obstacle,
} from '../../shared/api';
import {
  listLevels,
  reportLevel,
  sampleForgeGhosts,
  storeForgeGhost,
  submitLevel,
  voteLevel,
} from '../core/forge';
import { grant } from '../core/profile';
import { allow } from '../core/ratelimit';

export const forge = new Hono();

const err = (c: Context, message: string, code: ContentfulStatusCode = 400) =>
  c.json<ErrorResponse>({ status: 'error', message }, code);

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H;
}

/** Reject malformed / out-of-bounds authored levels before storing them. */
function validate(req: ForgeSubmitRequest): string | null {
  if (!req || typeof req !== 'object') return 'Invalid level.';
  if (!req.ball || !inBounds(req.ball.x, req.ball.y)) return 'Ball is out of bounds.';
  if (!req.goal || !inBounds(req.goal.x, req.goal.y)) return 'Goal is out of bounds.';
  if (!Array.isArray(req.obstacles)) return 'Missing obstacles.';
  if (req.obstacles.length > 12) return 'Too many obstacles.';
  for (const o of req.obstacles as Obstacle[]) {
    if (!inBounds(o.x, o.y)) return 'An obstacle is out of bounds.';
  }
  if (typeof req.inkBudget !== 'number' || req.inkBudget < 200 || req.inkBudget > 3000) {
    return 'Ink budget out of range.';
  }
  return null;
}

forge.post('/submit', async (c) => {
  const req = await c.req.json<ForgeSubmitRequest>();
  const problem = validate(req);
  if (problem) return err(c, problem);

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return err(c, 'Log in to submit a level.', 401);
  if (!(await allow(`forge-submit:${username}`, 10, 600))) return err(c, 'Too many submissions  take a breather.', 429);

  const id = await submitLevel(username, req);
  await grant(username, ['forge-author']);
  return c.json<ForgeSubmitResponse>({ type: 'forge-submit', id });
});

forge.get('/list', async (c) => {
  const limit = Math.min(30, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)));
  const sort = ((c.req.query('sort') ?? 'top') as ForgeSort) === 'new' ? 'new' : 'top';
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const { levels, myVotes } = await listLevels(username, limit, sort);
  return c.json<ForgeListResponse>({ type: 'forge-list', levels, myVotes });
});

forge.get('/ghosts', async (c) => {
  const forgeId = c.req.query('forgeId');
  const ghosts = forgeId ? await sampleForgeGhosts(forgeId, 5) : [];
  return c.json<ForgeGhostsResponse>({ type: 'forge-ghosts', ghosts });
});

forge.post('/ghost', async (c) => {
  const { forgeId, strokes } = await c.req.json<{ forgeId: string; strokes: number[][] }>();
  if (!forgeId || !Array.isArray(strokes)) return err(c, 'Bad ghost.');
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return c.json({ ok: false });
  await storeForgeGhost(forgeId, username, strokes);
  return c.json({ ok: true });
});

forge.post('/report', async (c) => {
  const { id } = await c.req.json<{ id: string }>();
  if (!id) return err(c, 'Missing level id.');
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return err(c, 'Log in to report.', 401);
  const { reports, hidden } = await reportLevel(id);
  return c.json<ForgeReportResponse>({ type: 'forge-report', id, reports, hidden });
});

forge.post('/vote', async (c) => {
  const { id } = await c.req.json<{ id: string }>();
  if (!id) return err(c, 'Missing level id.');
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return err(c, 'Log in to vote.', 401);
  if (!(await allow(`forge-vote:${username}`, 60, 60))) return err(c, 'Slow down a moment.', 429);
  const { votes, voted } = await voteLevel(id, username);
  await grant(username, ['forge-vote']);
  return c.json<ForgeVoteResponse>({ type: 'forge-vote', id, votes, voted });
});
