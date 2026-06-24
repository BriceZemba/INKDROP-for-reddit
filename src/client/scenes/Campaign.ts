import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import { WORLD_W, WORLD_H, CAMPAIGN_LEVELS } from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { net } from '../net';

const COLS = 5;
const ROWS = CAMPAIGN_LEVELS / COLS; // 10

export class Campaign extends Scene {
  constructor() {
    super('Campaign');
  }

  create() {
    fadeIn(this);
    paintPaper(this, WORLD_W, WORLD_H);
    const cx = WORLD_W / 2;

    new Button(this, 70, 56, '‹', () => this.scene.start('MainMenu'), {
      width: 76,
      height: 64,
      variant: 'ghost',
      fontSize: 40,
    });
    this.add
      .text(cx, 56, 'Campaign', { fontFamily: FONTS.display, fontSize: '64px', color: HEX.ink, padding: { x: 14 } })
      .setOrigin(0.5);

    const loading = this.add
      .text(cx, 600, 'loading…', { fontFamily: FONTS.ui, fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5);

    void net
      .campaign()
      .then((c) => {
        loading.destroy();
        this.render(c.furthest, c.stars);
      })
      .catch(() => loading.setText('Could not load campaign.').setColor(HEX.accent));
  }

  private render(furthest: number, stars: Record<string, number>) {
    const cx = WORLD_W / 2;
    const next = Math.min(CAMPAIGN_LEVELS, furthest + 1);
    const done = furthest >= CAMPAIGN_LEVELS;

    this.add
      .text(cx, 120, `${furthest} / ${CAMPAIGN_LEVELS} cleared`, {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.inkSoft,
        fontStyle: '700',
      })
      .setOrigin(0.5);

    new Button(
      this,
      cx,
      186,
      done ? 'Replay finale ▶' : `▶ Continue · Level ${next}`,
      () => this.play(next),
      { width: 460, height: 78, fontSize: 30 }
    );

    // 5 × 10 grid
    const top = 268;
    const cellW = (WORLD_W - 80) / COLS;
    const cellH = (WORLD_H - top - 40) / ROWS;
    const box = Math.min(cellW, cellH) - 14;

    for (let lvl = 1; lvl <= CAMPAIGN_LEVELS; lvl++) {
      const i = lvl - 1;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = 40 + cellW * (col + 0.5);
      const y = top + cellH * (row + 0.5);
      this.cell(lvl, x, y, box, furthest, next, stars[String(lvl)] ?? 0);
    }
  }

  private cell(lvl: number, x: number, y: number, size: number, furthest: number, next: number, stars: number) {
    const cleared = lvl <= furthest;
    const isNext = lvl === next && !cleared;
    const locked = lvl > next;

    const fill = cleared ? COLORS.green : isNext ? COLORS.accent : COLORS.paperEdge;
    const g = this.add.graphics();
    g.fillStyle(fill, cleared || isNext ? 0.9 : 0.5);
    g.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
    g.lineStyle(3, COLORS.ink, locked ? 0.25 : 0.8);
    g.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 12);

    const labelColor = cleared || isNext ? HEX.white : HEX.inkFaint;
    this.add
      .text(x, y - (cleared ? 8 : 0), locked ? '🔒' : `${lvl}`, {
        fontFamily: FONTS.ui,
        fontSize: locked ? '24px' : '28px',
        color: labelColor,
        fontStyle: '800',
      })
      .setOrigin(0.5);

    if (cleared && stars > 0) {
      this.add
        .text(x, y + 18, '★'.repeat(stars), { fontFamily: FONTS.ui, fontSize: '16px', color: HEX.gold })
        .setOrigin(0.5);
    }

    if (!locked) {
      g.setInteractive(
        new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size),
        Phaser.Geom.Rectangle.Contains
      ).on('pointerdown', () => this.play(lvl));
    } else {
      g.setInteractive(
        new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size),
        Phaser.Geom.Rectangle.Contains
      ).on('pointerdown', () => showToast(`Clear Level ${next} first.`));
    }
  }

  private play(level: number) {
    sfx.click();
    this.scene.start('Game', { campaignLevel: level });
  }
}
