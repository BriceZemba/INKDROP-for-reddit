import { describe, it, expect } from 'vitest';
import { strokeLength, inkOfStrokes, starsFor } from '../src/shared/api';

describe('strokeLength', () => {
  it('sums segment lengths of a flattened polyline', () => {
    // 3-4-5 triangle legs: (0,0)->(3,0)->(3,4) = 3 + 4 = 7
    expect(strokeLength([0, 0, 3, 0, 3, 4])).toBe(7);
  });
  it('is zero for a single point', () => {
    expect(strokeLength([10, 10])).toBe(0);
  });
});

describe('inkOfStrokes', () => {
  it('sums and rounds total ink across strokes', () => {
    expect(inkOfStrokes([[0, 0, 3, 0, 3, 4], [0, 0, 0, 10]])).toBe(17);
  });
});

describe('starsFor', () => {
  it('awards 3 stars at or under par', () => {
    expect(starsFor(100, 100)).toBe(3);
    expect(starsFor(80, 100)).toBe(3);
  });
  it('awards 2 stars up to 1.4x par', () => {
    expect(starsFor(140, 100)).toBe(2);
    expect(starsFor(120, 100)).toBe(2);
  });
  it('awards 1 star beyond 1.4x par', () => {
    expect(starsFor(141, 100)).toBe(1);
    expect(starsFor(300, 100)).toBe(1);
  });
});
