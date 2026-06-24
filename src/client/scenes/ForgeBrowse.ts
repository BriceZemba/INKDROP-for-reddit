import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import {
  WORLD_W,
  WORLD_H,
  FORGE_PROMOTE_VOTES,
  type ForgeLevel,
  type ForgeSort,
  type Scene as PuzzleScene,
} from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { drawScene } from '../play/engine';
import { net } from '../net';

export class ForgeBrowse extends Scene {
  private myVotes = new Set<string>();
  private listLayer!: Phaser.GameObjects.Container;
  private tabUnderline!: Phaser.GameObjects.Graphics;
  private tabX: Record<ForgeSort, number> = { top: 0, new: 0 };

  constructor() {
    super('ForgeBrowse');
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
      .text(cx, 50, 'Community Levels', { fontFamily: FONTS.display, fontSize: '52px', color: HEX.ink })
      .setOrigin(0.5);
    new Button(this, WORLD_W - 100, 50, '＋ New', () => this.scene.start('Forge'), {
      width: 160,
      height: 58,
      variant: 'ghost',
      fontSize: 23,
    });
    this.add
      .text(cx, 100, `Top-voted levels become a daily puzzle (${FORGE_PROMOTE_VOTES}+ votes)`, {
        fontFamily: FONTS.ui,
        fontSize: '21px',
        color: HEX.inkSoft,
      })
      .setOrigin(0.5);

    // sort tabs
    this.tabUnderline = this.add.graphics();
    const tabs: { sort: ForgeSort; label: string }[] = [
      { sort: 'top', label: 'Top' },
      { sort: 'new', label: 'Newest' },
    ];
    const gap = WORLD_W / (tabs.length + 1);
    tabs.forEach((tb, i) => {
      const x = gap * (i + 1);
      this.tabX[tb.sort] = x;
      this.add
        .text(x, 150, tb.label, { fontFamily: FONTS.ui, fontSize: '28px', color: HEX.ink, fontStyle: '700' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          sfx.click();
          this.loadLevels(tb.sort);
        });
    });

    this.listLayer = this.add.container(0, 0);
    this.loadLevels('top');
  }

