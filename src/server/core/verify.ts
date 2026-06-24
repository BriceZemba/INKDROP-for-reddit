/**
 * Server-side anti-cheat: re-simulate a submitted solution headlessly with
 * matter-js and confirm the ball can actually reach the goal. Physics can differ
 * slightly from the client, so this is a *tolerant* gate  it rejects only
 * solutions whose ball never comes anywhere near the goal (e.g. a fabricated
 * "solve" with no real ink), and never blocks a genuine attempt.
 */

import Matter from 'matter-js';
import { WORLD_W, WORLD_H, type Scene } from '../../shared/api';
import { gravityScale, inkStrokePhysics } from '../../shared/modifiers';

const INK_THICKNESS = 12;
const STEP_MS = 16.6;
const MAX_STEPS = 900;
const MAX_SEGMENTS = 600; // safety cap on body count

export type VerifyResult = { solved: boolean; minDist: number; ok: boolean };

function buildStrokeBodies(
  strokes: number[][],
  phys: { restitution: number; friction: number }
): Matter.Body[] {
  const out: Matter.Body[] = [];
  for (const flat of strokes) {
    for (let i = 2; i < flat.length && out.length < MAX_SEGMENTS; i += 2) {
      const x0 = flat[i - 2]!;
      const y0 = flat[i - 1]!;
      const x1 = flat[i]!;
      const y1 = flat[i + 1]!;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 1) continue;
      out.push(
        Matter.Bodies.rectangle((x0 + x1) / 2, (y0 + y1) / 2, len + INK_THICKNESS, INK_THICKNESS, {
          isStatic: true,
          angle: Math.atan2(y1 - y0, x1 - x0),
          restitution: phys.restitution,
          friction: phys.friction,
          chamfer: { radius: INK_THICKNESS / 2 },
        })
      );
    }
  }
  return out;
}

/** Replays the drawing; returns whether the ball reaches the goal (with tolerance). */
export function verifySolution(sc: Scene, strokes: number[][]): VerifyResult {
  try {
    const engine = Matter.Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = gravityScale(sc.modifier);

    const wallOpt = { isStatic: true, restitution: 0.2, friction: 0.1 };
    const statics: Matter.Body[] = [
      Matter.Bodies.rectangle(-30, WORLD_H / 2, 60, WORLD_H * 2, wallOpt),
      Matter.Bodies.rectangle(WORLD_W + 30, WORLD_H / 2, 60, WORLD_H * 2, wallOpt),
      Matter.Bodies.rectangle(WORLD_W / 2, -30, WORLD_W * 2, 60, wallOpt),
    ];
    for (const o of sc.obstacles) {
      if (o.kind === 'circle') {
        statics.push(Matter.Bodies.circle(o.x, o.y, o.r, { isStatic: true, restitution: 0.4, friction: 0.05 }));
      } else {
        statics.push(
          Matter.Bodies.rectangle(o.x, o.y, o.w, o.h, {
            isStatic: true,
            angle: o.kind === 'rect' ? ((o.angle ?? 0) * Math.PI) / 180 : 0,
            restitution: 0.2,
            friction: 0.2,
          })
        );
      }
    }

    const ball = Matter.Bodies.circle(sc.ball.x, sc.ball.y, sc.ball.r, {
      restitution: 0.36,
      friction: 0.02,
      frictionAir: 0.004,
      density: 0.0014,
    });

    const inkPhys = inkStrokePhysics(sc.modifier);
    Matter.World.add(engine.world, [...statics, ...buildStrokeBodies(strokes, inkPhys), ball]);

    const inGoal = (x: number, y: number) =>
      Math.abs(x - sc.goal.x) <= sc.goal.w / 2 && Math.abs(y - sc.goal.y) <= sc.goal.h / 2;

    let minDist = Infinity;
    let solved = false;
    for (let i = 0; i < MAX_STEPS; i++) {
      Matter.Engine.update(engine, STEP_MS);
      const { x, y } = ball.position;
      minDist = Math.min(minDist, Math.hypot(x - sc.goal.x, y - sc.goal.y));
      if (inGoal(x, y)) {
        solved = true;
        break;
      }
      if (y > WORLD_H + 80) break; // fell out
    }

    // tolerance: getting within ~1.5x the goal's half-size counts as "plausibly solved"
    const tol = Math.max(sc.goal.w, sc.goal.h) * 1.5 + sc.ball.r;
    return { solved, minDist, ok: solved || minDist <= tol };
  } catch (err) {
    // never block a real player because of a simulation error
    console.error('verifySolution error:', err);
    return { solved: false, minDist: Infinity, ok: true };
  }
}
