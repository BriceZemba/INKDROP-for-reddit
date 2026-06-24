import { Scene } from 'phaser';
import { showShareSheet, showToast } from '@devvit/web/client';
import { WORLD_W, WORLD_H, type Scene as PuzzleScene, type SolveResponse } from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper, starRow } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { achievementById } from '../../shared/achievements';
import { cosmeticById } from '../../shared/cosmetics';
import { drawInkStroke, drawScene } from '../play/engine';
import { net } from '../net';

type LastSolve = {
  response: SolveResponse;
  strokes: number[][];
  scene: PuzzleScene;
  inkUsed: number;
};

export class Result extends Scene {
  constructor() {
    super('Result');
  }

  create() {
    const last = this.registry.get('lastSolve') as LastSolve | undefined;
    if (!last) {
      this.scene.start('MainMenu');
      return;
    }
    const { response: r, scene: sc, strokes } = last;

    fadeIn(this);
    paintPaper(this, WORLD_W, WORLD_H);

    // ---- Ghost board (lower half): the puzzle with everyone's lines ----
    const board = this.add.graphics().setDepth(0);
    board.setAlpha(0.85);
    drawScene(board, sc);

    // your line, bold
    const mine = this.add.graphics().setDepth(2);
    for (const s of strokes) drawInkStroke(mine, s, COLORS.accent, 12, 1);

    // fetch + animate ghost lines fading in one by one
    void net
      .ghosts(6)
      .then((g) => {
        g.ghosts.forEach((ghost, i) => {
          const gfx = this.add.graphics().setDepth(1).setAlpha(0);
          for (const s of ghost.strokes) drawInkStroke(gfx, s, COLORS.ghost, 7, 0.5);
          this.tweens.add({ targets: gfx, alpha: 1, duration: 320, delay: 400 + i * 220 });
        });
      })
      .catch(() => {});

    // ---- Result card (upper area) ----
    const cx = WORLD_W / 2;
    const card = this.add.graphics().setDepth(5);
    card.fillStyle(COLORS.paper, 0.96);
    card.fillRoundedRect(cx - 360, 90, 720, 470, 26);
    card.lineStyle(4, COLORS.ink, 0.9);
    card.strokeRoundedRect(cx - 360, 90, 720, 470, 26);

    const heading = r.firstSolve ? 'Solved!' : 'New best!';
    this.add
      .text(cx, 160, heading, { fontFamily: FONTS.display, fontSize: '88px', color: HEX.ink })
      .setOrigin(0.5)
      .setDepth(6);

    starRow(this, cx, 250, r.stars, 30).setDepth(6);

    this.add
      .text(cx, 318, `${r.myBestInk} ink`, {
        fontFamily: FONTS.ui,
        fontSize: '40px',
        color: HEX.blue,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.add
      .text(cx, 372, `Rank #${r.rank} of ${r.total}  ·  less ink than ${r.percentile}% of solvers`, {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.inkSoft,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(6);

    const streakMsg =
      r.streak.current > 0
        ? `🔥 ${r.streak.current}-day streak` + (r.streak.current === r.streak.best ? '  (best!)' : '')
        : '';
    this.add
      .text(cx, 422, streakMsg, {
        fontFamily: FONTS.ui,
        fontSize: '30px',
        color: HEX.gold,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.add
      .text(cx, 480, 'Come back tomorrow for a fresh drop ✒️', {
        fontFamily: FONTS.ui,
        fontSize: '24px',
        color: HEX.inkFaint,
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.showHistogram();
    this.showUnlocks(r.newAchievements, r.newCosmetics);

    // ---- Buttons (bottom) ----
    const by = WORLD_H - 150;
    new Button(this, cx - 130, by, 'Share', () => this.share(r, sc), {
      width: 250,
      height: 84,
      fontSize: 30,
    }).setDepth(6);
    new Button(this, cx + 150, by, '💬 Comment', () => this.comment(r, sc), {
      width: 270,
      height: 84,
      variant: 'ghost',
      fontSize: 28,
    }).setDepth(6);
    new Button(this, cx - 185, by + 110, 'Leaderboard', () => this.scene.start('Leaderboard'), {
      width: 330,
      height: 74,
      variant: 'ghost',
      fontSize: 26,
    }).setDepth(6);
    new Button(this, cx + 185, by + 110, 'Menu', () => this.scene.start('MainMenu'), {
      width: 330,
      height: 74,
      variant: 'ghost',
      fontSize: 26,
    }).setDepth(6);
  }

  /** A compact "you vs everyone" ink histogram on the result screen. */
  private showHistogram() {
    void net
      .distribution()
      .then((d) => {
        if (d.total < 2 || d.counts.length === 0) return;
        const cx = WORLD_W / 2;
        const top = 600;
        const w = 600;
        const h = 110;
        const panel = this.add.graphics().setDepth(6);
        panel.fillStyle(COLORS.paper, 0.92);
        panel.fillRoundedRect(cx - w / 2 - 16, top - 30, w + 32, h + 70, 18);
        panel.lineStyle(2, COLORS.ink, 0.4);
        panel.strokeRoundedRect(cx - w / 2 - 16, top - 30, w + 32, h + 70, 18);

        this.add
          .text(cx, top - 8, 'Ink used  you vs everyone', {
            fontFamily: FONTS.ui,
            fontSize: '22px',
            color: HEX.inkSoft,
            fontStyle: '700',
          })
          .setOrigin(0.5)
          .setDepth(7);

        const maxC = Math.max(...d.counts, 1);
        const myBin =
          d.myInk !== null && d.binSize > 0
            ? Math.min(d.counts.length - 1, Math.floor((d.myInk - d.binMin) / d.binSize))
            : -1;
        const bw = w / d.counts.length;
        const baseY = top + h + 16;
        d.counts.forEach((cnt, i) => {
          const bh = Math.max(3, (cnt / maxC) * h);
          const bx = cx - w / 2 + i * bw;
          const g = this.add.graphics().setDepth(7);
          g.fillStyle(i === myBin ? COLORS.accent : COLORS.blue, i === myBin ? 1 : 0.55);
          g.fillRoundedRect(bx + 3, baseY - bh, bw - 6, bh, 4);
        });
        this.add
          .text(cx - w / 2, baseY + 10, '◀ less ink', { fontFamily: FONTS.ui, fontSize: '18px', color: HEX.inkFaint })
          .setOrigin(0, 0)
          .setDepth(7);
        this.add
          .text(cx + w / 2, baseY + 10, 'more ink ▶', { fontFamily: FONTS.ui, fontSize: '18px', color: HEX.inkFaint })
          .setOrigin(1, 0)
          .setDepth(7);
      })
      .catch(() => {});
  }

  /** Animate an "Unlocked!" banner for any new achievements or cosmetics. */
  private showUnlocks(achIds: string[], cosIds: string[]) {
    const labels = [
      ...achIds.map((id) => {
        const a = achievementById(id);
        return a ? `${a.icon} ${a.name}` : null;
      }),
      ...cosIds.map((id) => {
        const c = cosmeticById(id);
        return c ? `🎨 ${c.name}` : null;
      }),
    ].filter((s): s is string => s !== null);
    if (labels.length === 0) return;

    sfx.reward();
    const cx = WORLD_W / 2;
    // sit clear below the histogram band (which extends to ~760) and above the buttons
    const y = 890;
    const c = this.add.container(cx, y).setDepth(7).setScale(0.6).setAlpha(0);
    const w = 560;
    const h = 56 + labels.length * 34;
    const bg = this.add.graphics();
    // opaque paper fill so the ghost board behind it never bleeds through the text
    bg.fillStyle(COLORS.paper, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.fillStyle(COLORS.gold, 0.16);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(3, COLORS.gold, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    c.add(bg);
    c.add(
      this.add
        .text(0, -h / 2 + 26, 'Unlocked!', {
          fontFamily: FONTS.ui,
          fontSize: '28px',
          color: HEX.gold,
          fontStyle: '800',
        })
        .setOrigin(0.5)
    );
    labels.forEach((l, i) => {
      c.add(
        this.add
          .text(0, -h / 2 + 60 + i * 34, l, {
            fontFamily: FONTS.ui,
            fontSize: '24px',
            color: HEX.ink,
            fontStyle: '700',
          })
          .setOrigin(0.5)
      );
    });
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' });
  }

  private scorecard(r: SolveResponse, sc: PuzzleScene): string {
    return (
      `I solved INKDROP Day ${sc.dayNumber} “${sc.title}” with ${r.myBestInk} ink ` +
      ` less than ${r.percentile}% of solvers! ${r.streak.current > 0 ? `🔥 ${r.streak.current}-day streak.` : ''} ` +
      `Can you use less? ✒️`
    );
  }

  private share(r: SolveResponse, sc: PuzzleScene) {
    void showShareSheet({ title: 'INKDROP', text: this.scorecard(r, sc) }).catch(() => {});
  }

  private comment(r: SolveResponse, sc: PuzzleScene) {
    void net
      .share(this.scorecard(r, sc))
      .then(() => showToast('Posted to the comments! 💬'))
      .catch(() => showToast('Could not post comment.'));
  }
}
