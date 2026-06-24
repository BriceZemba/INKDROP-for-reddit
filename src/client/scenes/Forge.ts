import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { showForm, showToast } from '@devvit/web/client';
import { WORLD_W, WORLD_H, type Obstacle, type Scene as PuzzleScene } from '../../shared/api';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { drawScene } from '../play/engine';
import { net } from '../net';

type Tool = 'ball' | 'goal' | 'block' | 'circle';
type Draft = { ball: PuzzleScene['ball']; goal: PuzzleScene['goal']; obstacles: Obstacle[] };

const PLAY_TOP = 150;
const PLAY_BOTTOM = WORLD_H - 250;

export class Forge extends Scene {
  private draft!: Draft;
  private tool: Tool = 'block';
  private gfx!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private chips: { tool: Tool; x: number }[] = [];
  private indicator!: Phaser.GameObjects.Graphics;
  private submitBtn!: Button;

  private selected: number | null = null;
  private dragIdx: number | null = null;
  private dragOff = { x: 0, y: 0 };
  private editBar!: Phaser.GameObjects.Container;
  private solved = false;

  constructor() {
    super('Forge');
  }

  create() {
    fadeIn(this);
    paintPaper(this, WORLD_W, WORLD_H);
    this.draft = (this.registry.get('forgeDraft') as Draft | undefined) ?? this.defaultDraft();
    this.tool = 'block';
    this.selected = null;
    this.dragIdx = null;
    // a level is "verified" only after the creator test-solves the current draft
    this.solved = this.registry.get('forgeSolved') === true;
    this.registry.remove('forgeSolved');

    new Button(this, 70, 56, '‹', () => this.scene.start('MainMenu'), {
      width: 76,
      height: 64,
      variant: 'ghost',
      fontSize: 40,
    });
    this.add
      .text(WORLD_W / 2, 56, 'Level Forge', { fontFamily: FONTS.display, fontSize: '60px', color: HEX.ink })
      .setOrigin(0.5);
    new Button(this, WORLD_W - 110, 56, 'Browse', () => this.scene.start('ForgeBrowse'), {
      width: 170,
      height: 60,
      variant: 'ghost',
      fontSize: 24,
    });

    this.gfx = this.add.graphics().setDepth(1);
    this.hint = this.add
      .text(WORLD_W / 2, 116, '', { fontFamily: FONTS.ui, fontSize: '22px', color: HEX.inkSoft })
      .setOrigin(0.5);

    this.editBar = this.add.container(0, 0).setDepth(10).setVisible(false);
    this.buildEditBar();
    this.buildTools();
    this.buildActions();
    this.bindCanvas();
    this.redraw();
    this.refreshSubmit();
  }

  private defaultDraft(): Draft {
    return {
      ball: { x: WORLD_W / 2 - 180, y: 200, r: 26 },
      goal: { x: WORLD_W / 2 + 180, y: WORLD_H - 320, w: 130, h: 84 },
      obstacles: [{ kind: 'rect', x: WORLD_W / 2, y: 470, w: 240, h: 24, angle: 8 }],
    };
  }

  /* ------------------------------- Tools ---------------------------------- */

