/**
 * Ramer–Douglas–Peucker polyline simplification. Drawn strokes are sampled every
 * ~16px; simplifying them before turning each segment into a physics body (and
 * before storing/replaying) cuts body count and payload size with no visible loss.
 */

/**
 * Distance from point (px,py) to the segment a→b (clamped to the segment, so it
 * measures to the nearest point on the line, not the infinite line). Shared by
 * stroke simplification and erase hit-testing.
 */
export function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Simplify a flattened [x0,y0,x1,y1,...] stroke; keeps endpoints. */
export function simplifyStroke(flat: number[], epsilon = 3): number[] {
  const n = flat.length / 2;
  if (n < 3) return flat.slice();
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;

  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const ax = flat[s * 2]!;
    const ay = flat[s * 2 + 1]!;
    const bx = flat[e * 2]!;
    const by = flat[e * 2 + 1]!;
    for (let i = s + 1; i < e; i++) {
      const d = pointToSegmentDist(flat[i * 2]!, flat[i * 2 + 1]!, ax, ay, bx, by);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx]);
      stack.push([idx, e]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(flat[i * 2]!, flat[i * 2 + 1]!);
  }
  return out;
}
