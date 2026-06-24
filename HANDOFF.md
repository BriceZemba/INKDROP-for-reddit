# INKDROP — Session Handoff

> Paste this into the first message of a new Claude Code chat (opened in THIS folder)
> if the assistant doesn't already seem to know the project state.

## Project
INKDROP — a daily *draw-the-ramp* physics puzzle on **Reddit Devvit Web + Phaser 4 + Matter.js**,
for the **Reddit "Games with a Hook" Hackathon** (deadline Jul 15, 2026).
Working dir: `D:\Compétition\Active\Reddit's Games INKDROP` (this folder — the old
`Reddit's Games with a Hook Hackathon` copy is stale; use this one).

## Current state
- Whole app **built + verified**: `npm run type-check` ✓ · `npm run lint` ✓ ·
  `npm run test` (44 tests) ✓ · `npm run build` ✓.
- **Deployed to Reddit via playtest** → live at
  `https://www.reddit.com/r/InkdropGame/?playtest=inkdrop-game`.
- App slug = **`inkdrop-game`** (in devvit.json + package.json). Reddit user = u/Overall_Plenty_630.
- The `devvit` "fetch failed" earlier = home network blocking `devvit-gateway.reddit.com` +
  `gql-fed.reddit.com` (normal reddit.com worked). Fixed via phone hotspot / VPN.

## Features built
Daily puzzle (auto-posted via scheduler) + **50-level Campaign mode** + **Level Forge** (UGC:
build/vote/report, top level becomes a daily) + leaderboards (today/week/all-time) +
streaks & freeze tokens + ghost replays + cosmetics + achievements + opt-in notifications +
realtime "N here now" presence + server-side matter-js anti-cheat + Settings
(volume / reduced-motion / colorblind) + victory/defeat music. Two modes: shared **Daily**
(community) and personal **Campaign** (self-paced 1→50).

## Local test harness (no Reddit needed)
`npx vite --config vite.preview.config.ts --port 5180` → open
`http://localhost:5180/tools/preview/index.html` (mocked backend; good for visuals/feel).

## ▶ Next step (most important)
**Play the live Day 1 post on phone + PC** and report what feels wrong (drawing feel, button
taps, win/lose, mobile layout, is the daily fair/fun). That's the #1 risk: unproven fun + bugs
on real touch.

## Pending work the assistant offered to build
1. **Hand-author + tune the opening ~10-15 levels** (replace procedural generation for early
   days/campaign so first impression is reliably fun/fair).
2. A one-click **"Seed demo" mod button** (inject sample ghosts + community levels so a solo
   judge sees an *alive* sub — fixes the empty-leaderboard cold-start problem).
3. **Font bundling + art polish** (don't depend on the Google Fonts CDN; sharpen the look).
4. Verify on real Reddit: scheduler auto-post, post/user flair, notifications, realtime, streak.

## Open issue — GitHub push fails
`git push` to `https://github.com/BriceZemba/INKDROP-for-reddit.git` errors with
"did not receive expected object / index-pack failed" because the repo is a **shallow clone**
(started via `git clone --depth 1` of Reddit's template). Fix (clean re-init):
```
rm -rf .git
git init
git branch -M main
git add -A
git commit -m "INKDROP — Reddit Games with a Hook hackathon"
git remote add origin https://github.com/BriceZemba/INKDROP-for-reddit.git
git push -u origin main --force
```
(.gitignore already excludes node_modules/dist.)

## Honest assessment (given to the user)
Strong/ambitious but **not yet a likely grand-prize winner**: unproven fun, unverified on
platform, cold-start (empty sub for a solo judge), possible feature bloat. Best realistic
target = a **sub-award (Best Retention or Best User Contributions)**. #1 action = playtest on a
real device and fix feel/bugs before adding more.

## Submission steps
See `show me how to submit.md` in this folder. Short version: `npm run launch` (publish for
review) → make the sub Public → pin a clean demo post → fill out the Devpost form.
