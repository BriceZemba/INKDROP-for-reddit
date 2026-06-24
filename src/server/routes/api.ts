import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { context, reddit } from '@devvit/web/server';
import {
  inkOfStrokes,
  starsFor,
  type ArchiveResponse,
  type DistributionResponse,
  type ErrorResponse,
  type GhostsResponse,
  type InitResponse,
  type LeaderboardResponse,
  type PresenceResponse,
  type ShareRequest,
  type ShareResponse,
  type SolveRequest,
  type SolveResponse,
} from '../../shared/api';
import { currentDayId, listArchive, postMetaFromContext, resolveScene } from '../core/daily';
import {
  alltimeBoard,
  bumpStreak,
  getStreak,
  inkDistribution,
  leaderboard,
  myStanding,
  recordDailyProgress,
  recordSolve,
  sampleGhosts,
  solvedCount,
  weeklyBoard,
} from '../core/ranking';
import type { LeaderboardScope } from '../../shared/api';
import { evaluateOnSolve, getEquipped, grant } from '../core/profile';
import { getFurthest } from '../core/campaign';
import { verifySolution } from '../core/verify';
import { maxStrokes } from '../../shared/modifiers';
import { heartbeat, readPresence } from '../core/presence';
import { allow } from '../core/ratelimit';

export const api = new Hono();

const err = (c: Context, message: string, code: ContentfulStatusCode = 400) =>
  c.json<ErrorResponse>({ status: 'error', message }, code);

api.get('/init', async (c) => {
  const meta = postMetaFromContext();
  if (!context.postId || !meta) {
    return err(c, 'This post is not an INKDROP puzzle.', 400);
  }

  const [scene, username, todayId] = await Promise.all([
    resolveScene(meta),
    reddit.getCurrentUsername(),
    currentDayId(),
  ]);
  const name = username ?? 'anonymous';

  const [standing, count, streak, equipped, campaignFurthest] = await Promise.all([
    myStanding(meta.dayId, name),
    solvedCount(meta.dayId),
    getStreak(name),
    getEquipped(name),
    getFurthest(name),
  ]);

  return c.json<InitResponse>({
    type: 'init',
    postId: context.postId,
    username: name,
    scene,
    myBestInk: standing.bestInk,
    myRank: standing.rank,
    percentile: standing.percentile,
    solvedCount: count,
    streak,
    isToday: meta.dayId === todayId,
    equipped,
    campaignFurthest,
  });
});

api.post('/solve', async (c) => {
  const meta = postMetaFromContext();
  if (!meta) return err(c, 'Not an INKDROP puzzle.');

  const body = await c.req.json<SolveRequest>();
  const strokes = Array.isArray(body.strokes) ? body.strokes : [];
  if (strokes.length === 0) return err(c, 'No strokes submitted.');

  // Trust the drawing, not the client's number: recompute ink server-side.
  const inkUsed = inkOfStrokes(strokes);

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  if (username === 'anonymous') return err(c, 'Log in to record your score.', 401);
  if (!(await allow(`solve:${username}`, 60, 60))) return err(c, 'Slow down a moment.', 429);

  const scene = await resolveScene(meta);

  // Enforce the one-stroke twist server-side.
  if (strokes.length > maxStrokes(scene.modifier)) {
    return err(c, 'This puzzle allows a single stroke only.');
  }

  // Anti-cheat: replay the drawing. Reject only trivial fakes (almost no ink AND
  // the ball never gets near the goal in simulation)  never a real attempt.
  const verdict = verifySolution(scene, strokes);
  if (!verdict.ok && inkUsed < 100) {
    return err(c, 'That solution didn’t reach the goal  give it another go!');
  }

  const outcome = await recordSolve(meta.dayId, username, inkUsed, strokes);

  // Streaks only advance on the live "today" puzzle, on the first solve.
  const todayId = await currentDayId();
  let streak = await getStreak(username);
  if (outcome.firstSolve && meta.dayId === todayId) {
    streak = await bumpStreak(username, meta.dayNumber);
    await recordDailyProgress(username, meta.dayNumber);
    // Reward streak milestones with user flair (Reddit-y). Ignored if flair is off.
    if ([7, 14, 30, 100].includes(streak.current)) {
      try {
        await reddit.setUserFlair({
          subredditName: context.subredditName,
          username,
          text: `🔥 ${streak.current}-day streak`,
        });
      } catch {
        /* flair not configured  ignore */
      }
    }
  }

  const stars = starsFor(outcome.bestInk, scene.par);
  const rewards = await evaluateOnSolve(username, {
    firstSolve: outcome.firstSolve,
    stars,
    percentile: outcome.percentile,
    streakCurrent: streak.current,
    streakBest: streak.best,
    strokeCount: strokes.length,
  });

  // 'collector' achievement: every bonus ring grabbed this run.
  const newAchievements = [...rewards.newAchievements];
  const bonusCount = scene.bonuses?.length ?? 0;
  if (bonusCount > 0 && (body.bonusesHit ?? 0) >= bonusCount) {
    newAchievements.push(...(await grant(username, ['collector'])));
  }

  return c.json<SolveResponse>({
    type: 'solve',
    improved: outcome.improved,
    myBestInk: outcome.bestInk,
    rank: outcome.rank + 1,
    total: outcome.total,
    percentile: outcome.percentile,
    stars,
    streak,
    firstSolve: outcome.firstSolve,
    newAchievements,
    newCosmetics: rewards.newCosmetics,
  });
});

