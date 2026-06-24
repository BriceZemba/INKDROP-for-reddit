import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { forceNextDay, getLastPostedDayId, postRecapComment } from '../core/daily';

export const menu = new Hono();

function postUrl(postId: string): string {
  return `https://reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
}

menu.post('/post-create', async (c) => {
  try {
    const postId = await createPost();
    if (!postId) throw new Error('no post id');
    return c.json<UiResponse>({ navigateTo: postUrl(postId) }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

// Test helper: recap the current day, then post the next day's puzzle.
menu.post('/force-rollover', async (c) => {
  try {
    const prev = await getLastPostedDayId();
    const postId = await forceNextDay();
    if (prev) await postRecapComment(prev);
    if (!postId) throw new Error('no post id');
    return c.json<UiResponse>({ navigateTo: postUrl(postId) }, 200);
  } catch (error) {
    console.error(`Error advancing day: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to advance day' }, 400);
  }
});
