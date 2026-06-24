import { describe, it, expect } from 'vitest';
import { simplifyStroke } from '../src/shared/geometry';

describe('simplifyStroke (Douglas-Peucker)', () => {
  it('drops collinear midpoints but keeps the endpoints', () => {
    expect(simplifyStroke([0, 0, 5, 0, 10, 0], 1)).toEqual([0, 0, 10, 0]);
  });

  it('keeps a point that deviates beyond epsilon', () => {
    expect(simplifyStroke([0, 0, 5, 5, 10, 0], 1)).toEqual([0, 0, 5, 5, 10, 0]);
  });

  it('returns short strokes unchanged', () => {
    expect(simplifyStroke([1, 2, 3, 4], 3)).toEqual([1, 2, 3, 4]);
  });

  it('never grows a stroke', () => {
    const flat = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? i * 5 : Math.sin(i) * 2));
    expect(simplifyStroke(flat, 3).length).toBeLessThanOrEqual(flat.length);
  });
});
