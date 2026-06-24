/**
 * Daily "twist" modifiers — a deterministic per-day mutator that changes how a
 * puzzle plays. Shared by the client (rendering + physics) and the server
 * (replay verification) so both agree exactly.
 */

export type Modifier =
  | 'lowGravity'
  | 'extraInk'
  | 'oneStroke'
  | 'narrowGoal'
  | 'bouncyInk'
  | 'slipperyInk';

export type ModInfo = { name: string; blurb: string; icon: string };

export const MODIFIERS: Record<Modifier, ModInfo> = {
  lowGravity: { name: 'Low Gravity', blurb: 'The ball floats — everything falls slower.', icon: '🪶' },
  extraInk: { name: 'Extra Ink', blurb: 'A generous ink budget today.', icon: '🌊' },
  oneStroke: { name: 'One Stroke', blurb: 'You may draw a single line. Make it count.', icon: '➰' },
  narrowGoal: { name: 'Narrow Goal', blurb: 'A tighter target — precision required.', icon: '🎯' },
  bouncyInk: { name: 'Bouncy Ink', blurb: 'Your ink is springy. Mind the rebound.', icon: '🏀' },
  slipperyInk: { name: 'Slippery Ink', blurb: 'Frictionless ink — the ball really slides.', icon: '🧊' },
};

/** Gravity multiplier applied to the world for this modifier. */
export function gravityScale(m: Modifier | undefined): number {
  return m === 'lowGravity' ? 0.58 : 1;
}

/** Physics for drawn ink under this modifier. */
export function inkStrokePhysics(m: Modifier | undefined): { restitution: number; friction: number } {
  if (m === 'bouncyInk') return { restitution: 0.85, friction: 0.04 };
  if (m === 'slipperyInk') return { restitution: 0.1, friction: 0.002 };
  return { restitution: 0.15, friction: 0.25 };
}

/** Maximum number of separate strokes allowed under this modifier. */
export function maxStrokes(m: Modifier | undefined): number {
  return m === 'oneStroke' ? 1 : 99;
}
