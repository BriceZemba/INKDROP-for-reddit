import { currentDayId, currentDayNumber, postDailyFor } from './daily';

/** Create a puzzle post for the current day (used by the mod menu + install trigger). */
export const createPost = async (): Promise<string | null> => {
  const [dayId, dayNumber] = await Promise.all([currentDayId(), currentDayNumber()]);
  return postDailyFor(dayNumber, dayId);
};
