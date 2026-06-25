import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import {
  WORLD_W,
  WORLD_H,
  CAMPAIGN_LEVELS,
  inkOfStrokes,
  starsFor,
  strokeLength,
  type InitResponse,
  type Scene as PuzzleScene,
} from '../../shared/api';
import type { PresenceMessage } from '../../shared/api';
import { sceneForLevel } from '../../shared/scenes';
import { colorOf } from '../../shared/cosmetics';
import { MODIFIERS, gravityScale, inkStrokePhysics, maxStrokes } from '../../shared/modifiers';
import { simplifyStroke, pointToSegmentDist } from '../../shared/geometry';
import { prefs } from '../ui/prefs';
import { connectRealtime, disconnectRealtime } from '@devvit/web/client';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, InkMeter, paintPaper, starRow } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx, haptic } from '../audio/sfx';
import {
  INK_THICKNESS,
  SAMPLE_DIST,
  addObstacleBodies,
  addWalls,
  ballInGoal,
  drawInkStroke,
  drawScene,
  strokeToBodies,
} from '../play/engine';
import { net } from '../net';

type Stroke = { flat: number[]; bodies: MatterJS.BodyType[] };

/** The bottom band is reserved for controls  the puzzle never goes here. */
const CONTROL_TOP = WORLD_H - 200;
/** Top of the drawable play area (below the HUD). */
const PLAY_TOP = 120;

export class Game extends Scene {
  private sc!: PuzzleScene;
  private testMode = false;
  private testReturn = 'Forge';
  private campaignLevel: number | null = null;
  private state: 'draw' | 'dropping' | 'won' | 'lost' = 'draw';

  private strokes: Stroke[] = [];
  private undone: number[][] = []; // redo stack
  private current: number[] = [];
  private drawing = false;
  private eraseMode = false;
  private committedInk = 0;

  private bonusGfx!: Phaser.GameObjects.Graphics;
  private bonusHit = new Set<number>();

  private inkGfx!: Phaser.GameObjects.Graphics;
  private sceneGfx!: Phaser.GameObjects.Graphics;
  private meter!: InkMeter;
  private remainText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private dropBtn!: Button;
  private eraseBtn!: Button;

  private ballBody: MatterJS.BodyType | undefined = undefined;
  private ballGfx: Phaser.GameObjects.Arc | undefined = undefined;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | undefined = undefined;

  private dropStart = 0;
  private stoppedMs = 0;

  // equipped cosmetics (resolved colours)
  private inkColor = COLORS.blue;
  private ballColor = COLORS.accent;
  private trailColor = COLORS.blue;

  // live presence
  private presenceLabel?: Phaser.GameObjects.Text;
  private presenceTimer: Phaser.Time.TimerEvent | undefined = undefined;
  private presenceChannel: string | undefined = undefined;

  constructor() {
    super('Game');
  }

