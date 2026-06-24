import { describe, it, expect } from 'vitest';
import { gravityScale, inkStrokePhysics, maxStrokes } from '../src/shared/modifiers';
import { COLORS, applyColorblind } from '../src/client/style/theme';

describe('modifier physics', () => {
  it('low gravity reduces gravity, others leave it at 1', () => {
    expect(gravityScale('lowGravity')).toBeCloseTo(0.58);
    expect(gravityScale(undefined)).toBe(1);
    expect(gravityScale('extraInk')).toBe(1);
  });

  it('bouncy ink is springy, slippery ink is low-friction', () => {
    expect(inkStrokePhysics('bouncyInk').restitution).toBeGreaterThan(0.5);
    expect(inkStrokePhysics('slipperyInk').friction).toBeLessThan(0.01);
    expect(inkStrokePhysics(undefined)).toEqual({ restitution: 0.15, friction: 0.25 });
  });

  it('one-stroke caps strokes at 1, otherwise effectively unlimited', () => {
    expect(maxStrokes('oneStroke')).toBe(1);
    expect(maxStrokes(undefined)).toBeGreaterThan(1);
  });
});

describe('applyColorblind', () => {
  it('swaps the accent + restores it', () => {
    const original = COLORS.accent;
    applyColorblind(true);
    expect(COLORS.accent).toBe(0xe69f00);
    expect(COLORS.green).toBe(0x0072b2);
    applyColorblind(false);
    expect(COLORS.accent).toBe(original);
  });
});
