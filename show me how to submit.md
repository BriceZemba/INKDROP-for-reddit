# 📤 How to Submit INKDROP  Step-by-Step

This is your complete, do-this-in-order checklist to go from the code on your
machine to a finished hackathon submission on Devpost. Budget ~45–60 minutes the
first time. Things only **you** can do (they need *your* Reddit login) are marked
**[YOU]**. Everything else is already built and wired up.

> **Deadline:** the hackathon runs **June 17 – July 15, 2026**. Submit on
> [redditgameswithahook.devpost.com](https://redditgameswithahook.devpost.com/) before the cutoff.

---

## 0. One-time prerequisites

| Need | How |
|---|---|
| **Node 22+** | You already have v22.16 ✅ (`node -v` to confirm). |
| **A Reddit account** | Your normal account is fine. Use one you don't mind being the "developer". |
| **A test subreddit you moderate** | Create one (next step). You must be a mod of it to install the app. |

### **[YOU]** Create a test subreddit
1. Go to <https://www.reddit.com/submit?type=community> (or Reddit → *Create a community*).
2. Name it something like `r/InkdropGame` (private "restricted" is fine for testing).
3. You're automatically the moderator. Keep the name handy  you'll use it below.

---

## 1. Install dependencies (already done, but to be safe)

```bash
npm install
```

## 2. **[YOU]** Log in to Reddit from the CLI

```bash
npm run login
```
This opens a browser to authorize the Devvit CLI with your Reddit account. Approve it.

## 3. Pick a globally-unique app name

Reddit app names must be **globally unique, 3–16 chars, lowercase, hyphens allowed**.
The project ships as `inkdrop`  that exact name may be taken. If so, edit **two**
places to the same new name (e.g. `inkdrop-daily`, `inkdrop-<yourhandle>`):

- `devvit.json` → `"name": "inkdrop"`
- `package.json` → `"name": "inkdrop"`

(If `inkdrop` is free, you can skip this.)

## 4. **[YOU]** Playtest live on your subreddit

```bash
npx devvit playtest r/InkdropGame
```
(Replace with your subreddit. This is the same as `npm run dev` but with your
subreddit specified.) Devvit uploads a dev build, installs it on your subreddit,
and hot-reloads as you edit. Leave it running.

On **first install**, the `onAppInstall` trigger automatically creates **Day 1's
puzzle post**. Open your subreddit in the browser, open that post, and click
**Play today's drop**.

### Smoke-test the whole loop (5 min)
- ✅ Draw an ink ramp → press **DROP** → guide the ball into the goal.
- ✅ See your **Result** card (stars, rank, "less ink than X%", streak) + **ghost** lines.
- ✅ Tap **Share my solution** (native share / copy).
- ✅ **Leaderboard** shows you.
- ✅ **Level Forge** → place ball/goal/blocks → **Test** (verify solvable) → **Submit** → name it.
- ✅ **Community Levels** → your level appears → **Vote**.
- ✅ Mod menu (subreddit ⋯ menu) → **"INKDROP: Advance to next day (test)"** posts the
  next day's puzzle **and** drops a "yesterday's top solvers" recap comment. Solve it to
  watch your **streak** tick to 2. This is how you demo retention without waiting a day.

> The real daily post happens automatically every day at **12:00 UTC** via the
> scheduler (`devvit.json → scheduler.tasks.dailyRollover`). The mod menu item is
> just so you can show it instantly to judges.

## 5. Deploy a real (non-dev) version

When it plays well:
```bash
npm run deploy
```
This runs type-check + lint, then `devvit upload`  publishing a versioned build to
Reddit (still private to you until the next step).

## 6. **[YOU]** Publish the app listing for review

```bash
npm run launch
```
This runs `deploy` then `devvit publish`, submitting the app to Reddit for review so
it gets a public **App listing** on `developer.reddit.com`. Approval can take a bit 
**do this early**, not at the deadline. You can keep playtesting meanwhile.

Your **App listing link** will look like:
`https://developers.reddit.com/apps/<your-app-name>`

## 7. **[YOU]** Make the public demo post

Judging is mostly done from your **demo post**, so make it self-explanatory:
1. Make sure your test subreddit is **public** (Mod tools → Community type → Public),
   so judges can open it without joining.
2. In the subreddit, use the mod menu **"INKDROP: Post today's puzzle"** to create a
   fresh post (or just use the auto-posted daily).
3. Open it, confirm it loads and plays for a logged-in user.
4. **Pin it** (mod → "Pin to profile"/"Sticky") so it's the first thing judges see.
5. Optionally solve it yourself + submit one Forge level so the leaderboard and
   Community Levels aren't empty when judges arrive.

Your **Demo post link** is that post's URL, and your **Subreddit link** is `r/InkdropGame`.

---

## 8. **[YOU]** Fill out the Devpost submission

On [redditgameswithahook.devpost.com](https://redditgameswithahook.devpost.com/) → **Submit**:

| Field | What to paste |
|---|---|
| **App listing** | `https://developers.reddit.com/apps/<your-app-name>` (from step 6) |
| **Demo post** | the pinned public post URL (from step 7) |
| **Subreddit** | `https://www.reddit.com/r/InkdropGame` |
| **Description** | See the ready-made copy in [`perspective.md`](perspective.md) → "Submission blurb". |
| **Screenshots / video** | A 30–60s clip: feed card → draw a ramp → drop → Result/percentile → Forge. |
| **Built with** | Devvit Web, Phaser, TypeScript, Vite, Hono, Redis. |
| **[Optional] Dev survey** | Complete it  there's a separate **Best Feedback** prize. |

> **Existing-project rule:** the rules allow existing projects but require significant
> updates *during* the hackathon window. INKDROP is brand-new this window, so you're clear.

---

## 9. Pre-submission polish checklist (maps to the judging criteria)

**Delightful UX**
- [ ] Everything fits the viewport with no scrolling, on a phone (test in a narrow window).
- [ ] First-time player understands it in <10s (the **How to play** card explains it).

**Polish**
- [ ] No console errors during a full play session.
- [ ] Drawing feels responsive; DROP/Undo/Clear all work; fail → retry keeps your ink.
- [ ] `npm run type-check`, `npm run lint`, `npm run build` all pass (they do ✅).

**Reddit-y**
- [ ] Leaderboard + recap comment + Forge attribution (`by u/…`) all visible.
- [ ] At least one community-submitted level exists before judging.

**Hook-y**
- [ ] Streak increments across a forced day-advance.
- [ ] Splash feed card shows live "Day N · N solved · keep your streak".

**Phaser**
- [ ] The ink-drawing + Matter physics + ghost replays read clearly as the Phaser showcase.

---

## Command cheat-sheet

| Command | Does |
|---|---|
| `npm run login` | Authorize the Devvit CLI with your Reddit account. |
| `npx devvit playtest r/YourSub` | Live dev build on your subreddit (hot reload). |
| `npm run type-check` | TypeScript check. |
| `npm run lint` | ESLint. |
| `npm run test` | Unit tests (vitest). |
| `npm run build` | Production client+server bundle into `dist/`. |
| `npm run deploy` | type-check + lint + `devvit upload` (versioned build). |
| `npm run launch` | `deploy` + `devvit publish` (submit app for review). |

## Troubleshooting

- **"App name taken"** → change `name` in `devvit.json` *and* `package.json` (same value), then `npm run deploy`.
- **Post says "not an INKDROP puzzle"** → that post wasn't created by this app. Use the mod
  menu **"Post today's puzzle"** to create a proper one (it stamps the scene metadata).
- **Nothing happens on install** → check `npx devvit playtest` logs; ensure `permissions.redis`
  and `permissions.reddit` are present in `devvit.json` (they are).
- **Scheduler didn't post overnight** → confirm the app is installed on the subreddit and the
  `scheduler.tasks.dailyRollover` cron is in `devvit.json`. Use the mod "Advance day" item to test instantly.
- **`npm run dev` asks for a subreddit** → use `npx devvit playtest r/YourSub` instead.

> Dev-only note: `tools/preview/`, `vite.preview.config.ts`, and `.claude/launch.json`
> are a local visual-test harness (they mock the server so the game can run in a plain
> browser). They are **not** uploaded to Reddit and can be ignored or deleted.
