/**
 * Hand-authored opening levels (the first stretch of both the Daily sequence and
 * the Campaign). The procedural generator is great for an endless curve but can
 * roll the occasional unfair or dull layout; the opening is a player's first
 * impression, so these are placed and tuned by hand for a reliably fun ramp.
 *
 * Each level keeps the ball near the top and the goal in the lower play band
 * (always above the reserved control bar), with a clear ramp solution and a
 * forgiving-but-meaningful ink budget. After AUTHORED runs out we fall back to
 * `generateScene` for the rest of the curve.
 *
 * Pure module (no Devvit deps) so it runs on client + server replay alike.
 */

import { type Obstacle, type Scene } from './api';
import type { Modifier } from './modifiers';

/** The authored shape of one level (the per-day/runtime fields are filled in later). */
type AuthoredLevel = {
  title: string;
  ball: { x: number; y: number; r: number };
  goal: { x: number; y: number; w: number; h: number };
  obstacles: Obstacle[];
  inkBudget: number;
  par: number;
  modifier?: Modifier;
  bonuses?: { x: number; y: number; r: number }[];
};

const R = 26; // standard ball radius

export const AUTHORED: AuthoredLevel[] = [
  // 1  pure ramp, no obstacles  teach the core gesture
  {
    title: 'First Drop',
    ball: { x: 200, y: 175, r: R },
    goal: { x: 600, y: 820, w: 200, h: 120 },
    obstacles: [],
    inkBudget: 1300,
    par: 850,
  },
  // 2  a single tilted ledge nudges the drop off-axis
  {
    title: 'The Nudge',
    ball: { x: 170, y: 175, r: R },
    goal: { x: 630, y: 835, w: 185, h: 110 },
    obstacles: [{ kind: 'rect', x: 285, y: 430, w: 175, h: 22, angle: 14 }],
    inkBudget: 1300,
    par: 900,
  },
  // 3  a peg to curve around (+ a bonus ring for flair)
  {
    title: 'Around the Peg',
    ball: { x: 180, y: 180, r: R },
    goal: { x: 620, y: 845, w: 175, h: 105 },
    obstacles: [{ kind: 'circle', x: 400, y: 505, r: 42 }],
    inkBudget: 1150,
    par: 880,
    bonuses: [{ x: 470, y: 360, r: 30 }],
  },
  // 4  cross the board: two staggered ledges
  {
    title: 'Switchback',
    ball: { x: 630, y: 175, r: R },
    goal: { x: 180, y: 850, w: 170, h: 100 },
    obstacles: [
      { kind: 'rect', x: 470, y: 430, w: 175, h: 22, angle: -12 },
      { kind: 'rect', x: 300, y: 645, w: 175, h: 22, angle: 12 },
    ],
    inkBudget: 1130,
    par: 880,
  },
  // 5  narrower goal, single peg in the lane
  {
    title: 'Threading',
    ball: { x: 200, y: 180, r: R },
    goal: { x: 610, y: 855, w: 130, h: 100 },
    obstacles: [{ kind: 'circle', x: 430, y: 525, r: 46 }],
    inkBudget: 1060,
    par: 860,
  },
  // 6  a wall across the middle: ramp over it
  {
    title: 'Over the Top',
    ball: { x: 160, y: 180, r: R },
    goal: { x: 640, y: 860, w: 150, h: 100 },
    obstacles: [{ kind: 'rect', x: 410, y: 560, w: 300, h: 22, angle: 0 }],
    inkBudget: 1120,
    par: 900,
  },
  // 7  gentle low-gravity twist: a floatier drop
  {
    title: 'The Pendulum',
    ball: { x: 620, y: 180, r: R },
    goal: { x: 190, y: 860, w: 160, h: 100 },
    obstacles: [{ kind: 'circle', x: 420, y: 520, r: 44 }],
    inkBudget: 1160,
    par: 900,
    modifier: 'lowGravity',
    bonuses: [{ x: 330, y: 380, r: 30 }],
  },
  // 8  two opposing ledges form a soft S
  {
    title: 'The Funnel',
    ball: { x: 180, y: 180, r: R },
    goal: { x: 620, y: 860, w: 140, h: 100 },
    obstacles: [
      { kind: 'rect', x: 330, y: 470, w: 185, h: 22, angle: 16 },
      { kind: 'rect', x: 520, y: 655, w: 185, h: 22, angle: -14 },
    ],
    inkBudget: 1070,
    par: 880,
  },
  // 9  a side wall plus a peg force a committed detour
  {
    title: 'The Detour',
    ball: { x: 400, y: 170, r: R },
    goal: { x: 180, y: 870, w: 150, h: 90 },
    obstacles: [
      { kind: 'rect', x: 500, y: 500, w: 280, h: 22, angle: 0 },
      { kind: 'circle', x: 300, y: 650, r: 40 },
    ],
    inkBudget: 1020,
    par: 840,
  },
  // 10  bouncy ink: timing the rebound
  {
    title: 'Bank Shot',
    ball: { x: 200, y: 180, r: R },
    goal: { x: 620, y: 860, w: 150, h: 100 },
    obstacles: [{ kind: 'circle', x: 410, y: 540, r: 46 }],
    inkBudget: 1150,
    par: 920,
    modifier: 'bouncyInk',
  },
  // 11  cross-board with a ledge + peg, tighter budget
  {
    title: 'Hairpin',
    ball: { x: 630, y: 180, r: R },
    goal: { x: 170, y: 860, w: 118, h: 95 },
    obstacles: [
      { kind: 'rect', x: 470, y: 440, w: 180, h: 22, angle: -14 },
      { kind: 'circle', x: 330, y: 635, r: 42 },
    ],
    inkBudget: 1030,
    par: 880,
  },
  // 12  small goal, two ledges  the graduation puzzle before procedural takes over
  {
    title: 'Needle',
    ball: { x: 180, y: 180, r: R },
    goal: { x: 620, y: 865, w: 100, h: 92 },
    obstacles: [
      { kind: 'rect', x: 360, y: 480, w: 200, h: 22, angle: 14 },
      { kind: 'rect', x: 520, y: 665, w: 180, h: 22, angle: -12 },
    ],
    inkBudget: 1000,
    par: 860,
  },
];

/** How many opening levels are hand-authored. */
export const AUTHORED_COUNT = AUTHORED.length;

/** Build a full Scene from the authored level for this number, or null if none. */
export function authoredScene(dayNumber: number, dayId: string): Scene | null {
  const a = AUTHORED[dayNumber - 1];
  if (!a) return null;
  const scene: Scene = {
    dayId,
    dayNumber,
    seed: 0,
    ball: { ...a.ball },
    goal: { ...a.goal },
    obstacles: a.obstacles.map((o) => ({ ...o })),
    inkBudget: a.inkBudget,
    par: a.par,
    title: a.title,
  };
  if (a.modifier) scene.modifier = a.modifier;
  if (a.bonuses) scene.bonuses = a.bonuses.map((b) => ({ ...b }));
  return scene;
}
