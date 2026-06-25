import { Hono } from 'hono';
import {
  currentDayId,
  currentDayNumber,
  dayNumberForDayId,
  ensureTodayPosted,
  getLastPostedDayId,
  getPostIdForDay,
  postFeaturedLevel,
  postRecapComment,
} from '../core/daily';
import { weekOf } from '../core/ranking';
import { notifyNewDailyOnce, showDailyBadge } from '../core/notify';

export const scheduler = new Hono();

// Runs daily (see devvit.json scheduler.tasks.dailyRollover).
// Recaps the previous puzzle, posts today's, nudges opted-in players, and on a
// new week, features the top community level.
scheduler.post('/daily-rollover', async (c) => {
  try {
    const prev = await getLastPostedDayId();
    const today = await currentDayId();
    const newPostId = await ensureTodayPosted();

    if (prev && prev !== today) {
      await postRecapComment(prev);
      const prevDay = await dayNumberForDayId(prev);
      const newDay = await currentDayNumber();
      if (weekOf(newDay) !== weekOf(prevDay)) await postFeaturedLevel();
    }

    // Notify for today's post once, whether the rollover created it or it already
    // existed (e.g. created by the install trigger) so opted-in players still get nudged.
    const postId = newPostId ?? (await getPostIdForDay(today));
    let notified = false;
    if (postId) {
      const dayNum = await currentDayNumber();
      notified = await notifyNewDailyOnce(postId, dayNum, today);
      await showDailyBadge(postId);
    }

    return c.json({ status: 'success', posted: newPostId ?? 'noop', notified }, 200);
  } catch (error) {
    console.error(`Daily rollover failed: ${error}`);
    return c.json({ status: 'error' }, 400);
  }
});
