import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Tests live outside src/ (so they don't enter the production tsc build) and stub
// the Devvit server module, which only exists at runtime on Reddit.
export default defineConfig({
  resolve: {
    alias: {
      '@devvit/web/server': resolve(process.cwd(), 'test/stubs/devvit-server.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
