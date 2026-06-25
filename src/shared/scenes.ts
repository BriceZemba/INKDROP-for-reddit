/**
 * Deterministic scene generation for INKDROP  a 50-level difficulty curve.
 *
 * The same dayNumber always yields the same scene for everyone. Difficulty ramps
 * monotonically from a gentle Day 1 to a near-impossible Day 50 (and stays brutal
 * afterwards): more obstacles, a narrower goal, a tighter ink budget, longer lateral
 * travel, and harsher daily twists. Pure module  no Devvit deps  so it runs on
 * both client and server (incl. the anti-cheat replay).
 */

import { WORLD_W, WORLD_H, type Obstacle, type Scene } from './api';
import type { Modifier } from './modifiers';
import { authoredScene } from './authored';

/** Number of authored difficulty steps before the curve plateaus at "brutal". */
export const MAX_LEVEL = 50;

/** The puzzle never occupies the bottom band  that's reserved for controls. */
const GOAL_FLOOR = WORLD_H - 250;

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const LAUNCH_DAY_ISO = '2026-06-17';

export function dayIdFromTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dayNumberFromTime(ms: number): number {
  const launch = Date.parse(LAUNCH_DAY_ISO + 'T00:00:00Z');
  const diff = Math.floor((ms - launch) / 86_400_000);
  return Math.max(1, diff + 1);
}

const TITLES = [
  'First Drop', 'The Nudge', 'Mind the Gap', 'Switchback', 'Threading',
  'Around the Peg', 'Two Steps', 'Cliffhanger', 'The Pendulum', 'Tight Squeeze',
  'Over the Top', 'The Gauntlet', 'Carry the Weight', 'Cradle', 'The Funnel',
  'Bank Shot', 'Patience', 'The Detour', 'Needle', 'Crosswind',
  'The Maze', 'Pinball', 'Hairpin', 'The Drop Zone', 'Tightrope',
  'No Margin', 'The Sieve', 'Last Inch', 'Brinkmanship', 'The Vise',
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 0 (easiest) → 1 (brutal); plateaus at 1 past MAX_LEVEL.
 * Climbs in deliberate tiers: a sharp step every 5 levels with a gentler ramp
 * inside each tier, so every 5th level lands as a real difficulty jump.
 */
function difficulty(dayNumber: number): number {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, dayNumber));
  const band = Math.floor((lvl - 1) / 5); // which 5-level tier (0-based)
  const bandsTotal = Math.ceil(MAX_LEVEL / 5) - 1; // tiers above the first
  const within = ((lvl - 1) % 5) / 5; // 0..0.8 progress inside the tier
  return clamp((band + within * 0.35) / bandsTotal, 0, 1);
}

/** Pick a twist; harsher modifiers grow more likely with difficulty. */
function chooseModifier(t: number, rnd: () => number): Modifier | undefined {
  if (rnd() > t * 0.75) return undefined; // rare early, common late
  const easy: Modifier[] = ['extraInk', 'lowGravity', 'bouncyInk'];
  const hard: Modifier[] = ['narrowGoal', 'oneStroke', 'slipperyInk'];
  const pool = rnd() < t ? hard : easy;
  return pool[Math.floor(rnd() * pool.length)]!;
}

/**
 * The scene actually played for a given level/day: a hand-authored opening level
 * when one exists, otherwise the procedural curve. This is the entry point the
 * Daily and Campaign should use; `generateScene` stays the pure procedural source.
 */
export function sceneForLevel(dayNumber: number, dayId: string): Scene {
  return authoredScene(dayNumber, dayId) ?? generateScene(dayNumber, dayId);
}

/**
 * Generate the canonical scene for a given day number (1..50 ramp, 50+ brutal).
 */
