/**
 * Reusable INKDROP UI widgets, drawn with Phaser graphics so the whole game
 * shares one hand-drawn identity and stays crisp at any scale.
 */

import * as Phaser from 'phaser';
import { COLORS, HEX, FONTS } from '../style/theme';
import { sfx, haptic } from '../audio/sfx';

/** Paint the warm paper background with a soft vignette into the current scene. */
export function paintPaper(scene: Phaser.Scene, w: number, h: number): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.paper, 1);
  g.fillRect(0, 0, w, h);
  // Subtle darker edges for a printed-page feel.
  const edge = scene.add.graphics();
  edge.fillStyle(COLORS.paperEdge, 0.5);
  edge.fillRect(0, 0, w, 10);
  edge.fillRect(0, h - 10, w, 10);
  edge.fillRect(0, 0, 10, h);
  edge.fillRect(w - 10, 0, 10, h);
  g.setDepth(-100);
  edge.setDepth(-99);
}

export type ButtonOpts = {
  width?: number;
  height?: number;
  variant?: 'solid' | 'ghost';
  color?: number;
  textColor?: string;
  fontSize?: number;
};

/** A rounded, tappable button with press feedback. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private baseColor: number;
  private variant: 'solid' | 'ghost';
  private enabled = true;
  /** True only between a pointerdown ON this button and its release — so a drag
   *  that merely ends over the button (e.g. finishing a drawn line) won't click it. */
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    opts: ButtonOpts = {}
  ) {
    super(scene, x, y);
    this.bw = opts.width ?? 280;
    this.bh = opts.height ?? 76;
    this.variant = opts.variant ?? 'solid';
    this.baseColor = opts.color ?? COLORS.accent;

    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.drawBg(1);

    const textColor =
      opts.textColor ?? (this.variant === 'solid' ? HEX.white : HEX.ink);
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: FONTS.ui,
        fontSize: `${opts.fontSize ?? 30}px`,
        color: textColor,
        fontStyle: '700',
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Forgiving hit area — a little larger than the visual so a near-miss still counts.
    const pad = 12;
    this.setSize(this.bw, this.bh);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.bw / 2 - pad, -this.bh / 2 - pad, this.bw + pad * 2, this.bh + pad * 2),
      Phaser.Geom.Rectangle.Contains
    );

    this.on('pointerover', () => this.enabled && this.scene.tweens.add({ targets: this, scaleX: 1.04, scaleY: 1.04, duration: 90 }));
    this.on('pointerout', () => {
      this.pressed = false;
      this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 90 });
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.scene.tweens.add({ targets: this, scaleX: 0.95, scaleY: 0.95, duration: 60, yoyo: true });
    });
    this.on('pointerup', () => {
      // only a genuine press+release on this button counts as a click
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      sfx.click();
      haptic(8);
      onClick();
    });

    scene.add.existing(this);
  }

  private drawBg(alpha: number): void {
    const r = 18;
    this.bg.clear();
    if (this.variant === 'solid') {
      // drop shadow
      this.bg.fillStyle(COLORS.ink, 0.18);
      this.bg.fillRoundedRect(-this.bw / 2 + 3, -this.bh / 2 + 5, this.bw, this.bh, r);
      this.bg.fillStyle(this.baseColor, alpha);
      this.bg.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, r);
      this.bg.lineStyle(3, COLORS.ink, 0.9);
      this.bg.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, r);
    } else {
      this.bg.fillStyle(COLORS.paper, alpha);
      this.bg.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, r);
      this.bg.lineStyle(3, COLORS.ink, 0.8);
      this.bg.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, r);
    }
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.45);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }
}

/** A horizontal ink-budget meter that depletes as the player draws. */
export class InkMeter extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private mw = 320;
  private mh = 22;
  private ratio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add(this.g);
    this.redraw();
    scene.add.existing(this);
  }

  /** ratio: 0..1 remaining. */
  set(ratio: number): void {
    this.ratio = Phaser.Math.Clamp(ratio, 0, 1);
    this.redraw();
  }

  private redraw(): void {
    const r = this.mh / 2;
    this.g.clear();
    this.g.fillStyle(COLORS.ink, 0.12);
    this.g.fillRoundedRect(-this.mw / 2, -this.mh / 2, this.mw, this.mh, r);
    const col = this.ratio < 0.2 ? COLORS.accent : COLORS.blue;
    const fw = Math.max(this.mh, this.mw * this.ratio);
    this.g.fillStyle(col, 1);
    this.g.fillRoundedRect(-this.mw / 2, -this.mh / 2, fw, this.mh, r);
    this.g.lineStyle(2, COLORS.ink, 0.8);
    this.g.strokeRoundedRect(-this.mw / 2, -this.mh / 2, this.mw, this.mh, r);
  }
}

/** Draw a row of up to 3 stars (filled = gold). Returns the container. */
export function starRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  filled: number,
  size = 26
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const gap = size * 2.2;
  for (let i = 0; i < 3; i++) {
    const star = scene.add.star(
      (i - 1) * gap,
      0,
      5,
      size * 0.45,
      size,
      i < filled ? COLORS.gold : COLORS.paperEdge
    );
    star.setStrokeStyle(3, COLORS.ink, 0.85);
    c.add(star);
  }
  return c;
}