  create(data?: { testScene?: PuzzleScene; campaignLevel?: number }) {
    this.testMode = !!data?.testScene;
    this.campaignLevel = data?.campaignLevel ?? null;
    if (this.testMode) this.testReturn = (this.registry.get('testReturn') as string) || 'Forge';
    const init = this.registry.get('init') as InitResponse | undefined;
    if (init?.equipped) {
      this.inkColor = colorOf(init.equipped.ink, COLORS.blue);
      this.ballColor = colorOf(init.equipped.ball, COLORS.accent);
      this.trailColor = colorOf(init.equipped.trail, COLORS.blue);
    }
    if (this.campaignLevel != null) {
      this.sc = sceneForLevel(this.campaignLevel, `campaign-${this.campaignLevel}`);
    } else if (data?.testScene) {
      this.sc = data.testScene;
    } else {
      if (!init) {
        this.scene.start('MainMenu');
        return;
      }
      this.sc = init.scene;
    }

    // reset state (scene instance is reused)
    this.state = 'draw';
    this.strokes = [];
    this.undone = [];
    this.current = [];
    this.drawing = false;
    this.eraseMode = false;
    this.committedInk = 0;
    this.bonusHit = new Set();
    this.ballBody = undefined;
    this.ballGfx = undefined;

    fadeIn(this);
    paintPaper(this, WORLD_W, WORLD_H);

    this.matter.world.autoUpdate = true;
    this.matter.world.enabled = true;
    this.matter.world.localWorld.gravity.y = gravityScale(this.sc.modifier);
    addWalls(this.matter);
    addObstacleBodies(this.matter, this.sc);

    this.sceneGfx = this.add.graphics().setDepth(1);
    drawScene(this.sceneGfx, this.sc);
    this.bonusGfx = this.add.graphics().setDepth(3);
    this.drawGoalLabel();
    this.drawModifierBadge();

    this.inkGfx = this.add.graphics().setDepth(2);

    this.buildHud();
    this.bindDrawing();
    this.updateInkUi();
    if (!this.testMode) this.maybeTutorial();
    if (!this.testMode && this.campaignLevel == null && init?.postId) this.startPresence(init.postId);
    if (this.testMode && this.sc.forgeId) this.showForgeGhosts(this.sc.forgeId);
  }

  /** Show how other redditors solved this community level (faint, fading in). */
  private showForgeGhosts(forgeId: string) {
    void net
      .forgeGhosts(forgeId)
      .then((res) => {
        res.ghosts.forEach((strokes, i) => {
          const gfx = this.add.graphics().setDepth(1).setAlpha(0);
          for (const s of strokes) drawInkStroke(gfx, s, COLORS.ghost, 6, 0.4);
          this.tweens.add({ targets: gfx, alpha: 1, duration: 300, delay: 200 + i * 150 });
        });
      })
      .catch(() => {});
  }

  /* ------------------------------ Presence -------------------------------- */