export function generateScene(dayNumber: number, dayId: string): Scene {
  const seed = hashStr(`inkdrop:${dayNumber}`);
  const rnd = mulberry32(seed);
  const rng = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const t = difficulty(dayNumber);

  // Ball near the top, offset to one side.
  const ballSide = rnd() < 0.5 ? -1 : 1;
  const ball = {
    x: clamp(WORLD_W / 2 + ballSide * rng(40, 240), 140, WORLD_W - 140),
    y: 150,
    r: 26,
  };

  // Goal sits in the lower play band (always above the control bar), pulled to the
  // opposite side; lateral travel grows with difficulty.
  const lateral = lerp(120, 340, t);
  const goalX = clamp(ball.x - ballSide * (lateral + rng(0, 80)), 120, WORLD_W - 120);
  const goal = {
    x: Math.round(goalX),
    y: Math.round(rng(GOAL_FLOOR - 110, GOAL_FLOOR)),
    w: Math.round(lerp(200, 64, t)),
    h: Math.round(lerp(96, 70, t)),
  };

  const obstacles: Obstacle[] = [];
  const count = dayNumber <= 1 ? 0 : Math.round(lerp(1, 10, t));

  if (count > 0) {
    // A blocker ledge just below the ball so a straight drop won't simply work.
    obstacles.push({
      kind: 'rect',
      x: clamp(ball.x + ballSide * rng(-30, 50), 150, WORLD_W - 150),
      y: ball.y + rng(170, 250),
      w: rng(170, 220 + 80 * t),
      h: 24,
      angle: rng(-8 - 14 * t, 8 + 14 * t),
    });
  }

  // Mid-field obstacles spread across the vertical play space.
  for (let i = 1; i < count; i++) {
    const frac = i / count;
    const y = clamp(lerp(330, goal.y - 80, frac) + rng(-40, 40), 320, goal.y - 70);
    const x = clamp(rng(150, WORLD_W - 150), 120, WORLD_W - 120);
    if (rnd() < 0.3 + 0.25 * t) {
      obstacles.push({ kind: 'circle', x, y, r: rng(34, 44 + 22 * t) });
    } else {
      obstacles.push({
        kind: 'rect',
        x,
        y,
        w: rng(140, 240 + 80 * t),
        h: 24,
        angle: rng(-16 - 20 * t, 16 + 20 * t),
      });
    }
  }

  // A spinner-style bar shows up on harder days.
  if (t > 0.55 && rnd() < t) {
    obstacles.push({
      kind: 'spinner',
      x: WORLD_W / 2 + rng(-110, 110),
      y: clamp(rng(WORLD_H * 0.45, WORLD_H * 0.62), 360, goal.y - 90),
      w: rng(220, 320),
      h: 22,
    });
  }

  const dist = Math.hypot(goal.x - ball.x, goal.y - ball.y);
  const par = Math.round(dist * lerp(1.12, 1.0, t));
  const inkBudget = Math.round(clamp(dist * lerp(1.9, 1.1, t), 600, 1900));

  const scene: Scene = {
    dayId,
    dayNumber,
    seed,
    ball,
    goal,
    obstacles,
    inkBudget,
    par,
    title: TITLES[(dayNumber - 1) % TITLES.length]!,
  };

  // Twists + optional bonus rings (no modifier on the very first day).
  if (dayNumber > 1) {
    const mod = chooseModifier(t, rnd);
    if (mod) {
      scene.modifier = mod;
      if (mod === 'extraInk') scene.inkBudget = Math.round(scene.inkBudget * 1.4);
      if (mod === 'narrowGoal') scene.goal.w = Math.max(64, Math.round(scene.goal.w * 0.62));
      if (mod === 'oneStroke') scene.inkBudget = Math.round(scene.inkBudget * 1.25);
    }
  }
  if (rnd() < 0.35) {
    const n = 1 + (rnd() < 0.35 ? 1 : 0);
    scene.bonuses = [];
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      const bx = clamp(ball.x + (goal.x - ball.x) * f + (rnd() - 0.5) * 160, 90, WORLD_W - 90);
      const by = clamp(ball.y + (goal.y - ball.y) * f, 320, goal.y - 100);
      scene.bonuses.push({ x: Math.round(bx), y: Math.round(by), r: 32 });
    }
  }

  return scene;
}
