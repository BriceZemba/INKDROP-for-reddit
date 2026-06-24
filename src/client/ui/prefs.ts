/** Persisted player preferences: sound volume, reduced motion, colorblind palette. */

import { sfx } from '../audio/sfx';
import { applyColorblind } from '../style/theme';

const KEY = 'inkdrop.prefs';

export type Prefs = {
  volume: number; // 0..1
  reducedMotion: boolean;
  colorblind: boolean;
};

const DEFAULTS: Prefs = { volume: 0.9, reducedMotion: false, colorblind: false };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export const prefs: Prefs = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Apply current prefs to the audio + palette systems. Call once at startup. */
export function applyPrefs(): void {
  sfx.setVolume(prefs.volume);
  applyColorblind(prefs.colorblind);
}

export function setVolume(v: number): void {
  prefs.volume = Math.max(0, Math.min(1, v));
  sfx.setVolume(prefs.volume);
  save();
}

export function setReducedMotion(on: boolean): void {
  prefs.reducedMotion = on;
  save();
}

export function setColorblind(on: boolean): void {
  prefs.colorblind = on;
  applyColorblind(on);
  save();
}