api.post('/presence', async (c) => {
  if (!context.postId) return err(c, 'No post in context.');
  const count = context.userId
    ? await heartbeat(context.postId, context.userId)
    : await readPresence(context.postId);
  return c.json<PresenceResponse>({ type: 'presence', count });
});

api.post('/share', async (c) => {
  if (!context.postId) return err(c, 'No post in context.');
  const { text } = await c.req.json<ShareRequest>();
  const username = await reddit.getCurrentUsername();
  if (!username) return err(c, 'Log in to comment.', 401);
  if (!(await allow(`share:${username}`, 5, 300))) return err(c, 'You’re sharing too fast.', 429);
  const clean = String(text ?? '').slice(0, 500).trim();
  if (!clean) return err(c, 'Nothing to share.');
  try {
    await reddit.submitComment({ id: context.postId, text: clean });
    return c.json<ShareResponse>({ type: 'share', ok: true });
  } catch (e) {
    console.error('share comment failed:', e);
    return err(c, 'Could not post comment.', 400);
  }
});

api.get('/archive', async (c) => {
  const limit = Math.min(21, Math.max(1, parseInt(c.req.query('limit') ?? '14', 10)));
  const days = await listArchive(limit);
  return c.json<ArchiveResponse>({ type: 'archive', days });
});

api.get('/distribution', async (c) => {
  const meta = postMetaFromContext();
  if (!meta) return err(c, 'Not an INKDROP puzzle.');
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const [dist, standing] = await Promise.all([
    inkDistribution(meta.dayId),
    myStanding(meta.dayId, username),
  ]);
  return c.json<DistributionResponse>({
    type: 'distribution',
    counts: dist.counts,
    binMin: dist.binMin,
    binSize: dist.binSize,
    total: dist.total,
    myInk: standing.bestInk,
  });
});

api.get('/ghosts', async (c) => {
  const meta = postMetaFromContext();
  if (!meta) return err(c, 'Not an INKDROP puzzle.');
  const limit = Math.min(12, Math.max(1, parseInt(c.req.query('limit') ?? '6', 10)));
  const ghosts = await sampleGhosts(meta.dayId, limit);
  return c.json<GhostsResponse>({ type: 'ghosts', ghosts });
});

api.get('/leaderboard', async (c) => {
  const meta = postMetaFromContext();
  if (!meta) return err(c, 'Not an INKDROP puzzle.');
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)));
  const scope = ((c.req.query('scope') ?? 'today') as LeaderboardScope) || 'today';
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';

  if (scope === 'week' || scope === 'alltime') {
    const board =
      scope === 'week'
        ? await weeklyBoard(meta.dayNumber, username, limit)
        : await alltimeBoard(username, limit);
    return c.json<LeaderboardResponse>({
      type: 'leaderboard',
      scope,
      unit: scope === 'week' ? 'days' : 'solves',
      lowerIsBetter: false,
      rows: board.rows,
      total: board.total,
      myRank: board.myRank,
      myScore: board.myScore,
    });
  }

  const [rows, standing, total] = await Promise.all([
    leaderboard(meta.dayId, limit),
    myStanding(meta.dayId, username),
    solvedCount(meta.dayId),
  ]);
  return c.json<LeaderboardResponse>({
    type: 'leaderboard',
    scope: 'today',
    unit: 'ink',
    lowerIsBetter: true,
    rows,
    total,
    myRank: standing.rank,
    myScore: standing.bestInk,
  });
});
