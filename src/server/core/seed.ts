/**
 * Demo seeding  a moderator-only helper that fills the sub with believable
 * activity so a first-time visitor (e.g. a solo hackathon judge) lands on a
 * *living* community instead of an empty one: a populated leaderboard, ghost
 * replays on today's puzzle, weekly/all-time standings, and a few community
 * Forge levels with votes. All data is clearly synthetic and safe to leave in.
 */

import { redis } from '@devvit/web/server';
import type { Scene, ForgeSubmitRequest } from '../../shared/api';
import { currentDayId, currentDayNumber } from './daily';
import { sceneForLevel } from '../../shared/scenes';
import { recordSolve, recordDailyProgress } from './ranking';
import { submitLevel, voteLevel, storeForgeGhost, loadLevel } from './forge';

const K_SEEDED = 'demo:seededLevels';

/** Synthetic redditors who "played" the demo. */
const FAKE_USERS = [
  'inkmaster',
  'dropguru',
  'line_lord',
  'curvy_quill',
  'pixel_pen',
  'ramp_rat',
  'blotbot',
  'nib_ninja',
  'splashdown',
  'doodlebug',
];

/** A plausible ramp polyline from just under the ball toward the goal. */
function rampStroke(sc: Pick<Scene, 'ball' | 'goal'>, wobble: number): number[] {
  const ax = sc.ball.x;
  const ay = sc.ball.y + 70;
  const gx = sc.goal.x;
  const gy = sc.goal.y - 30;
  const pts: number[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const arc = i > 0 && i < n ? Math.sin(t * Math.PI) * wobble : 0;
    pts.push(Math.round(ax + (gx - ax) * t + arc), Math.round(ay + (gy - ay) * t));
  }
  return pts;
}

type DemoLevel = { author: string; req: ForgeSubmitRequest; votes: number };

const DEMO_LEVELS: DemoLevel[] = [
  {
    author: 'line_lord',
    votes: 5,
    req: {
      title: 'Spiral Staircase',
      ball: { x: 180, y: 180, r: 26 },
      goal: { x: 620, y: 840, w: 160, h: 110 },
      obstacles: [
        { kind: 'rect', x: 400, y: 450, w: 200, h: 22, angle: 18 },
        { kind: 'rect', x: 300, y: 650, w: 200, h: 22, angle: -16 },
      ],
      inkBudget: 1300,
    },
  },
  {
    author: 'curvy_quill',
    votes: 3,
    req: {
      title: 'Threadneedle',
      ball: { x: 620, y: 180, r: 26 },
      goal: { x: 180, y: 850, w: 140, h: 100 },
      obstacles: [{ kind: 'circle', x: 400, y: 520, r: 48 }],
      inkBudget: 1200,
    },
  },
  {
    author: 'doodlebug',
    votes: 2,
    req: {
      title: 'The Cradle',
      ball: { x: 400, y: 170, r: 26 },
      goal: { x: 640, y: 860, w: 150, h: 100 },
      obstacles: [{ kind: 'rect', x: 300, y: 520, w: 260, h: 22, angle: 0 }],
      inkBudget: 1250,
    },
  },
  {
    author: 'nib_ninja',
    votes: 1,
    req: {
      title: 'Loop the Loop',
      ball: { x: 200, y: 180, r: 26 },
      goal: { x: 600, y: 860, w: 150, h: 100 },
      obstacles: [
        { kind: 'circle', x: 400, y: 500, r: 44 },
        { kind: 'rect', x: 520, y: 680, w: 180, h: 22, angle: -12 },
      ],
      inkBudget: 1200,
    },
  },
];

/**
 * Seed (or refresh) demo data. Idempotent: solver scores only improve, votes are
 * one-per-user, and community levels are created only once (guarded by a flag) so
 * pressing the button twice won't pile up duplicates.
 */
export async function seedDemo(): Promise<{ solvers: number; levels: number }> {
  const dayId = await currentDayId();
  const dayNumber = await currentDayNumber();
  const sc = sceneForLevel(dayNumber, dayId);

  // 1) Today's puzzle: a spread of fake solvers -> leaderboard, ghosts, histogram.
  const base = sc.par;
  for (let i = 0; i < FAKE_USERS.length; i++) {
    const u = FAKE_USERS[i]!;
    const ink = Math.round(base * (0.9 + i * 0.05)); // fan out from just under par
    await recordSolve(dayId, u, ink, [rampStroke(sc, 70 - i * 6)]);
    await recordDailyProgress(u, dayNumber); // feed weekly + all-time boards
  }

  // 2) Community Forge levels with votes (only once).
  const alreadySeeded = await redis.get(K_SEEDED);
  let levels = 0;
  if (!alreadySeeded) {
    for (const dl of DEMO_LEVELS) {
      const id = await submitLevel(dl.author, dl.req);
      // distinct upvoters from the fake roster
      for (let v = 0; v < Math.min(dl.votes, FAKE_USERS.length); v++) {
        await voteLevel(id, FAKE_USERS[v]!);
      }
      const lvl = await loadLevel(id);
      if (lvl) await storeForgeGhost(id, dl.author, [rampStroke(lvl, 50)]);
      levels++;
    }
    await redis.set(K_SEEDED, '1');
  }

  return { solvers: FAKE_USERS.length, levels };
}
