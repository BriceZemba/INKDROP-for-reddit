import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import { WORLD_W, WORLD_H, type EquippedCosmetics, type ProfileResponse } from '../../shared/api';
import { COSMETICS, type Cosmetic, type CosmeticKind } from '../../shared/cosmetics';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { COLORS, HEX, FONTS } from '../style/theme';
import { Button, paintPaper } from '../ui/widgets';
import { fadeIn } from '../ui/transition';
import { sfx } from '../audio/sfx';
import { net } from '../net';

export class Profile extends Scene {
  private unlocked = new Set<string>();
  private earned = new Set<string>();
  private equipped: EquippedCosmetics = { ink: '', ball: '', trail: '' };
  private rings = new Map<string, Phaser.GameObjects.Arc>();
  private caption!: Phaser.GameObjects.Text;

  constructor() {
    super('Profile');
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
      .text(cx, 56, 'Profile', { fontFamily: FONTS.display, fontSize: '64px', color: HEX.ink, padding: { x: 14 } })
      .setOrigin(0.5);

    const loading = this.add
      .text(cx, 600, 'loading…', { fontFamily: FONTS.ui, fontSize: '26px', color: HEX.inkFaint })
      .setOrigin(0.5);

    void net
      .profile()
      .then((p) => {
        loading.destroy();
        this.render(p);
      })
      .catch(() => loading.setText('Could not load profile.').setColor(HEX.accent));
  }

  private render(p: ProfileResponse) {
    const cx = WORLD_W / 2;
    this.unlocked = new Set(p.unlockedCosmetics);
    this.earned = new Set(p.achievements);
    this.equipped = p.equipped;

    this.add
      .text(
        cx,
        128,
        `🔥 ${p.streak.current}-day streak (best ${p.streak.best})   ·   ❄️ ${p.freezeTokens} freeze   ·   ${p.solves} solved`,
        { fontFamily: FONTS.ui, fontSize: '24px', color: HEX.inkSoft, fontStyle: '600' }
      )
      .setOrigin(0.5);

    this.row('Ink', 'ink', 210);
    this.row('Ball', 'ball', 330);
    this.row('Trail', 'trail', 450);

    this.add
      .text(cx, 560, 'Achievements', { fontFamily: FONTS.display, fontSize: '46px', color: HEX.ink })
      .setOrigin(0.5);
    this.achievementGrid(620);

    this.caption = this.add
      .text(cx, WORLD_H - 60, 'Tap a locked item to see how to unlock it.', {
        fontFamily: FONTS.ui,
        fontSize: '22px',
        color: HEX.inkFaint,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private row(label: string, kind: CosmeticKind, y: number) {
    const items = COSMETICS.filter((c) => c.kind === kind);
    this.add.text(60, y - 34, label, {
      fontFamily: FONTS.ui,
      fontSize: '26px',
      color: HEX.inkSoft,
      fontStyle: '800',
    });
    const gap = (WORLD_W - 120) / items.length;
    items.forEach((c, i) => {
      const x = 60 + gap * (i + 0.5);
      this.swatch(c, x, y + 20);
    });
  }

  private swatch(c: Cosmetic, x: number, y: number) {
    const owned = this.unlocked.has(c.id);
    const dot = this.add.circle(x, y, 30, c.color).setStrokeStyle(3, COLORS.ink, 0.9);
    if (!owned) dot.setAlpha(0.28);

    const ring = this.add.circle(x, y, 40).setStrokeStyle(5, COLORS.gold, 1);
    ring.setVisible(this.equipped[c.kind] === c.id);
    this.rings.set(c.id, ring);

    if (!owned) {
      this.add.text(x, y, '🔒', { fontSize: '26px' }).setOrigin(0.5);
    }

    dot.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!owned) {
        this.caption.setText(`Locked — ${this.unlockText(c)}`).setColor(HEX.accent);
        return;
      }
      this.equip(c.kind, c.id);
    });
  }

  private equip(kind: CosmeticKind, id: string) {
    void net
      .equip({ kind, id })
      .then((res) => {
        this.equipped = res.equipped;
        // refresh rings for this kind
        for (const c of COSMETICS.filter((x) => x.kind === kind)) {
          this.rings.get(c.id)?.setVisible(res.equipped[kind] === c.id);
        }
        // cached init drives in-game colours; force a refresh next load
        this.registry.remove('init');
        sfx.reward();
        showToast('Equipped!');
      })
      .catch(() => showToast('Could not equip.'));
  }

  private unlockText(c: Cosmetic): string {
    switch (c.unlock.type) {
      case 'streak':
        return `reach a ${c.unlock.n}-day streak`;
      case 'solves':
        return `solve ${c.unlock.n} puzzles`;
      case 'achievement': {
        const a = ACHIEVEMENTS.find((x) => x.id === (c.unlock as { id: string }).id);
        return `earn “${a?.name ?? 'an achievement'}”`;
      }
      default:
        return 'unlock by playing';
    }
  }

  private achievementGrid(top: number) {
    const cols = 3;
    const cellW = (WORLD_W - 80) / cols;
    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % cols;
      const rowI = Math.floor(i / cols);
      const x = 40 + cellW * (col + 0.5);
      const y = top + rowI * 96;
      const got = this.earned.has(a.id);
      const icon = this.add
        .text(x, y, a.icon, { fontSize: '40px' })
        .setOrigin(0.5)
        .setAlpha(got ? 1 : 0.25);
      this.add
        .text(x, y + 34, a.name, {
          fontFamily: FONTS.ui,
          fontSize: '18px',
          color: got ? HEX.ink : HEX.inkFaint,
          fontStyle: '700',
        })
        .setOrigin(0.5);
      icon
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () =>
          this.caption.setText(`${a.icon} ${a.name} — ${a.desc}`).setColor(got ? HEX.green : HEX.inkSoft)
        );
    });
  }
}