  private loadLevels(sort: ForgeSort) {
    const x = this.tabX[sort];
    this.tabUnderline.clear();
    this.tabUnderline.fillStyle(COLORS.accent, 1);
    this.tabUnderline.fillRoundedRect(x - 50, 170, 100, 6, 3);

    this.listLayer.removeAll(true);
    const loading = this.add
      .text(WORLD_W / 2, 420, 'loading…', { fontFamily: FONTS.ui, fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5);
    this.listLayer.add(loading);

    void net
      .forgeList(sort, 5)
      .then((res) => {
        loading.destroy();
        this.myVotes = new Set(res.myVotes);
        if (res.levels.length === 0) {
          this.listLayer.add(
            this.add
              .text(WORLD_W / 2, 460, 'No community levels yet.\nForge the first one!', {
                fontFamily: FONTS.ui,
                fontSize: '30px',
                color: HEX.inkSoft,
                align: 'center',
              })
              .setOrigin(0.5)
          );
          return;
        }
        res.levels.forEach((lvl, i) => this.renderCard(lvl, 200 + i * 168));
      })
      .catch(() => loading.setText('Could not load levels.').setColor(HEX.accent));
  }

  private renderCard(lvl: ForgeLevel, y: number) {
    const cx = WORLD_W / 2;
    const g = this.add.graphics();
    g.fillStyle(COLORS.paperEdge, 0.5);
    g.fillRoundedRect(cx - 360, y, 720, 150, 18);
    g.lineStyle(3, COLORS.ink, 0.4);
    g.strokeRoundedRect(cx - 360, y, 720, 150, 18);
    this.listLayer.add(g);

    // thumbnail
    const thumbX = cx - 280;
    const thumbY = y + 75;
    const frame = this.add.graphics();
    frame.fillStyle(COLORS.paper, 1);
    frame.fillRoundedRect(thumbX - 60, thumbY - 60, 120, 120, 10);
    frame.lineStyle(2, COLORS.ink, 0.4);
    frame.strokeRoundedRect(thumbX - 60, thumbY - 60, 120, 120, 10);
    this.listLayer.add(frame);
    this.drawThumb(this.levelToScene(lvl), thumbX, thumbY, 120, 120);

    this.listLayer.add(
      this.add.text(cx - 200, y + 28, `“${lvl.title}”`, {
        fontFamily: FONTS.ui,
        fontSize: '29px',
        color: HEX.ink,
        fontStyle: '800',
      })
    );
    this.listLayer.add(
      this.add.text(cx - 200, y + 70, `by u/${lvl.authorUsername}`, {
        fontFamily: FONTS.ui,
        fontSize: '23px',
        color: HEX.inkSoft,
      })
    );

    // report flag (top-right)
    const flag = this.add
      .text(cx + 330, y + 24, '⚐', { fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.report(lvl.id));
    this.listLayer.add(flag);

    const voteCount = this.add
      .text(cx + 300, y + 64, `▲ ${lvl.votes}`, {
        fontFamily: FONTS.ui,
        fontSize: '30px',
        color: HEX.accent,
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.listLayer.add(voteCount);

    const playBtn = new Button(this, cx + 110, y + 110, 'Play', () => this.play(lvl), {
      width: 140,
      height: 50,
      variant: 'ghost',
      fontSize: 24,
    });
    this.listLayer.add(playBtn);

    const voted = this.myVotes.has(lvl.id);
    const voteBtn = new Button(
      this,
      cx + 290,
      y + 110,
      voted ? 'Voted ✓' : 'Vote',
      () => this.vote(lvl.id, voteCount, voteBtn),
      { width: 150, height: 50, variant: voted ? 'ghost' : 'solid', fontSize: 24 }
    );
    if (voted) voteBtn.setEnabled(false);
    this.listLayer.add(voteBtn);
  }

  private drawThumb(scene: PuzzleScene, cx: number, cy: number, w: number, h: number) {
    const s = Math.min(w / WORLD_W, h / WORLD_H) * 0.9;
    const g = this.add.graphics();
    g.setPosition(cx - (WORLD_W * s) / 2, cy - (WORLD_H * s) / 2);
    g.setScale(s);
    drawScene(g, scene);
    const maskShape = this.make.graphics({});
    maskShape.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.setMask(maskShape.createGeometryMask());
    this.listLayer.add(g);
  }

  private levelToScene(lvl: ForgeLevel): PuzzleScene {
    const dist = Math.hypot(lvl.goal.x - lvl.ball.x, lvl.goal.y - lvl.ball.y);
    return {
      dayId: 'community',
      dayNumber: 0,
      seed: 0,
      ball: lvl.ball,
      goal: lvl.goal,
      obstacles: lvl.obstacles,
      inkBudget: lvl.inkBudget,
      par: Math.round(dist * 1.05),
      title: lvl.title,
      authorUsername: lvl.authorUsername,
      forgeId: lvl.id,
    };
  }

  private vote(id: string, label: Phaser.GameObjects.Text, btn: Button) {
    if (this.myVotes.has(id)) return;
    void net
      .forgeVote(id)
      .then((res) => {
        this.myVotes.add(id);
        label.setText(`▲ ${res.votes}`);
        btn.setLabel('Voted ✓').setEnabled(false);
        showToast('Thanks for voting!');
      })
      .catch(() => showToast('Could not vote.'));
  }

  private report(id: string) {
    void net
      .forgeReport(id)
      .then((res) => showToast(res.hidden ? 'Level hidden  thanks.' : 'Reported. Thanks.'))
      .catch(() => showToast('Could not report.'));
  }

  private play(lvl: ForgeLevel) {
    this.registry.set('testReturn', 'ForgeBrowse');
    this.scene.start('Game', { testScene: this.levelToScene(lvl) });
  }
}
