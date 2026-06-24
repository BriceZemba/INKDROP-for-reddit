/**
 * Procedural sound  synthesized with the Web Audio API so the game ships with
 * zero audio asset files (and zero licensing concerns). All sounds are tiny
 * envelopes over oscillators / filtered noise.
 *
 * Browsers require a user gesture before audio can start, so call sfx.unlock()
 * from the first pointer interaction.
 */

const MUTE_KEY = 'inkdrop.muted';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private _muted = false;
  private _volume = 0.9;
  private lastScratch = 0;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this._muted = false;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this._muted ? 0 : this._volume;
  }

  /** Set master volume (0..1). */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  get volume(): number {
    return this._volume;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.applyGain();
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Lazily create the audio graph; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WinAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;
    this.master.connect(this.ctx.destination);

    // pre-bake a second of white noise for scratches / impacts
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  private get ok(): boolean {
    return !!this.ctx && !!this.master && !this._muted;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.3,
    when = 0,
    slideTo?: number
  ): void {
    if (!this.ok) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, bp: number, q = 1): void {
    if (!this.ok || !this.noiseBuf) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = bp;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** UI tap. */
  click(): void {
    this.tone(520, 0.05, 'square', 0.12);
  }

  /** Placing a Forge element. */
  place(): void {
    this.tone(300, 0.07, 'triangle', 0.16, 0, 200);
  }

  /** Pen scratch while drawing  throttled, intensity by pointer speed. */
  scratch(speed: number): void {
    const now = performance.now();
    if (now - this.lastScratch < 38) return;
    this.lastScratch = now;
    const g = Math.min(0.12, 0.03 + speed * 0.0009);
    this.noise(0.05, g, 1600 + Math.min(2200, speed * 6), 0.8);
  }

  /** Ball dropped. */
  drop(): void {
    this.tone(180, 0.16, 'sine', 0.22, 0, 120);
  }

  /** Ball impact, scaled by speed. */
  impact(speed: number): void {
    const g = Math.min(0.22, 0.05 + speed * 0.02);
    this.noise(0.06, g, 240, 0.6);
  }

  /** Solved! cheerful arpeggio. */
  success(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.26, i * 0.07));
  }

  /** Missed  soft descending buzz. */
  fail(): void {
    this.tone(300, 0.32, 'sawtooth', 0.18, 0, 120);
  }

  /** Reward / unlock chime. */
  reward(): void {
    [659, 988, 1318].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.24, i * 0.09));
  }

  /** Victory jingle  a bright rising fanfare with a final flourish. */
  victory(): void {
    const notes: [number, number, number][] = [
      [523, 0.0, 0.16],
      [659, 0.11, 0.16],
      [784, 0.22, 0.16],
      [1046, 0.33, 0.5],
    ];
    for (const [f, when, dur] of notes) this.tone(f, dur, 'triangle', 0.3, when);
    this.tone(1318, 0.55, 'sine', 0.18, 0.36); // sparkle
    this.tone(784, 0.55, 'sine', 0.14, 0.36); // soft harmony
  }

  /** Defeat jingle  a slow descending "sad trombone" phrase. */
  defeat(): void {
    this.tone(392, 0.22, 'sawtooth', 0.2, 0.0);
    this.tone(349, 0.22, 'sawtooth', 0.2, 0.2);
    this.tone(294, 0.3, 'sawtooth', 0.2, 0.4);
    this.tone(233, 0.6, 'sawtooth', 0.18, 0.62, 150); // drooping wah
  }
}

export const sfx = new Sfx();

/** Light haptic buzz on supporting devices. */
export function haptic(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
