/**
 * Shared domain + API types for INKDROP.
 * Used by both the Phaser client and the Hono server for end-to-end safety.
 *
 * The world is a fixed virtual portrait space (see WORLD_W / WORLD_H) that the
 * client scales to fit any viewport. All scene coordinates are in this space.
 */

export const WORLD_W = 800;
export const WORLD_H = 1200;

/** Votes a community level needs before it can be promoted to a daily puzzle. */
export const FORGE_PROMOTE_VOTES = 3;

/** A single obstacle in a scene. Coordinates are centre-based, in world units. */
export type Obstacle =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; angle?: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'spinner'; x: number; y: number; w: number; h: number };

/** A playable puzzle. Deterministically generated per-day, or authored in the Forge. */
export type Scene = {
  /** Stable id for the day this scene is live, e.g. "2026-06-20". */
  dayId: string;
  /** Day number since launch, for display ("Day 47"). */
  dayNumber: number;
  /** PRNG seed used to generate this scene (0 for authored levels). */
  seed: number;
  /** Ball spawn (centre) + radius. */
  ball: { x: number; y: number; r: number };
  /** Goal zone (centre + size). Ball must enter this to win. */
  goal: { x: number; y: number; w: number; h: number };
  obstacles: Obstacle[];
  /** Total ink (in world-pixels of stroke length) the player may draw. */
  inkBudget: number;
  /** A "good" ink target used for the star rating. */
  par: number;
  /** Short flavour title. */
  title: string;
  /** Optional daily "twist" mutator. */
  modifier?: import('./modifiers').Modifier;
  /** Optional bonus rings to thread through for a perfect run. */
  bonuses?: { x: number; y: number; r: number }[];
  /** Set when this scene comes from a community-authored Forge level. */
  authorUsername?: string;
  /** Forge level id, when applicable. */
  forgeId?: string;
};

/** A player's drawn solution. Strokes are flattened [x0,y0,x1,y1,...] int arrays. */
export type Solution = {
  strokes: number[][];
  inkUsed: number;
  durationMs: number;
  strokeCount: number;
  /** How many bonus rings the ball passed through (for the 'collector' achievement). */
  bonusesHit?: number;
};

/** A leaderboard row. `score` is ink (today), or solve-count (week / all-time). */
export type RankRow = {
  username: string;
  score: number;
  rank: number;
};

export type LeaderboardScope = 'today' | 'week' | 'alltime';

/** Streak state for the current user. */
export type Streak = {
  current: number;
  best: number;
};

/** GET /api/init */
export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  scene: Scene;
  /** Player's best ink for this scene, or null if not solved yet. */
  myBestInk: number | null;
  myRank: number | null;
  percentile: number | null;
  solvedCount: number;
  streak: Streak;
  /** True if this post is the live "today" post. */
  isToday: boolean;
  /** Cosmetic ids the player currently has equipped. */
  equipped: EquippedCosmetics;
  /** Highest campaign level the player has cleared (0 = none). */
  campaignFurthest: number;
};

export type EquippedCosmetics = { ink: string; ball: string; trail: string };

/** POST /api/solve */
export type SolveRequest = Solution;

export type SolveResponse = {
  type: 'solve';
  /** True if this run improved the player's stored best. */
  improved: boolean;
  myBestInk: number;
  rank: number;
  total: number;
  percentile: number;
  stars: number;
  streak: Streak;
  /** First solve of this scene by this user. */
  firstSolve: boolean;
  /** Achievement ids newly earned by this solve. */
  newAchievements: string[];
  /** Cosmetic ids newly unlocked by this solve. */
  newCosmetics: string[];
};

/* ------------------------------ Profile / cosmetics ------------------------------ */

/** GET /api/profile */
export type ProfileResponse = {
  type: 'profile';
  username: string;
  equipped: EquippedCosmetics;
  unlockedCosmetics: string[];
  achievements: string[];
  solves: number;
  streak: Streak;
  freezeTokens: number;
};

export type EquipRequest = { kind: 'ink' | 'ball' | 'trail'; id: string };

export type EquipResponse = {
  type: 'equip';
  equipped: EquippedCosmetics;
};

/* --------------------------------- Campaign --------------------------------- */

