# 🎯 INKDROP  Perspective & Strategy

> Why this game, why it fits *Reddit's Games with a Hook*, and how it's built to win.

---

## The one-line pitch

**INKDROP** is a daily *draw-the-ramp* physics puzzle. Every day the whole subreddit
gets **one** scene  a ball drops from the top; you draw an ink line with a limited
budget to guide it into the goal. Your solution is ranked by **percentile across the
entire community** ("less ink than 87% of solvers"), you keep a **streak**, you watch
**ghost replays** of everyone else's lines, and in the **Level Forge** you design your
own puzzles  the top-voted community level *becomes a future daily*, credited to its
creator.

It's one tight idea that hits **all three sub-awards at once** (Retention, User
Contributions, Phaser) without doing three half-baked things.

---

## How it scores against the official criteria

### Delightful UX
- A **fixed portrait play space scaled to fit any viewport** (Phaser `Scale.FIT`)  it's
  mobile-first and never needs scrolling. Big touch targets, large DROP button.
- One cohesive **hand-drawn ink-on-warm-paper identity**: a single vermillion accent, a
  cursive wordmark, rounded ink-outlined UI. Not a stock gradient or default font in sight.
- The whole game is one verb  *draw*  so a new player gets it in seconds. The **How to
  play** card spells it out, but most people won't need it.

### Polish
- Launch-ready: clean `type-check`, `lint`, and `build`; no console errors across a full
  session (menu → draw → physics → win **and** fail → result → leaderboard → forge).
- Fail states are forgiving: miss the goal and your ink stays so you can tweak and re-drop.
- Server recomputes ink from the submitted strokes (anti-spoof), validates Forge levels,
  and dedupes votes  it behaves under abuse, not just on the happy path.

### Reddit-y (community-first, *not* "about Reddit")
- It's about **shared play and creative expression**, the spirit of Reddit  never Snoo/karma cosplay.
- Uses the real community surfaces: a **daily auto-post** that surfaces in the feed, a pinned
  **"yesterday's top solvers" recap comment**, **share-to-comment** of your result, **ghost
  replays** of fellow redditors, and **`by u/<creator>` attribution** on community levels.
- The feed card itself (the inline splash) shows **live** "Day N · N solved today · keep your
  streak" so the post is enticing before anyone even opens it.

### Hook-y (the actual point of the hackathon)
Multiple, reinforcing reasons to come back **tomorrow**:
- **A new puzzle every day**, posted automatically by the scheduler (12:00 UTC).
- **Streaks** that only advance on the live daily  miss a day and it resets, so there's
  loss-aversion pulling you back.
- **Percentile + leaderboard**: "less ink than 73%" is an itch to improve; you can re-solve
  to climb, and you compare against an ever-growing field.
- **Anticipation of community content**: your Forge level might become tomorrow's daily.
- **Ghosts**: seeing cleverer lines than yours makes you want one more attempt.

### Phaser Innovation
The game *is* a Phaser showcase, not a UI with a logo dropped on it:
- **Freehand vector ink-drawing** sampled into a chain of **Matter.js** capsule bodies, so
  your line is real physics geometry the ball rolls/bounces along.
- A deterministic **Matter** simulation (ball, walls, angled bars, circular pegs), with
  juice: ball trail particles, success burst, camera flash + shake, and **translucent ghost
  replays** that animate in.
- Everything  backgrounds, buttons, meters, stars, obstacles, the goal  is drawn with
  Phaser `Graphics`, so it's crisp at any scale with zero image assets to load.

---

## Why it's *not* "AI slop" or an overdone idea

The brief explicitly warns against space shooters, clones, simple platformers, collaborative
storytelling, and trivia  and against games that *look* AI-generated. INKDROP is:
- **A genre they didn't list**  a daily, community-scored *line-drawing* physics puzzle.
- **Visually intentional**  a hand-drawn identity that fits the viewport, with its own brand.
- **Human-first**  built around player *expression* (every solution is a little drawing) and
  *contribution* (players literally make the content), which is what "Reddit-y" actually means.

It rhymes with what already works on Reddit (the physics + daily + community-leaderboard DNA
of r/bunnytrials, r/bridgedit, r/hotandcold, r/dailyguess) **without cloning any of them.**

---

## The retention loop, drawn out

