import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import {
  WORLD_W,
  WORLD_H,
  type InitResponse,
  type LeaderboardResponse,
  type LeaderboardScope,
} from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { net } from '../net';

const TABS: { scope: LeaderboardScope; label: string }[] = [
  { scope: 'today', label: 'Today' },
  { scope: 'week', label: 'This Week' },
  { scope: 'alltime', label: 'All-Time' },
];

export class Leaderboard extends Scene {
  private rowsLayer!: Phaser.GameObjects.Container;
  private tabUnderline!: Phaser.GameObjects.Graphics;
  private tabX: Record<LeaderboardScope, number> = { today: 0, week: 0, alltime: 0 };
  private myName = '';

  constructor() {
    super('Leaderboard');
  }

  create() {
    fadeIn(this);
    paintPaper(this, WORLD_W, WORLD_H);
    const cx = WORLD_W / 2;
    const init = this.registry.get('init') as InitResponse | undefined;
    this.myName = init?.username ?? '';

    new Button(this, 70, 56, '‹', () => this.scene.start('MainMenu'), {
      width: 76,
      height: 64,
      variant: 'ghost',
      fontSize: 40,
    });
    this.add
      .text(cx, 64, 'Leaderboard', {
        fontFamily: FONTS.display,
        fontSize: '60px',
        color: HEX.ink,
        padding: { x: 16 },
      })
      .setOrigin(0.5);

    // tabs
    this.tabUnderline = this.add.graphics();
    const gap = WORLD_W / (TABS.length + 1);
    TABS.forEach((tb, i) => {
      const x = gap * (i + 1);
      this.tabX[tb.scope] = x;
      this.add
        .text(x, 140, tb.label, {
          fontFamily: FONTS.ui,
          fontSize: '28px',
          color: HEX.ink,
          fontStyle: '700',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          sfx.click();
          this.select(tb.scope);
        });
    });

    this.rowsLayer = this.add.container(0, 0);
    this.select('today');
  }

  private select(scope: LeaderboardScope) {
    const x = this.tabX[scope];
    this.tabUnderline.clear();
    this.tabUnderline.fillStyle(COLORS.accent, 1);
    this.tabUnderline.fillRoundedRect(x - 70, 162, 140, 6, 3);

    this.rowsLayer.removeAll(true);
    const loading = this.add
      .text(WORLD_W / 2, 420, 'loading…', { fontFamily: FONTS.ui, fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5);
    this.rowsLayer.add(loading);

    void net
      .leaderboard(scope, 20)
      .then((lb) => {
        loading.destroy();
        this.renderRows(lb);
      })
      .catch(() => loading.setText('Could not load.').setColor(HEX.accent));
  }

  private renderRows(lb: LeaderboardResponse) {
    const cx = WORLD_W / 2;
    const top = 210;
    const rowH = 64;

    const subtitle =
      lb.scope === 'today'
        ? 'lowest ink wins'
        : lb.scope === 'week'
          ? 'days solved this week'
          : 'puzzles solved all-time';
    this.rowsLayer.add(
      this.add
        .text(cx, 186, subtitle, { fontFamily: FONTS.ui, fontSize: '22px', color: HEX.inkSoft })
        .setOrigin(0.5)
    );

    if (lb.rows.length === 0) {
      this.rowsLayer.add(
        this.add
          .text(cx, 440, 'No entries yet —\nbe the first!', {
            fontFamily: FONTS.ui,
            fontSize: '30px',
            color: HEX.inkSoft,
            align: 'center',
          })
          .setOrigin(0.5)
      );
      return;
    }

    lb.rows.forEach((row, i) => {
      const y = top + i * rowH;
      const mine = row.username === this.myName;
      const g = this.add.graphics();
      g.fillStyle(mine ? COLORS.gold : COLORS.paperEdge, mine ? 0.4 : 0.45);
      g.fillRoundedRect(cx - 350, y, 700, rowH - 10, 12);
      if (mine) {
        g.lineStyle(3, COLORS.gold, 1);
        g.strokeRoundedRect(cx - 350, y, 700, rowH - 10, 12);
      }
      this.rowsLayer.add(g);

      const medal = ['🥇', '🥈', '🥉'][i] ?? `${row.rank}`;
      this.rowsLayer.add(
        this.add
          .text(cx - 320, y + (rowH - 10) / 2, medal, {
            fontFamily: FONTS.ui,
            fontSize: '30px',
            color: HEX.ink,
            fontStyle: '800',
          })
          .setOrigin(0, 0.5)
      );
      this.rowsLayer.add(
        this.add
          .text(cx - 230, y + (rowH - 10) / 2, `u/${row.username}`, {
            fontFamily: FONTS.ui,
            fontSize: '28px',
            color: HEX.ink,
            fontStyle: mine ? '800' : '600',
          })
          .setOrigin(0, 0.5)
      );
      this.rowsLayer.add(
        this.add
          .text(cx + 320, y + (rowH - 10) / 2, `${row.score} ${lb.unit}`, {
            fontFamily: FONTS.ui,
            fontSize: '28px',
            color: HEX.blue,
            fontStyle: '800',
          })
          .setOrigin(1, 0.5)
      );
    });

    const footer =
      lb.myRank !== null
        ? `You're #${lb.myRank} of ${lb.total}  ·  ${lb.myScore ?? 0} ${lb.unit}`
        : `${lb.total} player${lb.total === 1 ? '' : 's'} — join the board!`;
    this.rowsLayer.add(
      this.add
        .text(cx, WORLD_H - 80, footer, {
          fontFamily: FONTS.ui,
          fontSize: '28px',
          color: HEX.inkSoft,
          fontStyle: '700',
        })
        .setOrigin(0.5)
    );
  }
}