  private startPresence(postId: string) {
    this.presenceChannel = `presence:${postId}`;
    this.presenceLabel = this.add
      .text(WORLD_W - 24, 40, '', {
        fontFamily: FONTS.ui,
        fontSize: '20px',
        color: HEX.blue,
        fontStyle: '700',
      })
      .setOrigin(1, 0.5);

    const ping = () =>
      void net
        .presence()
        .then((r) => this.setPresence(r.count))
        .catch(() => {});
    ping();
    this.presenceTimer = this.time.addEvent({ delay: 5000, loop: true, callback: ping });

    try {
      connectRealtime<PresenceMessage>({
        channel: this.presenceChannel,
        onMessage: (m) => this.setPresence(m.count),
      });
    } catch {
      /* realtime unavailable  heartbeat polling still updates the label */
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopPresence());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopPresence());
  }

  private setPresence(n: number) {
    this.presenceLabel?.setText(n > 1 ? `👁 ${n} here now` : '');
  }

  private stopPresence() {
    this.presenceTimer?.remove();
    this.presenceTimer = undefined;
    if (this.presenceChannel) {
      try {
        disconnectRealtime(this.presenceChannel);
      } catch {
        /* ignore */
      }
      this.presenceChannel = undefined;
    }
  }

  /* ------------------------------ Tutorial -------------------------------- */

  private maybeTutorial() {
    let done = false;
    try {
      done = localStorage.getItem('inkdrop.tutorial') === '1';
    } catch {
      /* ignore */
    }
    if (done) return;
    this.showTutorial();
  }

  /** First-run coach: dims the board and animates the draw gesture. */
  private showTutorial() {
    const overlay = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.ink, 0.55);
    dim.fillRect(0, 0, WORLD_W, WORLD_H);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, WORLD_W, WORLD_H),
      Phaser.Geom.Rectangle.Contains
    );
    overlay.add(dim);

    overlay.add(
      this.add
        .text(WORLD_W / 2, 320, 'Drag to draw an ink ramp\nthat guides the ball into the GOAL', {
          fontFamily: FONTS.ui,
          fontSize: '34px',
          color: HEX.white,
          align: 'center',
          fontStyle: '700',
          lineSpacing: 8,
        })
        .setOrigin(0.5)
    );

    // animated gesture: a finger that traces a ramp, leaving an ink trail
    const a = { x: this.sc.ball.x, y: this.sc.ball.y + 90 };
    const b = { x: (this.sc.ball.x + this.sc.goal.x) / 2, y: (a.y + this.sc.goal.y) / 2 };
    const trail = this.add.graphics();
    overlay.add(trail);
    const finger = this.add.text(a.x, a.y, '👆', { fontSize: '54px' }).setOrigin(0.2, 0.1);
    overlay.add(finger);

    const guide = { t: 0 };
    this.tweens.add({
      targets: guide,
      t: 1,
      duration: 1300,
      repeat: -1,
      repeatDelay: 400,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = Phaser.Math.Linear(a.x, b.x, guide.t);
        const y = Phaser.Math.Linear(a.y, b.y, guide.t);
        finger.setPosition(x, y);
        trail.clear();
        trail.lineStyle(12, COLORS.accent, 0.9);
        trail.beginPath();
        trail.moveTo(a.x, a.y);
        trail.lineTo(x, y);
        trail.strokePath();
      },
    });

    overlay.add(
      this.add
        .text(WORLD_W / 2, WORLD_H - 230, 'then press DROP  ·  use less ink to rank higher', {
          fontFamily: FONTS.ui,
          fontSize: '26px',
          color: HEX.white,
        })
        .setOrigin(0.5)
    );
    overlay.add(
      this.add
        .text(WORLD_W / 2, WORLD_H - 290, 'tap anywhere to begin', {
          fontFamily: FONTS.ui,
          fontSize: '24px',
          color: HEX.gold,
          fontStyle: '700',
        })
        .setOrigin(0.5)
    );

    dim.on('pointerdown', () => {
      try {
        localStorage.setItem('inkdrop.tutorial', '1');
      } catch {
        /* ignore */
      }
      overlay.destroy();
    });
  }

  /* --------------------------------- HUD ---------------------------------- */

  private buildHud() {
    // back
    const backTarget = this.campaignLevel != null ? 'Campaign' : this.testMode ? this.testReturn : 'MainMenu';
    new Button(this, 70, 56, '‹', () => this.scene.start(backTarget), {
      width: 76,
      height: 64,
      variant: 'ghost',
      fontSize: 40,
    });

    const header =
      this.campaignLevel != null
        ? `Level ${this.campaignLevel}  ·  “${this.sc.title}”`
        : this.testMode
          ? 'Test play  solve it to verify'
          : `Day ${this.sc.dayNumber}  ·  “${this.sc.title}”`;
    this.add
      .text(WORLD_W / 2, 40, header, {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.inkSoft,
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.meter = new InkMeter(this, WORLD_W / 2, 86);
    this.remainText = this.add
      .text(WORLD_W / 2, 110, '', {
        fontFamily: FONTS.ui,
        fontSize: '20px',
        color: HEX.inkSoft,
      })
      .setOrigin(0.5);

    // control-band background (depth 5) sits above the falling ball (depth 4); the
    // buttons (depth 7) sit above the band.
    const bar = this.add.graphics().setDepth(5);
    bar.fillStyle(COLORS.paperEdge, 1);
    bar.fillRect(0, CONTROL_TOP, WORLD_W, WORLD_H - CONTROL_TOP);
    bar.lineStyle(2, COLORS.ink, 0.25);
    bar.lineBetween(0, CONTROL_TOP, WORLD_W, CONTROL_TOP);

    this.toast = this.add
      .text(WORLD_W / 2, CONTROL_TOP - 28, '', {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.accent,
        fontStyle: '700',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(6);

    // tool row
    const ty = WORLD_H - 138;
    const tool = (dx: number, label: string, fn: () => void) =>
      new Button(this, WORLD_W / 2 + dx, ty, label, fn, {
        width: 168,
        height: 64,
        variant: 'ghost',
        fontSize: 24,
      }).setDepth(7);
    tool(-258, 'Undo', () => this.undo());
    tool(-86, 'Redo', () => this.redo());
    this.eraseBtn = tool(86, '🧽 Erase', () => this.toggleErase());
    tool(258, 'Clear', () => this.clearInk());

    // drop the ball (the player taps this when their ramp is ready)
    this.dropBtn = new Button(this, WORLD_W / 2, WORLD_H - 64, 'DROP', () => this.drop(), {
      width: 320,
      height: 86,
      fontSize: 36,
    }).setDepth(7);
  }

  private drawModifierBadge() {
    const mod = this.sc.modifier;
    if (!mod) return;
    const info = MODIFIERS[mod];
    const label = `${info.icon} Twist: ${info.name}`;
    const w = 30 + label.length * 13;
    const x = WORLD_W / 2;
    const y = 138;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COLORS.gold, 0.18);
    g.fillRoundedRect(x - w / 2, y - 18, w, 36, 18);
    g.lineStyle(2, COLORS.gold, 0.9);
    g.strokeRoundedRect(x - w / 2, y - 18, w, 36, 18);
    this.add
      .text(x, y, label, { fontFamily: FONTS.ui, fontSize: '20px', color: HEX.ink, fontStyle: '800' })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private drawGoalLabel() {
    this.add
      .text(this.sc.goal.x, this.sc.goal.y, 'GOAL', {
        fontFamily: FONTS.ui,
        fontSize: '22px',
        color: HEX.accent,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  /* ------------------------------- Drawing -------------------------------- */

  private bindDrawing() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'draw') return;
      // ignore taps that land on UI buttons / the control band
      if (this.input.hitTestPointer(p).length > 0) return;
      if (p.y < PLAY_TOP || p.y > CONTROL_TOP) return;
      if (this.eraseMode) {
        this.eraseAt(p.x, p.y);
        return;
      }
      if (this.strokes.length >= maxStrokes(this.sc.modifier)) {
        this.toast.setColor(HEX.accent).setText('One stroke only  Clear to redraw.');
        return;
      }
      this.drawing = true;
      this.current = [Math.round(p.x), Math.round(p.y)];
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drawing || this.state !== 'draw') return;
      const lx = this.current[this.current.length - 2]!;
      const ly = this.current[this.current.length - 1]!;
      const d = Math.hypot(p.x - lx, p.y - ly);
      if (d < SAMPLE_DIST) return;
      // stop drawing this stroke if it would exceed the ink budget — tell the player
      // why the line stopped following their finger (otherwise it feels like a bug)
      if (this.committedInk + strokeLength(this.current) + d > this.sc.inkBudget) {
        this.endStroke();
        this.toast.setColor(HEX.accent).setText('Out of ink! Undo or Clear to free some up.');
        sfx.place();
        haptic(20);
        return;
      }
      this.current.push(Math.round(p.x), Math.round(p.y));
      sfx.scratch(Math.hypot(p.velocity.x, p.velocity.y));
      this.redrawInk();
      this.updateInkUi();
    });

    this.input.on('pointerup', () => this.endStroke());
  }

  private endStroke() {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.current.length >= 4) {
      // simplify before committing: fewer physics bodies, smaller payload, same shape
      const flat = simplifyStroke(this.current, 3);
      const bodies = strokeToBodies(this.matter, flat, inkStrokePhysics(this.sc.modifier));
      this.strokes.push({ flat, bodies });
      this.committedInk += strokeLength(flat);
      this.undone = []; // a fresh stroke invalidates the redo stack
    }
    this.current = [];
    this.redrawInk();
    this.updateInkUi();
  }

  private rebuildStroke(flat: number[]): Stroke {
    return { flat, bodies: strokeToBodies(this.matter, flat, inkStrokePhysics(this.sc.modifier)) };
  }

  private redrawInk() {
    this.inkGfx.clear();
    for (const s of this.strokes) drawInkStroke(this.inkGfx, s.flat, this.inkColor);
    if (this.current.length >= 4) drawInkStroke(this.inkGfx, this.current, COLORS.accent);
  }

  private updateInkUi() {
    const used = this.committedInk + (this.drawing ? strokeLength(this.current) : 0);
    const remaining = Math.max(0, this.sc.inkBudget - used);
    this.meter.set(remaining / this.sc.inkBudget);
    this.remainText.setText(
      `ink left: ${Math.round(remaining)} / ${this.sc.inkBudget}   ·   ⭐ par ${this.sc.par}`
    );
  }

  private undo() {
    if (this.state !== 'draw') return;
    const s = this.strokes.pop();
    if (!s) return;
    for (const b of s.bodies) this.matter.world.remove(b);
    this.undone.push(s.flat);
    this.committedInk = inkOfStrokes(this.strokes.map((x) => x.flat));
    this.redrawInk();
    this.updateInkUi();
  }

  private redo() {
    if (this.state !== 'draw') return;
    const flat = this.undone.pop();
    if (!flat) return;
    if (this.strokes.length >= maxStrokes(this.sc.modifier)) return;
    this.strokes.push(this.rebuildStroke(flat));
    this.committedInk = inkOfStrokes(this.strokes.map((x) => x.flat));
    this.redrawInk();
    this.updateInkUi();
  }

  private toggleErase() {
    this.eraseMode = !this.eraseMode;
    this.eraseBtn.setLabel(this.eraseMode ? '✏️ Draw' : '🧽 Erase');
    this.toast.setColor(HEX.inkSoft).setText(this.eraseMode ? 'Tap a line to erase it' : '');
  }

  /** Erase the stroke nearest the tap (within a threshold). */
  private eraseAt(x: number, y: number) {
    let bestI = -1;
    // Allow a tap roughly within half the ink thickness plus a finger-friendly margin.
    let bestD = INK_THICKNESS / 2 + 24;
    this.strokes.forEach((s, i) => {
      // measure distance to each segment, not just the sampled vertices, so tapping
      // the middle of a long straight line still registers a hit
      for (let k = 2; k < s.flat.length; k += 2) {
        const d = pointToSegmentDist(x, y, s.flat[k - 2]!, s.flat[k - 1]!, s.flat[k]!, s.flat[k + 1]!);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
    });
    if (bestI < 0) return;
    const [removed] = this.strokes.splice(bestI, 1);
    if (removed) for (const b of removed.bodies) this.matter.world.remove(b);
    this.committedInk = inkOfStrokes(this.strokes.map((x2) => x2.flat));
    sfx.place();
    this.redrawInk();
    this.updateInkUi();
  }

  private clearInk() {
    if (this.state !== 'draw') return;
    for (const s of this.strokes) for (const b of s.bodies) this.matter.world.remove(b);
    this.strokes = [];
    this.undone = [];
    this.committedInk = 0;
    this.redrawInk();
    this.updateInkUi();
  }

  /* -------------------------------- Drop ---------------------------------- */

  private drop() {
    if (this.state !== 'draw') return;
    this.state = 'dropping';
    this.matter.world.enabled = true; // ensure the win-time freeze never blocks a new drop
    this.toast.setText('');
    this.dropBtn.setEnabled(false);

    const { x, y, r } = this.sc.ball;
    this.ballBody = this.matter.add.circle(x, y, r, {
      restitution: 0.36,
      friction: 0.02,
      frictionAir: 0.004,
      density: 0.0014,
    });
    this.ballGfx = this.add
      .circle(x, y, r, this.ballColor)
      .setStrokeStyle(4, COLORS.ink, 1)
      .setDepth(4);

    this.trail = this.add
      .particles(0, 0, 'dot', {
        follow: this.ballGfx,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: this.trailColor,
        lifespan: 380,
        frequency: 24,
        quantity: 1,
      })
      .setDepth(3);

    sfx.drop();
    haptic(10);
    this.dropStart = this.time.now;
    this.stoppedMs = 0;
  }

  override update(_time: number, delta: number) {
    if (this.state !== 'dropping' || !this.ballBody || !this.ballGfx) return;

    const b = this.ballBody;
    this.ballGfx.setPosition(b.position.x, b.position.y);
    this.ballGfx.setRotation(b.angle);
    this.checkBonuses(b.position.x, b.position.y);

    if (ballInGoal(b.position.x, b.position.y, this.sc)) {
      this.win();
      return;
    }
    if (b.position.y > WORLD_H + 60) {
      this.fail('Off the edge! Adjust your ink and drop again.');
      return;
    }
    const speed = Math.hypot(b.velocity.x, b.velocity.y);
    this.stoppedMs = speed < 0.3 ? this.stoppedMs + delta : 0;
    if (this.stoppedMs > 1700) {
      this.fail('Stuck! Try a smoother ramp.');
      return;
    }
    if (this.time.now - this.dropStart > 14000) {
      this.fail('Ran out of time  tweak your ramp.');
    }
  }

  /** Mark bonus rings the ball passes through (for the 'collector' achievement). */
  private checkBonuses(bx: number, by: number) {
    const bonuses = this.sc.bonuses;
    if (!bonuses) return;
    bonuses.forEach((bonus, i) => {
      if (this.bonusHit.has(i)) return;
      if (Math.hypot(bonus.x - bx, bonus.y - by) <= bonus.r + this.sc.ball.r * 0.6) {
        this.bonusHit.add(i);
        sfx.reward();
        this.bonusGfx.fillStyle(COLORS.gold, 0.85);
        this.bonusGfx.fillCircle(bonus.x, bonus.y, bonus.r * 0.5);
        this.add
          .particles(bonus.x, bonus.y, 'spark', {
            speed: { min: 80, max: 220 },
            scale: { start: 0.4, end: 0 },
            lifespan: 500,
            quantity: 10,
            tint: COLORS.gold,
            emitting: false,
          })
          .explode(10, bonus.x, bonus.y);
      }
    });
  }

  private clearBall() {
    if (this.ballBody) this.matter.world.remove(this.ballBody);
    this.ballGfx?.destroy();
    this.trail?.destroy();
    this.ballBody = undefined;
    this.ballGfx = undefined;
    this.trail = undefined;
  }

  private fail(msg: string) {
    this.state = 'lost';
    this.clearBall();
    this.toast.setColor(HEX.accent).setText(msg);
    sfx.defeat();
    haptic(20);
    if (!prefs.reducedMotion) this.cameras.main.shake(120, 0.004);
    this.time.delayedCall(250, () => {
      this.state = 'draw';
      this.dropBtn.setEnabled(true);
    });
  }

  private win() {
    this.state = 'won';
    const b = this.ballBody!;
    const bx = b.position.x;
    const by = b.position.y;

    // freeze the world for a beat of slow-mo + juice
    this.matter.world.enabled = false;
    sfx.victory();
    haptic(30);
    if (!prefs.reducedMotion) {
      this.cameras.main.flash(180, 245, 235, 216);
      this.cameras.main.shake(160, 0.004);
      this.goalRipple(this.sc.goal.x, this.sc.goal.y);
      if (this.ballGfx) {
        this.tweens.add({ targets: this.ballGfx, scaleX: 1.35, scaleY: 0.7, duration: 120, yoyo: true });
      }
    }
    // Show the win flourish centered just below the goal (where the action ended),
    // not in the fixed control-band slot  clamped so it never enters the button band.
    const flourishY = Math.min(this.sc.goal.y + this.sc.goal.h / 2 + 36, CONTROL_TOP - 14);
    this.toast
      .setPosition(this.sc.goal.x, flourishY)
      .setDepth(8)
      .setColor(HEX.green)
      .setText(this.testMode ? 'Solvable! ✅' : 'Solved! ✒️');

    const inkUsed = inkOfStrokes(this.strokes.map((s) => s.flat));

    this.time.delayedCall(380, () => {
      this.clearBall();
      this.celebrate(bx, by);

      if (this.testMode) {
        this.registry.set('forgeSolved', true);
        if (this.sc.forgeId) {
          void net.forgeGhost(this.sc.forgeId, this.strokes.map((s) => s.flat)).catch(() => {});
        }
        this.time.delayedCall(900, () => this.scene.start(this.testReturn));
        return;
      }

      if (this.campaignLevel != null) {
        const stars = starsFor(inkUsed, this.sc.par);
        void net.campaignClear(this.campaignLevel, stars).catch(() => {});
        this.time.delayedCall(500, () => this.showCampaignWin(this.campaignLevel!, stars));
        return;
      }

      void net
        .solve({
          strokes: this.strokes.map((s) => s.flat),
          inkUsed,
          durationMs: Math.round(this.time.now - this.dropStart),
          strokeCount: this.strokes.length,
          bonusesHit: this.bonusHit.size,
        })
        .then((response) => {
          this.registry.set('lastSolve', {
            response,
            strokes: this.strokes.map((s) => s.flat),
            scene: this.sc,
            inkUsed,
          });
          // refresh cached init so the menu/leaderboard reflect the new solve
          this.registry.remove('init');
        })
        .catch((e) => console.error('solve failed', e))
        .finally(() => {
          this.time.delayedCall(900, () => this.scene.start('Result'));
        });
    });
  }

  /** Expanding ink ring at the goal on success. */
  private goalRipple(x: number, y: number) {
    const ring = this.add.circle(x, y, 10).setStrokeStyle(6, COLORS.accent, 1).setDepth(6);
    this.tweens.add({
      targets: ring,
      scale: 9,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private celebrate(x: number, y: number) {
    this.add
      .particles(x, y, 'spark', {
        speed: { min: 140, max: 420 },
        scale: { start: 0.5, end: 0 },
        lifespan: 700,
        quantity: 28,
        tint: [COLORS.accent, COLORS.gold, COLORS.blue],
        emitting: false,
      })
      .explode(28, x, y);
  }

  /** Campaign clear panel: stars + Next / Replay / Levels. */
  private showCampaignWin(level: number, stars: number) {
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;
    const last = level >= CAMPAIGN_LEVELS;

    const overlay = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.ink, 0.55);
    dim.fillRect(0, 0, WORLD_W, WORLD_H);
    overlay.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.paper, 1);
    panel.fillRoundedRect(cx - 320, cy - 250, 640, 500, 26);
    panel.lineStyle(4, COLORS.ink, 0.9);
    panel.strokeRoundedRect(cx - 320, cy - 250, 640, 500, 26);
    overlay.add(panel);

    overlay.add(
      this.add
        .text(cx, cy - 180, last ? 'Campaign Complete! 🎉' : `Level ${level} cleared!`, {
          fontFamily: FONTS.display,
          fontSize: last ? '60px' : '72px',
          color: HEX.ink,
        })
        .setOrigin(0.5)
    );
    overlay.add(starRow(this, cx, cy - 80, stars, 36));

    if (!last) {
      overlay.add(
        new Button(this, cx, cy + 30, 'Next level ▶', () => this.scene.start('Game', { campaignLevel: level + 1 }), {
          width: 360,
          height: 90,
          fontSize: 34,
        })
      );
    }
    const rowY = last ? cy + 60 : cy + 150;
    overlay.add(
      new Button(this, cx - 150, rowY, 'Replay', () => this.scene.start('Game', { campaignLevel: level }), {
        width: 270,
        height: 76,
        variant: 'ghost',
        fontSize: 28,
      })
    );
    overlay.add(
      new Button(this, cx + 150, rowY, 'Levels', () => this.scene.start('Campaign'), {
        width: 270,
        height: 76,
        variant: 'ghost',
        fontSize: 28,
      })
    );

    overlay.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: overlay, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
  }
}