  private buildTools() {
    const labels: { tool: Tool; text: string }[] = [
      { tool: 'ball', text: '⬤ Ball' },
      { tool: 'goal', text: '▢ Goal' },
      { tool: 'block', text: '▬ Block' },
      { tool: 'circle', text: '● Peg' },
    ];
    const n = labels.length;
    const gap = WORLD_W / (n + 1);
    this.indicator = this.add.graphics().setDepth(3);
    this.chips = [];
    labels.forEach((l, i) => {
      const x = gap * (i + 1);
      this.chips.push({ tool: l.tool, x });
      this.add
        .text(x, PLAY_BOTTOM + 60, l.text, {
          fontFamily: FONTS.ui,
          fontSize: '26px',
          color: HEX.ink,
          fontStyle: '700',
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectTool(l.tool));
    });
    this.selectTool('block');
  }

  private selectTool(tool: Tool) {
    this.tool = tool;
    const chip = this.chips.find((c) => c.tool === tool)!;
    this.indicator.clear();
    this.indicator.fillStyle(COLORS.accent, 0.18);
    this.indicator.fillRoundedRect(chip.x - 78, PLAY_BOTTOM + 36, 156, 48, 14);
    this.indicator.lineStyle(3, COLORS.accent, 0.9);
    this.indicator.strokeRoundedRect(chip.x - 78, PLAY_BOTTOM + 36, 156, 48, 14);
    this.updateHint();
  }

  private updateHint() {
    if (this.selected !== null) {
      this.hint.setText('drag to move · use the toolbar to rotate, resize or delete').setColor(HEX.inkSoft);
      return;
    }
    const tips: Record<Tool, string> = {
      ball: 'Tap to move the start ball',
      goal: 'Tap to move the goal',
      block: `Tap empty space to drop a bar (${this.draft.obstacles.length}/12) · tap one to edit`,
      circle: `Tap empty space to drop a peg (${this.draft.obstacles.length}/12) · tap one to edit`,
    };
    this.hint.setText(tips[this.tool]).setColor(HEX.inkSoft);
  }

  /* ------------------------------ Edit bar -------------------------------- */

  private buildEditBar() {
    const mk = (dx: number, label: string, fn: () => void) =>
      new Button(this, dx, 0, label, fn, { width: 64, height: 56, variant: 'ghost', fontSize: 26 });
    this.editBar.add(mk(-105, '⟲', () => this.rotateSel()));
    this.editBar.add(mk(-35, '＋', () => this.resizeSel(1)));
    this.editBar.add(mk(35, '－', () => this.resizeSel(-1)));
    this.editBar.add(mk(105, '🗑', () => this.deleteSel()));
  }

  private positionEditBar() {
    if (this.selected === null) {
      this.editBar.setVisible(false);
      return;
    }
    const o = this.draft.obstacles[this.selected]!;
    const x = Phaser.Math.Clamp(o.x, 130, WORLD_W - 130);
    const y = Phaser.Math.Clamp(o.y - 78, PLAY_TOP + 30, PLAY_BOTTOM);
    this.editBar.setPosition(x, y).setVisible(true);
  }

  private rotateSel() {
    if (this.selected === null) return;
    const o = this.draft.obstacles[this.selected]!;
    if (o.kind === 'rect') {
      o.angle = ((o.angle ?? 0) + 15) % 360;
      this.markEdited();
    } else {
      showToast('Pegs are round  nothing to rotate.');
    }
  }

  private resizeSel(dir: number) {
    if (this.selected === null) return;
    const o = this.draft.obstacles[this.selected]!;
    if (o.kind === 'rect') o.w = Phaser.Math.Clamp(o.w + dir * 40, 90, 360);
    else if (o.kind === 'circle') o.r = Phaser.Math.Clamp(o.r + dir * 10, 24, 90);
    this.markEdited();
  }

  private deleteSel() {
    if (this.selected === null) return;
    this.draft.obstacles.splice(this.selected, 1);
    this.selected = null;
    sfx.place();
    this.markEdited();
    this.updateHint();
  }

  /* ------------------------------ Actions --------------------------------- */

  private buildActions() {
    const y = WORLD_H - 70;
    new Button(this, WORLD_W / 2 - 230, y, 'Test', () => this.test(), {
      width: 200,
      height: 78,
      variant: 'ghost',
      fontSize: 28,
    });
    this.submitBtn = new Button(this, WORLD_W / 2 + 60, y, 'Submit level', () => this.submit(), {
      width: 320,
      height: 84,
      fontSize: 30,
    });
  }

  private refreshSubmit() {
    // Keep it tappable so a tap explains the gate (a disabled button gives no feedback).
    this.submitBtn.setLabel(this.solved ? 'Submit ✓' : 'Submit');
  }

  /* ------------------------------- Canvas --------------------------------- */

  private bindCanvas() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < PLAY_TOP || p.y > PLAY_BOTTOM) return;
      if (this.input.hitTestPointer(p).length > 0) return; // UI / edit bar

