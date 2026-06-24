// Visual-verification harness: mocks the server API and boots the real game so
// we can screenshot actual Phaser rendering/physics. Not part of the shipped app.
import * as Phaser from 'phaser';
import { AUTO } from 'phaser';
import {
  WORLD_W,
  WORLD_H,
  type InitResponse,
  type SolveResponse,
} from '../../src/shared/api';
import { generateScene } from '../../src/shared/scenes';
import { COLORS } from '../../src/client/style/theme';
import { Boot } from '../../src/client/scenes/Boot';
import { Preloader } from '../../src/client/scenes/Preloader';
import { MainMenu } from '../../src/client/scenes/MainMenu';
import { Game as PlayScene } from '../../src/client/scenes/Game';
import { Result } from '../../src/client/scenes/Result';
import { Leaderboard } from '../../src/client/scenes/Leaderboard';
import { Forge } from '../../src/client/scenes/Forge';
import { ForgeBrowse } from '../../src/client/scenes/ForgeBrowse';
import { Profile } from '../../src/client/scenes/Profile';
import { Archive } from '../../src/client/scenes/Archive';
import { Campaign } from '../../src/client/scenes/Campaign';

const scene = generateScene(3, '2026-06-20');

const init: InitResponse = {
  type: 'init',
  postId: 't3_demo',
  username: 'tester',
  scene,
  myBestInk: 612,
  myRank: 4,
  percentile: 73,
  solvedCount: 128,
  streak: { current: 6, best: 9 },
  isToday: true,
  equipped: { ink: 'ink-blue', ball: 'ball-vermillion', trail: 'trail-blue' },
  campaignFurthest: 7,
};

const solve: SolveResponse = {
  type: 'solve',
  improved: true,
  myBestInk: 540,
  rank: 3,
  total: 129,
  percentile: 87,
  stars: 3,
  streak: { current: 7, best: 9 },
  firstSolve: true,
  newAchievements: ['three-star', 'streak-7'],
  newCosmetics: ['ink-gold'],
};

const profile = {
  type: 'profile',
  username: 'tester',
  equipped: { ink: 'ink-blue', ball: 'ball-vermillion', trail: 'trail-blue' },
  unlockedCosmetics: ['ink-blue', 'ink-charcoal', 'ink-vermillion', 'ball-vermillion', 'ball-ink', 'ball-sky', 'trail-blue'],
  achievements: ['first-solve', 'three-star', 'forge-author'],
  solves: 7,
  streak: { current: 6, best: 9 },
  freezeTokens: 1,
};

const ghosts = {
  type: 'ghosts',
  ghosts: [
    { username: 'a', inkUsed: 480, strokes: [[200, 300, 400, 520, 560, 1040]] },
    { username: 'b', inkUsed: 640, strokes: [[180, 280, 360, 600, 540, 1040]] },
    { username: 'c', inkUsed: 720, strokes: [[220, 320, 300, 700, 520, 1050]] },
  ],
};

const leaderboard = {
  type: 'leaderboard',
  scope: 'today',
  unit: 'ink',
  lowerIsBetter: true,
  rows: [
    { username: 'inkmaster', score: 410, rank: 1 },
    { username: 'dropguru', score: 455, rank: 2 },
    { username: 'tester', score: 540, rank: 3 },
    { username: 'curvy', score: 602, rank: 4 },
  ],
  total: 129,
  myRank: 3,
  myScore: 540,
};

const archive = {
  type: 'archive',
  days: [
    generateScene(1, '2026-06-17'),
    generateScene(2, '2026-06-18'),
    generateScene(4, '2026-06-21'),
    generateScene(5, '2026-06-22'),
    generateScene(6, '2026-06-23'),
  ],
};

const forgeList = {
  type: 'forge-list',
  levels: [
    {
      id: 'x1',
      authorUsername: 'builder',
      title: 'The Spiral',
      ball: scene.ball,
      goal: scene.goal,
      obstacles: scene.obstacles,
      inkBudget: 1200,
      createdAt: Date.now(),
      votes: 5,
      status: 'live',
    },
  ],
  myVotes: [],
};

function pick(url: string): unknown {
  if (url.includes('/api/init')) return init;
  if (url.includes('/api/solve')) return solve;
  if (url.includes('/api/ghosts')) return ghosts;
  if (url.includes('/api/distribution'))
    return { type: 'distribution', counts: [1, 3, 6, 9, 7, 4, 2, 1, 1, 0], binMin: 400, binSize: 30, total: 34, myInk: 540 };
  if (url.includes('/api/archive')) return archive;
  if (url.includes('/api/leaderboard')) return leaderboard;
  if (url.includes('/api/forge/list')) return forgeList;
  if (url.includes('/api/forge/vote')) return { type: 'forge-vote', id: 'x1', votes: 6, voted: true };
  if (url.includes('/api/forge/submit')) return { type: 'forge-submit', id: 'new' };
  if (url.includes('/api/profile/equip')) return { type: 'equip', equipped: profile.equipped };
  if (url.includes('/api/profile')) return profile;
  if (url.includes('/api/forge/report')) return { type: 'forge-report', id: 'x1', reports: 1, hidden: false };
  if (url.includes('/api/forge/ghosts')) return { type: 'forge-ghosts', ghosts: [[[220, 320, 400, 560, 540, 1040]]] };
  if (url.includes('/api/forge/ghost')) return { ok: true };
  if (url.includes('/api/share')) return { type: 'share', ok: true };
  if (url.includes('/api/presence')) return { type: 'presence', count: 4 };
  if (url.includes('/api/notify/toggle')) return { type: 'notify', optedIn: true };
  if (url.includes('/api/notify')) return { type: 'notify', optedIn: false };
  if (url.includes('/api/campaign/clear')) return { type: 'campaign-clear', furthest: 8 };
  if (url.includes('/api/campaign'))
    return { type: 'campaign', furthest: 7, stars: { '1': 3, '2': 3, '3': 2, '4': 3, '5': 2, '6': 1, '7': 2 } };
  return {};
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/')) {
    return new Response(JSON.stringify(pick(url)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo, _init);
};

const game = new Phaser.Game({
  type: AUTO,
  parent: 'game-container',
  backgroundColor: COLORS.paperEdge,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER, width: WORLD_W, height: WORLD_H },
  physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 }, debug: false } },
  scene: [Boot, Preloader, MainMenu, PlayScene, Result, Leaderboard, Forge, ForgeBrowse, Profile, Archive, Campaign],
});

// expose helpers for the screenshot driver
type W = typeof window & {
  __game: Phaser.Game;
  __goto: (k: string) => Promise<void>;
  __result: () => void;
};
const w = window as W;
w.__game = game;
w.__goto = async (k: string) => {
  game.registry.set('init', init);
  game.scene.start(k);
};
w.__result = () => {
  game.registry.set('lastSolve', {
    response: solve,
    strokes: [[scene.ball.x, scene.ball.y, 360, 600, scene.goal.x, scene.goal.y]],
    scene,
    inkUsed: 540,
  });
  game.scene.start('Result');
};
