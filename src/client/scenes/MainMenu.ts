import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { WORLD_W, CAMPAIGN_LEVELS } from '../../shared/api';
import type { InitResponse } from '../../shared/api';
import { MODIFIERS } from '../../shared/modifiers';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { prefs, setColorblind, setReducedMotion, setVolume } from '../ui/prefs';
import { net } from '../net';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    fadeIn(this);
    // Browsers gate audio behind a gesture  unlock on the first tap.
    this.input.once('pointerdown', () => sfx.unlock());

    paintPaper(this, WORLD_W, this.scale.height);
    this.drawBrand();
    this.buildMuteToggle();
    this.buildSettingsButton();

    const loading = this.add
      .text(WORLD_W / 2, 720, 'loading today’s puzzle…', {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.inkSoft,
      })
      .setOrigin(0.5);

    const cached = this.registry.get('init') as InitResponse | undefined;
    if (cached) {
      loading.destroy();
      this.buildUI(cached);
    } else {
      net
        .init()
        .then((init) => {
          this.registry.set('init', init);
          loading.destroy();
          this.buildUI(init);
        })
        .catch((e) => {
          console.error(e);
          loading.setText('Could not load the puzzle.\nOpen this from an INKDROP post.').setColor(HEX.accent);
        });
    }
  }

  private buildMuteToggle() {
    const label = () => (sfx.muted ? '🔇' : '🔊');
    const btn = this.add
      .text(WORLD_W - 56, 56, label(), { fontFamily: FONTS.ui, fontSize: '40px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      sfx.unlock();
      sfx.toggleMute();
      btn.setText(label());
    });
  }

  private buildSettingsButton() {
    const btn = this.add
      .text(WORLD_W - 130, 56, '⚙️', { fontFamily: FONTS.ui, fontSize: '36px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      sfx.unlock();
      this.showSettings();
    });
  }

  private showSettings() {
    const cx = WORLD_W / 2;
    const cy = this.scale.height / 2;
    const overlay = this.add.container(0, 0).setDepth(1500);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.ink, 0.55);
    dim.fillRect(0, 0, WORLD_W, this.scale.height);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, WORLD_W, this.scale.height),
      Phaser.Geom.Rectangle.Contains
    );
    overlay.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.paper, 1);
    panel.fillRoundedRect(cx - 330, cy - 280, 660, 560, 24);
    panel.lineStyle(4, COLORS.ink, 0.9);
    panel.strokeRoundedRect(cx - 330, cy - 280, 660, 560, 24);
    overlay.add(panel);
    overlay.add(
      this.add
        .text(cx, cy - 228, 'Settings', { fontFamily: FONTS.display, fontSize: '60px', color: HEX.ink })
        .setOrigin(0.5)
    );

    // Volume
    overlay.add(
      this.add
        .text(cx - 280, cy - 135, 'Sound volume', { fontFamily: FONTS.ui, fontSize: '28px', color: HEX.ink, fontStyle: '700' })
        .setOrigin(0, 0.5)
    );
    const volTxt = this.add
      .text(cx + 150, cy - 135, `${Math.round(prefs.volume * 100)}%`, {
        fontFamily: FONTS.ui,
        fontSize: '28px',
        color: HEX.blue,
        fontStyle: '800',
      })
      .setOrigin(0.5);
    overlay.add(volTxt);
    const step = (d: number) => {
      setVolume(Math.round((prefs.volume + d) * 10) / 10);
      volTxt.setText(`${Math.round(prefs.volume * 100)}%`);
      sfx.click();
    };
    overlay.add(new Button(this, cx + 60, cy - 135, '－', () => step(-0.1), { width: 60, height: 56, variant: 'ghost', fontSize: 28 }));
    overlay.add(new Button(this, cx + 240, cy - 135, '＋', () => step(0.1), { width: 60, height: 56, variant: 'ghost', fontSize: 28 }));

    this.toggleRow(overlay, cy - 50, 'Reduced motion', prefs.reducedMotion, (on) => setReducedMotion(on));

    this.toggleRow(overlay, cy + 35, 'Colorblind palette', prefs.colorblind, (on) => {
      setColorblind(on);
      overlay.destroy();
      this.scene.restart();
    });

    this.notifyRow(overlay, cy + 120);

    overlay.add(
      this.add
        .text(cx, cy + 220, 'tap outside to close', { fontFamily: FONTS.ui, fontSize: '22px', color: HEX.inkFaint })
        .setOrigin(0.5)
    );
    dim.on('pointerdown', () => overlay.destroy());
  }

  /** Server-backed daily-reminder opt-in toggle (fetches current status lazily). */
  private notifyRow(overlay: Phaser.GameObjects.Container, y: number) {
    const cx = WORLD_W / 2;
    overlay.add(
      this.add
        .text(cx - 280, y, '🔔 Daily reminders', { fontFamily: FONTS.ui, fontSize: '28px', color: HEX.ink, fontStyle: '700' })
        .setOrigin(0, 0.5)
    );
    let on = false;
    const btn = new Button(this, cx + 200, y, '…', () => {}, {
      width: 120,
      height: 56,
      variant: 'ghost',
      fontSize: 24,
    });
    overlay.add(btn);
    void net
      .notifyStatus()
      .then((s) => {
        on = s.optedIn;
        btn.setLabel(on ? 'On' : 'Off');
      })
      .catch(() => btn.setLabel('Off'));
    btn.removeAllListeners('pointerup');
    btn.on('pointerup', () => {
      on = !on;
      sfx.click();
      btn.setLabel(on ? 'On' : 'Off');
      void net.notifyToggle(on).then((s) => {
        on = s.optedIn;
        btn.setLabel(on ? 'On' : 'Off');
      });
    });
  }

  private toggleRow(
    overlay: Phaser.GameObjects.Container,
    y: number,
    label: string,
    initial: boolean,
    onChange: (on: boolean) => void
  ) {
    const cx = WORLD_W / 2;
    overlay.add(
      this.add
        .text(cx - 280, y, label, { fontFamily: FONTS.ui, fontSize: '28px', color: HEX.ink, fontStyle: '700' })
        .setOrigin(0, 0.5)
    );
    let on = initial;
    const btn = new Button(this, cx + 200, y, on ? 'On' : 'Off', () => {}, {
      width: 120,
      height: 56,
      variant: on ? 'solid' : 'ghost',
      fontSize: 24,
    });
    // rebuild on toggle to reflect variant
    btn.removeAllListeners('pointerup');
    btn.on('pointerup', () => {
      on = !on;
      sfx.click();
      btn.setLabel(on ? 'On' : 'Off');
      onChange(on);
    });
    overlay.add(btn);
  }

  /** Title block: the wordmark and a hand-drawn ink drop. */
  private drawBrand() {
    const cx = WORLD_W / 2;

    // ink drop motif
    const g = this.add.graphics();
    g.fillStyle(COLORS.accent, 1);
    g.beginPath();
    g.moveTo(cx, 150);
    g.lineTo(cx - 46, 250);
    g.arc(cx, 250, 46, Math.PI, 0, true);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(cx - 16, 240, 12);

    this.add
      .text(cx, 360, 'INKDROP', {
        fontFamily: FONTS.display,
        fontSize: '120px',
        color: HEX.ink,
        // Caveat is a script face  pad the text bounds so Phaser doesn't clip the
        // flourish on the final glyph (otherwise the "P" renders cut off like an "F").
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 446, 'Draw the line. Guide the drop.', {
        fontFamily: FONTS.ui,
        fontSize: '30px',
        color: HEX.inkSoft,
        fontStyle: '600',
      })
      .setOrigin(0.5);
  }

  private buildUI(init: InitResponse) {
    const cx = WORLD_W / 2;
    const { scene } = init;

    // Day card  pulled up so the personal-best + twist lines below it have room
    // to sit clear of the PLAY button.
    const cardY = 560;
    const card = this.add.graphics();
    card.fillStyle(COLORS.paperEdge, 0.7);
    card.fillRoundedRect(cx - 320, cardY - 70, 640, 150, 22);
    card.lineStyle(3, COLORS.ink, 0.5);
    card.strokeRoundedRect(cx - 320, cardY - 70, 640, 150, 22);

    const author = scene.authorUsername ? `  ·  by u/${scene.authorUsername}` : '';
    this.add
      .text(cx, cardY - 30, `Day ${scene.dayNumber}: “${scene.title}”${author}`, {
        fontFamily: FONTS.ui,
        fontSize: '32px',
        color: HEX.ink,
        fontStyle: '700',
      })
      .setOrigin(0.5);

    const solvedLabel =
      init.solvedCount === 0
        ? 'Be the first to solve it!'
        : `${init.solvedCount} redditor${init.solvedCount === 1 ? '' : 's'} solved it`;
    this.add
      .text(cx, cardY + 12, solvedLabel, {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: HEX.inkSoft,
      })
      .setOrigin(0.5);

    // streak flame
    const streakTxt =
      init.streak.current > 0 ? `🔥 ${init.streak.current}-day streak` : 'Start a streak today';
    this.add
      .text(cx, cardY + 50, streakTxt, {
        fontFamily: FONTS.ui,
        fontSize: '24px',
        color: init.streak.current > 0 ? HEX.gold : HEX.inkFaint,
        fontStyle: '700',
      })
      .setOrigin(0.5);

    // Today's twist
    if (scene.modifier) {
      const info = MODIFIERS[scene.modifier];
      this.add
        .text(cx, cardY + 152, `${info.icon} Twist: ${info.name}  ${info.blurb}`, {
          fontFamily: FONTS.ui,
          fontSize: '20px',
          color: HEX.ink,
          fontStyle: '700',
          align: 'center',
          wordWrap: { width: 600 },
        })
        .setOrigin(0.5);
    }

    // Personal best line
    if (init.myBestInk !== null) {
      this.add
        .text(
          cx,
          cardY + 110,
          `Your best: ${init.myBestInk} ink` +
            (init.percentile !== null ? `  ·  less ink than ${init.percentile}% of solvers` : ''),
          { fontFamily: FONTS.ui, fontSize: '24px', color: HEX.green, fontStyle: '700' }
        )
        .setOrigin(0.5);
    }

    // Buttons  daily headline + personal campaign + everything else
    const playLabel = init.myBestInk !== null ? 'PLAY TODAY’S' : 'PLAY DAILY';
    new Button(this, cx, 796, playLabel, () => this.scene.start('Game'), {
      width: 380,
      height: 86,
      fontSize: 36,
    });

    const next = Math.min(CAMPAIGN_LEVELS, (init.campaignFurthest ?? 0) + 1);
    const done = (init.campaignFurthest ?? 0) >= CAMPAIGN_LEVELS;
    new Button(
      this,
      cx,
      890,
      done ? 'Campaign ✓  replay' : `▶ Continue · Level ${next}`,
      () => this.scene.start('Game', { campaignLevel: next }),
      { width: 380, height: 72, color: COLORS.blue, fontSize: 28 }
    );

    new Button(this, cx - 185, 978, 'Levels 1–50', () => this.scene.start('Campaign'), {
      width: 330, height: 68, variant: 'ghost', fontSize: 25,
    });
    new Button(this, cx + 185, 978, 'Leaderboard', () => this.scene.start('Leaderboard'), {
      width: 330, height: 68, variant: 'ghost', fontSize: 25,
    });
    new Button(this, cx - 185, 1054, 'Level Forge', () => this.scene.start('Forge'), {
      width: 330, height: 68, variant: 'ghost', fontSize: 25,
    });
    new Button(this, cx + 185, 1054, 'Profile', () => this.scene.start('Profile'), {
      width: 330, height: 68, variant: 'ghost', fontSize: 25,
    });
    new Button(this, cx - 185, 1130, 'Past Puzzles', () => this.scene.start('Archive'), {
      width: 330, height: 64, variant: 'ghost', fontSize: 24,
    });
    new Button(this, cx + 185, 1130, 'How to play', () => this.showHelp(), {
      width: 330, height: 64, variant: 'ghost', fontSize: 24,
    });
  }

  private showHelp() {
    const cx = WORLD_W / 2;
    const cy = this.scale.height / 2;
    const overlay = this.add.container(0, 0).setDepth(1000);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.ink, 0.55);
    dim.fillRect(0, 0, WORLD_W, this.scale.height);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, WORLD_W, this.scale.height),
      Phaser.Geom.Rectangle.Contains
    );
    overlay.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.paper, 1);
    panel.fillRoundedRect(cx - 330, cy - 280, 660, 560, 24);
    panel.lineStyle(4, COLORS.ink, 0.9);
    panel.strokeRoundedRect(cx - 330, cy - 280, 660, 560, 24);
    overlay.add(panel);

    const text = [
      'How to play',
      '',
      '• A ball drops from the top.',
      '• Drag to draw ink ramps that guide it',
      '  into the glowing goal.',
      '• You have a limited ink budget ',
      '  the less ink you use, the higher you rank.',
      '',
      '• Solve the daily puzzle to grow your streak.',
      '• Build your own level in the Forge ',
      '  top-voted levels become a daily puzzle!',
      '',
      'Tap anywhere to close.',
    ].join('\n');
    const t = this.add
      .text(cx, cy - 240, text, {
        fontFamily: FONTS.ui,
        fontSize: '27px',
        color: HEX.ink,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);
    overlay.add(t);

    dim.on('pointerdown', () => overlay.destroy());
  }
}
