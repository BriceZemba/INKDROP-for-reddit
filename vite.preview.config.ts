import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Standalone config for local visual verification only (no Devvit plugin).
export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@devvit/web/client': resolve(process.cwd(), 'tools/preview/devvit-client-stub.ts'),
    },
  },
  server: { port: 5180, open: false },
});
