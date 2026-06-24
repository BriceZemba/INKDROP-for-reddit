import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { WORLD_W, WORLD_H, type Scene as PuzzleScene } from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { drawScene } from '../play/engine';
import { net } from '../net';

/** Browse + replay past daily puzzles (practice mode — scores aren't recorded). */
export class Archive extends Scene {
  constructor() {
    super('Archive');
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
      .text(cx, 56, 'Past Puzzles', { fontFamily: FONTS.display, fontSize: '58px', color: HEX.ink, padding: { x: 14 } })
      .setOrigin(0.5);
    this.add
      .text(cx, 116, 'replay any day for practice', {
        fontFamily: FONTS.ui,
        fontSize: '22px',
        color: HEX.inkSoft,
      })
      .setOrigin(0.5);

    const loading = this.add
      .text(cx, 480, 'loading…', { fontFamily: FONTS.ui, fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5);

    void net
      .archive(12)
      .then((res) => {
        loading.destroy();
        if (res.days.length === 0) {
          this.add
            .text(cx, 480, 'No past puzzles yet —\ncheck back tomorrow!', {
              fontFamily: FONTS.ui,
              fontSize: '30px',
              color: HEX.inkSoft,
              align: 'center',
            })
            .setOrigin(0.5);
          return;
        }
        this.renderGrid(res.days);
      })
      .catch(() => loading.setText('Could not load archive.').setColor(HEX.accent));
  }

  /** A grid of mini thumbnails, each replays that day. */
  private renderGrid(days: PuzzleScene[]) {
    const cols = 3;
    const cellW = WORLD_W / cols;
    const cellH = 280;
    const top = 200;
    const thumbW = 200;
    const thumbH = 180;

    days.slice(0, 9).forEach((sc, i) => {
      const col = i % cols;
      const rowI = Math.floor(i / cols);
      const cxq = cellW * (col + 0.5);
      const cyq = top + rowI * cellH;

      // frame
      const frame = this.add.graphics();
      frame.fillStyle(COLORS.paper, 1);
      frame.fillRoundedRect(cxq - thumbW / 2, cyq - thumbH / 2, thumbW, thumbH, 12);
      frame.lineStyle(3, COLORS.ink, 0.5);
      frame.strokeRoundedRect(cxq - thumbW / 2, cyq - thumbH / 2, thumbW, thumbH, 12);

      // mini render of the scene, scaled into the thumbnail
      this.drawThumb(sc, cxq, cyq, thumbW, thumbH);

      this.add
        .text(cxq, cyq + thumbH / 2 + 20, `Day ${sc.dayNumber}`, {
          fontFamily: FONTS.ui,
          fontSize: '24px',
          color: HEX.ink,
          fontStyle: '800',
        })
        .setOrigin(0.5);
      this.add
        .text(cxq, cyq + thumbH / 2 + 48, `“${sc.title}”`, {
          fontFamily: FONTS.ui,
          fontSize: '19px',
          color: HEX.inkSoft,
        })
        .setOrigin(0.5);

      frame
        .setInteractive(
          new Phaser.Geom.Rectangle(cxq - thumbW / 2, cyq - thumbH / 2, thumbW, thumbH),
          Phaser.Geom.Rectangle.Contains
        )
        .on('pointerdown', () => this.play(sc));
    });
  }

  private drawThumb(sc: PuzzleScene, cx: number, cy: number, w: number, h: number) {
    const s = Math.min(w / WORLD_W, h / WORLD_H) * 0.9;
    const g = this.add.graphics();
    g.setPosition(cx - (WORLD_W * s) / 2, cy - (WORLD_H * s) / 2);
    g.setScale(s);
    drawScene(g, sc);
    // mask to the thumbnail bounds
    const maskShape = this.make.graphics({});
    maskShape.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.setMask(maskShape.createGeometryMask());
  }

  private play(sc: PuzzleScene) {
    this.registry.set('testReturn', 'Archive');
    this.scene.start('Game', { testScene: sc });
  }
}
