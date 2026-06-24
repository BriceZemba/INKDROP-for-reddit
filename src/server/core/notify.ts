/**
 * Opt-in push notifications: a consensual "a new puzzle dropped" daily nudge that
 * links players straight back to today's post  the strongest re-engagement lever.
 * Everything is wrapped defensively so notification hiccups never break posting.
 */

import { notifications, context } from '@devvit/web/server';

type T2 = `t2_${string}`;
type T3 = `t3_${string}`;

export async function optIn(): Promise<boolean> {
  try {
    await notifications.optInCurrentUser();
    return true;
  } catch (e) {
    console.error('optIn failed:', e);
    return false;
  }
}

export async function optOut(): Promise<boolean> {
  try {
    await notifications.optOutCurrentUser();
    return false;
  } catch (e) {
    console.error('optOut failed:', e);
    return false;
  }
}

export async function isOptedIn(): Promise<boolean> {
  const u = context.userId;
  if (!u) return false;
  try {
    return await notifications.isOptedIn(u);
  } catch {
    return false;
  }
}

/** Push "a new puzzle dropped" to everyone opted in, linking to the new post. */
export async function notifyNewDaily(postId: string, dayNumber: number): Promise<void> {
  try {
    const ids: T2[] = [];
    for await (const id of notifications.listOptedInUsersIterator()) {
      ids.push(id as T2);
      if (ids.length >= 1000) break;
    }
    if (ids.length === 0) return;
    await notifications.enqueue({
      title: 'INKDROP',
      body: `Day ${dayNumber} just dropped  keep your streak alive! ✒️`,
      recipients: ids.map((userId) => ({ userId, link: postId as T3, data: {} })),
    });
  } catch (e) {
    console.error('notifyNewDaily failed:', e);
  }
}

/** Surface the new post with a game badge in the feed (best-effort). */
export async function showDailyBadge(postId: string): Promise<void> {
  try {
    await notifications.requestShowGameBadge({ post: postId as T3 });
  } catch {
    /* badge optional */
  }
}
