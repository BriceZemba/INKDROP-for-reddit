/**
 * Shared physics + rendering helpers for INKDROP play.
 * Used by the Game scene and the Forge test-play so behaviour is identical.
 */

import * as Phaser from 'phaser';
import { COLORS } from '../style/theme';
import { WORLD_W, WORLD_H, type Obstacle, type Scene } from '../../shared/api';

export const INK_THICKNESS = 12;
/** Minimum spacing between sampled drawing points (keeps body count sane). */
export const SAMPLE_DIST = 16;

type Matter = Phaser.Physics.Matter.MatterPhysics;

/** Left / right / top walls. The bottom is intentionally open (falling past = fail). */
export function addWalls(matter: Matter): void {
  const t = 60;
  const opt = { isStatic: true, restitution: 0.2, friction: 0.1 };
  matter.add.rectangle(-t / 2, WORLD_H / 2, t, WORLD_H * 2, opt);
  matter.add.rectangle(WORLD_W + t / 2, WORLD_H / 2, t, WORLD_H * 2, opt);
  matter.add.rectangle(WORLD_W / 2, -t / 2, WORLD_W * 2, t, opt);
}

/** Draw the static obstacles + goal + ball spawn ring into a graphics layer. */
export function drawScene(g: Phaser.GameObjects.Graphics, sc: Scene): void {
  // goal: glowing vermillion catch-zone
  const { x, y, w, h } = sc.goal;
  g.fillStyle(COLORS.accent, 0.16);
  g.fillRoundedRect(x - w / 2 - 8, y - h / 2 - 8, w + 16, h + 16, 16);
  g.fillStyle(COLORS.accent, 0.3);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(5, COLORS.accent, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);

  // obstacles
  for (const o of sc.obstacles) drawObstacle(g, o);

  // bonus rings (optional collectibles)
  if (sc.bonuses) {
    for (const b of sc.bonuses) {
      g.lineStyle(4, COLORS.gold, 0.9);
      g.strokeCircle(b.x, b.y, b.r);
      g.lineStyle(2, COLORS.gold, 0.4);
      g.strokeCircle(b.x, b.y, b.r + 7);
    }
  }

  // ball spawn ring
  g.lineStyle(3, COLORS.inkSoft, 0.5);
  g.strokeCircle(sc.ball.x, sc.ball.y, sc.ball.r + 6);
}

export function drawObstacle(g: Phaser.GameObjects.Graphics, o: Obstacle): void {
  g.fillStyle(COLORS.ink, 1);
  if (o.kind === 'circle') {
    g.fillCircle(o.x, o.y, o.r);
  } else {
    const angle = o.kind === 'rect' ? ((o.angle ?? 0) * Math.PI) / 180 : 0;
    drawRotRect(g, o.x, o.y, o.w, o.h, angle, o.kind === 'spinner' ? COLORS.inkSoft : COLORS.ink);
  }
}

function drawRotRect(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  color: number
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  const pts = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([px, py]) => new Phaser.Math.Vector2(cx + px! * cos - py! * sin, cy + px! * sin + py! * cos));
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

/** Create static Matter bodies for all obstacles. */
export function addObstacleBodies(matter: Matter, sc: Scene): void {
  for (const o of sc.obstacles) {
    if (o.kind === 'circle') {
      matter.add.circle(o.x, o.y, o.r, { isStatic: true, restitution: 0.4, friction: 0.05 });
    } else {
      // rect or spinner-bar — both are static angled bars
      matter.add.rectangle(o.x, o.y, o.w, o.h, {
        isStatic: true,
        angle: o.kind === 'rect' ? ((o.angle ?? 0) * Math.PI) / 180 : 0,
        restitution: 0.2,
        friction: 0.2,
      });
    }
  }
}

/** Turn a flattened polyline into a chain of static capsule bodies (the drawn ink). */
export function strokeToBodies(
  matter: Matter,
  flat: number[],
  phys: { restitution: number; friction: number } = { restitution: 0.15, friction: 0.25 }
): MatterJS.BodyType[] {
  const bodies: MatterJS.BodyType[] = [];
  for (let i = 2; i < flat.length; i += 2) {
    const x0 = flat[i - 2]!;
    const y0 = flat[i - 1]!;
    const x1 = flat[i]!;
    const y1 = flat[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) continue;
    const body = matter.add.rectangle((x0 + x1) / 2, (y0 + y1) / 2, len + INK_THICKNESS, INK_THICKNESS, {
      isStatic: true,
      angle: Math.atan2(y1 - y0, x1 - x0),
      restitution: phys.restitution,
      friction: phys.friction,
      chamfer: { radius: INK_THICKNESS / 2 },
    });
    bodies.push(body);
  }
  return bodies;
}

/** Render an ink stroke as a smooth line into a graphics layer. */
export function drawInkStroke(
  g: Phaser.GameObjects.Graphics,
  flat: number[],
  color = COLORS.blue,
  thickness = INK_THICKNESS,
  alpha = 1
): void {
  if (flat.length < 4) return;
  g.lineStyle(thickness, color, alpha);
  g.beginPath();
  g.moveTo(flat[0]!, flat[1]!);
  for (let i = 2; i < flat.length; i += 2) g.lineTo(flat[i]!, flat[i + 1]!);
  g.strokePath();
  // rounded caps
  g.fillStyle(color, alpha);
  g.fillCircle(flat[0]!, flat[1]!, thickness / 2);
  g.fillCircle(flat[flat.length - 2]!, flat[flat.length - 1]!, thickness / 2);
}

/** True if the ball centre is inside the goal zone. */
export function ballInGoal(bx: number, by: number, sc: Scene): boolean {
  return (
    Math.abs(bx - sc.goal.x) <= sc.goal.w / 2 && Math.abs(by - sc.goal.y) <= sc.goal.h / 2
  );
}
