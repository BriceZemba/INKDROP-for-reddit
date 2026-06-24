import { describe, it, expect } from 'vitest';
import { weekOf } from '../src/server/core/ranking';

describe('weekOf', () => {
  it('groups day numbers into 7-day weeks (0-indexed)', () => {
    expect(weekOf(1)).toBe(0);
    expect(weekOf(7)).toBe(0);
    expect(weekOf(8)).toBe(1);
    expect(weekOf(14)).toBe(1);
    expect(weekOf(15)).toBe(2);
  });
});
