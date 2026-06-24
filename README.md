# INKDROP ✒️

A daily **draw-the-ramp physics puzzle** for Reddit, built on **Devvit Web** with
**Phaser 4 + Matter.js**. One scene per day for the whole subreddit: a ball drops, you
sketch an ink line with a limited budget to guide it into the goal, and you're ranked by
**how little ink you used** against everyone else — with streaks, ghost replays, and a
community **Level Forge** whose top-voted level becomes a future daily.

Built for **Reddit's Games with a Hook Hackathon** (Jun 17 – Jul 15, 2026).

> 📤 **To deploy & submit:** follow [`show me how to submit.md`](show%20me%20how%20to%20submit.md).
> 🎯 **Why it's built to win:** see [`perspective.md`](perspective.md).

---

## Quick start

```bash
npm install
npm run login                         # authorize the Devvit CLI (one time)
npx devvit playtest r/YourSubreddit   # live dev build on your subreddit
```
Open the auto-created post in your subreddit and press **Play today's drop**.

## Scripts

| Command | Does |
|---|---|
| `npm run type-check` | TypeScript (`tsc --build`). |
| `npm run lint` | ESLint. |
| `npm run test` | Unit tests (vitest). `npm run test -- verify` filters by file. |
| `npm run build` | Production client + server bundle → `dist/`. |
| `npm run deploy` | type-check + lint + `devvit upload`. |
| `npm run launch` | `deploy` + `devvit publish` (submit app for review). |

## How it plays

- **Daily puzzle** — the same scene for everyone, posted automatically each day, on a
  **50-level difficulty curve** that ramps from a gentle Day 1 to a near-impossible Day 50.
- **Two ways to play** — the shared **Daily** (everyone competes on the same puzzle) and a
  personal **Campaign** (progress through levels 1→50 at your own pace, with a Continue button,
  a level-select grid, and per-level stars).
- **Draw ink** — drag to draw ramps; a budget meter limits total length. A first-run tutorial
  teaches the gesture; sound + haptics + slow-mo make it feel good.
- **Drop** — Matter.js simulates the ball through your ink, obstacles, and the goal.
- **Rank** — lowest ink wins; percentile, stars, and a daily leaderboard (+ **weekly** and
  **all-time** consistency boards).
- **Streaks** — solve the live daily to keep your streak alive; earn **streak-freeze** tokens
  so one missed day doesn't reset you.
- **Ghosts** — watch other redditors' lines fade in on the result screen.
- **Achievements & cosmetics** — unlock ink colours, ball skins, and trail tints through play.
- **Level Forge** — design a puzzle (move/rotate/resize pieces, must solve it yourself to
  submit), the community votes & reports, and the top level becomes a daily (credited to you).
- **Past Puzzles** — replay any previous day for practice.
- **Reddit-y** — share your result to the comments, auto-posted recaps, and post/user flair.
- **Live presence** — a “👁 N here now” pulse (Devvit realtime) shows who else is playing.
- **Daily twists** — some days roll a modifier (low gravity, one stroke, bouncy ink…); thread
  bonus rings for the Collector badge; eraser + redo while drawing.
- **Accessibility** — Settings for sound volume, reduced motion, and a colorblind-safe palette.
- **Daily reminders** — opt-in push notification when a new puzzle drops, plus a weekly
  Featured Level post and community-level ghosts.
- **Fair play & scale** — solutions are re-simulated server-side to reject fakes; strokes are
  simplified, per-day keys expire, and write endpoints are rate-limited.

## Project layout

```
src/
  shared/        # types, daily-scene generator + Day 1-7 campaign, cosmetics, achievements
  server/        # Hono + Devvit Web: routes (api, forge, profile, menu, triggers, scheduler)
    core/        #   daily lifecycle, ranking/streaks/weekly, forge/UGC, profile, verify (anti-cheat)
  client/        # Phaser game
    scenes/      #   Boot, Preloader, MainMenu, Game, Result, Leaderboard, Forge,
                 #   ForgeBrowse, Profile, Archive
    play/        #   engine.ts — shared physics + rendering
    audio/       #   procedural Web Audio SFX
    ui/, style/  #   widgets, transitions, hand-drawn theme
    splash.*     #   lightweight inline feed card
devvit.json      # Devvit Web config: post entrypoints, permissions, menu, scheduler, triggers
```

## Tech

Devvit Web (`@devvit/web` 0.12) · Phaser 4 (Matter physics) · matter-js (server-side replay) ·
Web Audio · TypeScript · Vite · Hono · Redis.

> `tools/preview/`, `vite.preview.config.ts`, and `.claude/launch.json` are a local visual
> test harness only — they mock the server so the game runs in a plain browser. Not shipped.
