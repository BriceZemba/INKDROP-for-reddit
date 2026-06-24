import { requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';

const play = document.getElementById('play') as HTMLButtonElement;
const dayEl = document.getElementById('day') as HTMLSpanElement;
const solvedEl = document.getElementById('solved') as HTMLSpanElement;
const streakEl = document.getElementById('streak') as HTMLDivElement;

play.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

// Populate the feed card with live numbers so it's enticing at a glance.
async function init() {
  try {
    const res = await fetch('/api/init');
    if (!res.ok) return;
    const data = (await res.json()) as InitResponse;
    dayEl.textContent = `Day ${data.scene.dayNumber}: “${data.scene.title}”`;
    if (data.solvedCount > 0) {
      solvedEl.textContent = `${data.solvedCount} solved today`;
    }
    if (data.streak.current > 0) {
      streakEl.textContent = `🔥 keep your ${data.streak.current}-day streak alive`;
    } else if (data.myBestInk !== null) {
      streakEl.textContent = `your best: ${data.myBestInk} ink`;
    }
  } catch {
    /* keep the static splash */
  }
}

void init();