/** Total levels in the personal campaign. */
export const CAMPAIGN_LEVELS = 50;

/** GET /api/campaign  personal progression through the level curve. */
export type CampaignResponse = {
  type: 'campaign';
  furthest: number; // highest level cleared (0 = none)
  stars: Record<string, number>; // level -> best stars
};

export type CampaignClearRequest = { level: number; stars: number };
export type CampaignClearResponse = { type: 'campaign-clear'; furthest: number };

/** GET /api/ghosts?limit= */
export type GhostsResponse = {
  type: 'ghosts';
  ghosts: { username: string; inkUsed: number; strokes: number[][] }[];
};

/** GET /api/leaderboard?scope=&limit= */
export type LeaderboardResponse = {
  type: 'leaderboard';
  scope: LeaderboardScope;
  unit: string; // 'ink' | 'days' | 'solves'
  lowerIsBetter: boolean;
  rows: RankRow[];
  total: number;
  myRank: number | null;
  myScore: number | null;
};

/** GET /api/archive  past daily puzzles, newest first (for practice replay). */
export type ArchiveResponse = {
  type: 'archive';
  days: Scene[];
};

/** GET /api/distribution  histogram of today's ink scores. */
export type DistributionResponse = {
  type: 'distribution';
  counts: number[];
  binMin: number;
  binSize: number;
  total: number;
  myInk: number | null;
};

/* ----------------------------- Level Forge (UGC) ----------------------------- */

/** A community-authored level. */
export type ForgeLevel = {
  id: string;
  authorUsername: string;
  title: string;
  ball: Scene['ball'];
  goal: Scene['goal'];
  obstacles: Obstacle[];
  inkBudget: number;
  createdAt: number;
  votes: number;
  /** 'queued' once promoted to become a future daily, 'used' after it ran. */
  status: 'live' | 'queued' | 'used';
};

export type ForgeSubmitRequest = {
  title: string;
  ball: Scene['ball'];
  goal: Scene['goal'];
  obstacles: Obstacle[];
  inkBudget: number;
};

export type ForgeSubmitResponse = {
  type: 'forge-submit';
  id: string;
};

export type ForgeListResponse = {
  type: 'forge-list';
  levels: ForgeLevel[];
  myVotes: string[];
};

export type ForgeVoteResponse = {
  type: 'forge-vote';
  id: string;
  votes: number;
  voted: boolean;
};

export type ForgeSort = 'top' | 'new';

export type ForgeReportResponse = {
  type: 'forge-report';
  id: string;
  reports: number;
  hidden: boolean;
};

/** GET /api/forge/ghosts?forgeId=  sampled solutions to a community level. */
export type ForgeGhostsResponse = { type: 'forge-ghosts'; ghosts: number[][][] };

/** POST /api/share  posts the player's result as a comment on the current post. */
export type ShareRequest = { text: string };
export type ShareResponse = { type: 'share'; ok: boolean };

/** POST /api/presence  heartbeat; returns how many redditors are on this puzzle now. */
export type PresenceResponse = { type: 'presence'; count: number };

/** Daily-reminder opt-in status. */
export type NotifyStatusResponse = { type: 'notify'; optedIn: boolean };
/** Realtime message broadcast on the `presence:<postId>` channel. */
export type PresenceMessage = { count: number };

export type ErrorResponse = {
  status: 'error';
  message: string;
};

/** Compute star rating (1-3) from ink used vs the scene par. */
export function starsFor(inkUsed: number, par: number): number {
  if (inkUsed <= par) return 3;
  if (inkUsed <= par * 1.4) return 2;
  return 1;
}

/** Total length of one flattened [x0,y0,x1,y1,...] stroke, in world units. */
export function strokeLength(flat: number[]): number {
  let len = 0;
  for (let i = 2; i < flat.length; i += 2) {
    len += Math.hypot(flat[i]! - flat[i - 2]!, flat[i + 1]! - flat[i - 1]!);
  }
  return len;
}

/** Total ink across all strokes. Used client-side (meter) and server-side (anti-spoof). */
export function inkOfStrokes(strokes: number[][]): number {
  let total = 0;
  for (const s of strokes) total += strokeLength(s);
  return Math.round(total);
}
