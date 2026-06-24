/** Achievement catalog  shared by server (granting) and client (display). */

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  icon: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-solve', name: 'First Drop', desc: 'Solve your first puzzle', icon: '✒️' },
  { id: 'three-star', name: 'Flawless', desc: 'Earn 3 stars on a puzzle', icon: '⭐' },
  { id: 'one-stroke', name: 'Single Stroke', desc: 'Solve with a single line', icon: '➰' },
  { id: 'streak-3', name: 'Habit Forming', desc: 'Reach a 3-day streak', icon: '🔥' },
  { id: 'streak-7', name: 'Dedicated', desc: 'Reach a 7-day streak', icon: '🔥' },
  { id: 'top-10', name: 'Sharpshooter', desc: 'Finish in the top 10% of a day', icon: '🎯' },
  { id: 'collector', name: 'Collector', desc: 'Grab every bonus ring in one run', icon: '💎' },
  { id: 'solves-10', name: 'Regular', desc: 'Solve 10 puzzles', icon: '📅' },
  { id: 'forge-author', name: 'Architect', desc: 'Submit a Forge level', icon: '🏗️' },
  { id: 'forge-vote', name: 'Tastemaker', desc: 'Vote on a community level', icon: '🗳️' },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export function achievementById(id: string): Achievement | undefined {
  return BY_ID.get(id);
}
