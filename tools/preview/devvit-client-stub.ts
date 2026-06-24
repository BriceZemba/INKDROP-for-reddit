// Local-only stub for '@devvit/web/client' so the game can run outside Devvit
// for visual verification. NOT shipped  only used by vite.preview.config.ts.
export const navigateTo = () => {};
export const requestExpandedMode = () => {};

/** Real on-screen toast so the local preview matches Reddit's native toast UX. */
export const showToast = (t: unknown) => {
  const text = typeof t === 'string' ? t : (t as { text?: string })?.text ?? String(t);
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2b2b3a;color:#fbf7ec;' +
    'padding:12px 20px;border-radius:14px;font:600 16px/1.2 Nunito,system-ui,sans-serif;z-index:9999;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;transition:opacity .2s';
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = '1'));
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 2200);
};

/** Use a browser prompt so the Forge's "name your level" form works locally. */
export const showForm = async (def: { fields?: { name: string; label?: string }[] }) => {
  const values: Record<string, string> = {};
  for (const f of def?.fields ?? []) {
    const v = window.prompt(f.label ?? f.name, '');
    if (v === null) return { action: 'CANCELED' as const, values: {} };
    values[f.name] = v;
  }
  return { action: 'SUBMITTED' as const, values };
};

export const showShareSheet = async (o: unknown) => {
  showToast('Shared! (preview)');
  console.log('[share]', o);
};
export const getShareData = () => undefined;
export const context = { username: 'tester' };
export const connectRealtime = () => ({ disconnect: async () => {} });
export const disconnectRealtime = () => {};
export const isRealtimeConnected = () => false;