```
        ┌──────────────────────────────────────────────┐
        │  Feed card: "Day N · 128 solved · 🔥 streak"  │
        └───────────────┬──────────────────────────────┘
                        │ tap
                        ▼
   draw ink ramp ──► DROP ──► solve ──► percentile + stars + ghosts
                        │                         │
                        │                    share to comments
                        ▼                         │
              streak +1, leaderboard      ◄───────┘
                        │
        ┌───────────────┴───────────────┐
        │  Forge a level → community     │
        │  votes → top level becomes a   │
        │  future daily (you're credited)│
        └───────────────┬───────────────┘
                        ▼
        Scheduler posts tomorrow's puzzle + recap comment
                        ▼
                 (come back tomorrow)
```

The Forge closes the loop: **players generate the very content that keeps the daily fresh**,
so the game can run  and keep people returning  without the developer hand-authoring levels forever.

---

## Architecture at a glance (so judges/teammates can trust the polish)

- **Client:** Phaser 4 + Vite + TypeScript. Scenes: `Boot → Preloader → MainMenu → Game →
  Result → Leaderboard → Forge → ForgeBrowse`. Shared play logic in `client/play/engine.ts`.
- **Server:** Hono on Devvit Web. Routes for `/api/init|solve|ghosts|leaderboard` and
  `/api/forge/*`, plus internal `menu`, `triggers`, `scheduler`.
- **State:** Redis  sorted sets for per-day leaderboards (lowest ink = rank 0), hashes for
  streaks, ghost storage (downsampled strokes), and the Forge (levels, votes, promotion queue).
- **Daily engine:** `shared/scenes.ts` deterministically generates each day's puzzle from a
  seed, so everyone competes on an identical board; `server/core/daily.ts` handles per-community
  day numbering, the scheduler rollover, and auto-posting.
- **Fairness/integrity:** ink is recomputed server-side from the strokes; one vote per user per
  level; Forge levels are bounds-validated before storage.

---

## Honest risks & how they're mitigated

| Risk | Mitigation |
|---|---|
| Empty leaderboard/Forge on judging day | Seed it: solve the daily + submit one level before sharing the demo (see submit guide). |
| Physics feels too hard/easy | Difficulty curve is gentle early (`generateScene` scales by day); ink budget is generous; fail keeps your ink so iteration is cheap. |
| Cursive font not loading on a device | Falls back through a stack of system "handwriting" fonts; the ink strokes carry the identity regardless. |
| Cold-start (day 1 of a new community) | Each community starts at its own "Day 1" on install, so it never looks abandoned. |
| Scheduler timing | Mod menu "Advance day" lets you demonstrate the daily + recap instantly. |

---

## Post-hackathon roadmap (shows it's a real product, not a demo)

- **Weekly "Director's Cut"** post compiling the best community level of the week.
- **Replay scrubber** + "beat this ghost" challenges between specific users.
- **Themed weeks / seasons**, badge flair for streak milestones (7/30/100 days).
- **Daily "fewest strokes" vs "least ink" dual leaderboards** for variety.
- **Spectator predictions** ("will u/x's line clear it?") for non-drawers.

---

## Polish pass  what was added to deepen each award

A second build pass layered on substantial depth, mapped to the judging criteria:

**Delightful UX / Polish**
- **Procedural Web Audio SFX** (pencil scratch, ball drop/roll, success/fail chimes, UI taps) +
  a mute toggle + mobile **haptics**  zero audio asset files, nothing to license.
- **Game feel:** slow-mo freeze on the goal moment, success flash/shake, an expanding ink
  ripple, ball squash, and gentle paper **fade transitions** between every screen.
- An **interactive first-run tutorial** (animated drag gesture) and **par shown on the HUD**.

**Hook-y / Best Retention**
- A **50-level difficulty curve** that ramps monotonically from a gentle Day 1 to a
  near-impossible Day 50 (more obstacles, narrower goal, tighter ink, harsher twists).
- **Victory / defeat music stingers** (procedural), forgiving button hit areas, and a
  reserved control band so the puzzle never overlaps the controls.
- **Two complementary modes.** The shared **Daily** carries the community/feed hooks (same
  puzzle for everyone, leaderboards, ghosts, comments, a fresh post each day). A personal
  **Campaign** (1→50, Continue button + level-select grid + per-level stars, server-saved,
  cleared strictly in sequence) gives self-paced onboarding and a binge track  so new players
  always have a gentle ramp regardless of which calendar day they join.
