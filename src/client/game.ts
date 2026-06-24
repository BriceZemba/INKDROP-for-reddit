import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { WORLD_W, WORLD_H } from '../shared/api';
import { COLORS } from './style/theme';
import { applyPrefs } from './ui/prefs';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game as PlayScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Leaderboard } from './scenes/Leaderboard';
import { Forge } from './scenes/Forge';
import { ForgeBrowse } from './scenes/ForgeBrowse';
import { Profile } from './scenes/Profile';
import { Archive } from './scenes/Archive';
import { Campaign } from './scenes/Campaign';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: COLORS.paperEdge,
  // Fixed portrait play space, scaled to fit any viewport (mobile-first).
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: WORLD_W,
    height: WORLD_H,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false,
    },
  },
  scene: [Boot, Preloader, MainMenu, PlayScene, Result, Leaderboard, Forge, ForgeBrowse, Profile, Archive, Campaign],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

document.addEventListener('DOMContentLoaded', () => {
  applyPrefs(); // volume + colorblind palette before any scene draws
  StartGame('game-container');
});