      const idx = this.obstacleAt(p.x, p.y);
      if (idx !== null) {
        this.selected = idx;
        this.dragIdx = idx;
        const o = this.draft.obstacles[idx]!;
        this.dragOff = { x: p.x - o.x, y: p.y - o.y };
        this.positionEditBar();
        this.updateHint();
        this.redraw();
        return;
      }
      // empty space: deselect or place
      this.selected = null;
      this.editBar.setVisible(false);
      this.placeNew(Math.round(p.x), Math.round(p.y));
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragIdx === null) return;
      const o = this.draft.obstacles[this.dragIdx]!;
      o.x = Phaser.Math.Clamp(Math.round(p.x - this.dragOff.x), 40, WORLD_W - 40);
      o.y = Phaser.Math.Clamp(Math.round(p.y - this.dragOff.y), PLAY_TOP, PLAY_BOTTOM);
      this.positionEditBar();
      this.markEdited();
    });

    this.input.on('pointerup', () => {
      this.dragIdx = null;
    });
  }

  private obstacleAt(x: number, y: number): number | null {
    let bestI: number | null = null;
    let bestD = Infinity;
    this.draft.obstacles.forEach((o, i) => {
      const reach = o.kind === 'circle' ? o.r + 10 : Math.max(o.w, o.h) / 2 + 14;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < reach && d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    return bestI;
  }

  private placeNew(x: number, y: number) {
    x = Phaser.Math.Clamp(x, 40, WORLD_W - 40);
    y = Phaser.Math.Clamp(y, PLAY_TOP, PLAY_BOTTOM);
    switch (this.tool) {
      case 'ball':
        this.draft.ball.x = x;
        this.draft.ball.y = y;
        break;
      case 'goal':
        this.draft.goal.x = x;
        this.draft.goal.y = y;
        break;
      case 'block':
        if (this.draft.obstacles.length < 12)
          this.draft.obstacles.push({ kind: 'rect', x, y, w: 220, h: 24, angle: 0 });
        else showToast('Max 12 obstacles.');
        break;
      case 'circle':
        if (this.draft.obstacles.length < 12)
          this.draft.obstacles.push({ kind: 'circle', x, y, r: 46 });
        else showToast('Max 12 obstacles.');
        break;
    }
    sfx.place();
    this.markEdited();
    this.updateHint();
  }

  /** Any edit invalidates the previous test-solve. */
  private markEdited() {
    this.solved = false;
    this.refreshSubmit();
    this.redraw();
  }

  private redraw() {
    this.gfx.clear();
    this.gfx.lineStyle(2, COLORS.inkFaint, 0.5);
    this.gfx.strokeRect(20, PLAY_TOP, WORLD_W - 40, PLAY_BOTTOM - PLAY_TOP);
    drawScene(this.gfx, this.buildScene());
    if (this.selected !== null) {
      const o = this.draft.obstacles[this.selected]!;
      const reach = o.kind === 'circle' ? o.r + 8 : Math.max(o.w, o.h) / 2 + 12;
      this.gfx.lineStyle(4, COLORS.accent, 0.95);
      this.gfx.strokeCircle(o.x, o.y, reach);
    }
  }

  /* --------------------------- Build / submit ----------------------------- */

  private buildScene(title = 'Your level'): PuzzleScene {
    const dist = Math.hypot(this.draft.goal.x - this.draft.ball.x, this.draft.goal.y - this.draft.ball.y);
    const inkBudget = Math.round(Phaser.Math.Clamp(dist * 1.7, 700, 1700));
    return {
      dayId: 'draft',
      dayNumber: 0,
      seed: 0,
      ball: this.draft.ball,
      goal: this.draft.goal,
      obstacles: this.draft.obstacles,
      inkBudget,
      par: Math.round(dist * 1.05),
      title,
    };
  }

  private validate(): string | null {
    if (this.draft.goal.y < this.draft.ball.y + 200) return 'Put the goal well below the ball.';
    return null;
  }

  private test() {
    const problem = this.validate();
    if (problem) {
      showToast(problem);
      return;
    }
    this.registry.set('forgeDraft', this.draft);
    this.registry.set('testReturn', 'Forge');
    this.scene.start('Game', { testScene: this.buildScene() });
  }

  private submit() {
    if (!this.solved) {
      showToast('Press Test and solve your level first  proves it’s beatable!');
      return;
    }
    const problem = this.validate();
    if (problem) {
      showToast(problem);
      return;
    }
    const sc = this.buildScene();
    void showForm({
      title: 'Name your level',
      fields: [{ type: 'string', name: 'title', label: 'Level title', required: true }],
      acceptLabel: 'Submit',
    })
      .then((res) => {
        if (res.action !== 'SUBMITTED') return;
        const title = String(res.values.title ?? '').slice(0, 40) || 'Untitled';
        return net
          .forgeSubmit({
            title,
            ball: sc.ball,
            goal: sc.goal,
            obstacles: sc.obstacles,
            inkBudget: sc.inkBudget,
          })
          .then(() => {
            this.registry.remove('forgeDraft');
            showToast('Level submitted! Rally votes in the Forge ✒️');
            this.scene.start('ForgeBrowse');
          });
      })
      .catch((e) => {
        console.error(e);
        showToast('Could not submit. Try again.');
      });
  }
}