- **Achievements** (9) and **cosmetic unlocks**  ink colours, ball skins, trail tints  earned
  through streaks, solves, and achievements, with a **Profile** screen to equip them.
- **Streak-freeze tokens** (earned every 5 days) forgive a single missed day  loss-aversion
  that pulls lapsed players back without feeling punitive.
- **Weekly** and **all-time** consistency leaderboards (tabbed) alongside the daily board.
- A **Past Puzzles** archive to replay any previous day for practice.

**Best User Contributions**
- The Forge editor gained **select / drag-move / rotate / resize / delete**, a **solve-to-submit
  gate** (you must beat your own level  proof it's fair), **level thumbnails**, **Top/Newest**
  sorting, and community **reporting** (auto-hide on enough flags).

**Reddit-y**
- **Share-to-comments**: post your scorecard to the thread in one tap (as the user).
- **Post flair** (Daily vs Community Level) and **user flair** for streak milestones.

**Polish / integrity**
- **Server-side anti-cheat:** every submitted solution is re-simulated headlessly with
  `matter-js` and rejected if a near-ink-free submission never approaches the goal. The gate is
  deliberately *conservative*  it only blocks trivial fakes, so it can never false-reject a real
  drawing even if client/server physics diverge slightly.
- **Live presence (Devvit realtime):** while you're on a puzzle, a heartbeat keeps a short
  time-window of active players in Redis and broadcasts the count over realtime, so the board
  shows **“👁 N here now”**  a small "others are playing too" social pulse.
- **Unit tests** (`vitest`, 24 tests) cover the deterministic scene generator + campaign, the
  ink/stars math, cosmetic-unlock logic, weekly bucketing, and the anti-cheat replay (accepts a
  real solve, rejects a no-ink fake).

## Depth & hardening pass (round 2)

A further pass added genuine gameplay depth, accessibility, and production-readiness:

**Gameplay depth (Hooky / Phaser)**
- **Daily "twist" modifiers**  some days roll a mutator (Low Gravity, Extra Ink, One Stroke,
  Narrow Goal, Bouncy Ink, Slippery Ink) shown as a badge, so there's a "what's today's twist?"
  reason to look. Applied identically in the client *and* the server's anti-cheat replay.
- **Bonus rings** to thread through for a 'Collector' achievement; **eraser** mode + **redo**.

**Accessibility / Polish**
- A **Settings** panel: sound-volume slider, **reduced-motion** (kills shake/flash/ripple),
  and a **colorblind-safe palette** (Okabe-Ito), all persisted.
- A **"you vs everyone" ink histogram** on the result screen.

**Retention (Best Retention)**
- **Opt-in daily push notifications** ("a new puzzle dropped  keep your streak alive") via
  Devvit's notifications API, plus a feed **game badge** on each new post.
- A weekly **Featured Level** auto-post celebrating the top community creation.

**User Contributions (Best Contributions)**
- **Ghosts on community levels**  see how other redditors solved a Forge level, and your own
  solution is saved for the next player.

**Engineering hardening (Polish / launch-ready)**
- **Douglas-Peucker** stroke simplification (≈40 → 6 points in practice)  fewer physics bodies,
  smaller payloads, smoother mobile.
- **Redis TTL** on per-day keys (bounds memory/cost) and **rate-limiting** on solve/share/forge.
- Test suite grown to **39 tests** (scene gen, ink math, cosmetics, modifiers, colorblind,
  geometry, anti-cheat replay, and forge/profile against an in-memory Redis).

## Submission blurb (paste into Devpost)

> **INKDROP**  a daily draw-the-line physics puzzle for your subreddit. Every day the
> whole community gets one scene: a ball drops, and you sketch an ink ramp  with a limited
> budget  to guide it home. You're ranked by *how little ink you used* against everyone else,
> you keep a daily streak, and you can replay the ghost-lines of other redditors. Build your
> own puzzles in the **Level Forge**  the top-voted community level becomes a future daily,
> credited to its creator. One drawing a day, and a reason to come back for the next.
> Built on Devvit Web with Phaser + Matter.js physics.
