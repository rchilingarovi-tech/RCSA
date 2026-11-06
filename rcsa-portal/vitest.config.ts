import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// The team operates in GMT+4 and every date rule is computed in LOCAL time
// (see domain/scoring.ts). Pin the test process to that zone so date tests are
// deterministic on any machine / CI runner, and so they exercise the same
// local-vs-UTC boundary the production code was written to handle.
// Set before workers are spawned so they inherit it.
process.env.TZ = 'Asia/Tbilisi';

// Node has its own experimental `localStorage` global (flag added in 22.4; ON by
// default from Node 25). When on, it shadows jsdom's implementation and is
// undefined unless --localstorage-file is given. Turn it off so tests use
// jsdom's storage — what the app's repositories run against in a browser.
// Detected by capability, not version: only passed where this Node knows the flag.
const WEBSTORAGE_OFF = '--no-experimental-webstorage';
const execArgv = process.allowedNodeEnvironmentFlags.has(WEBSTORAGE_OFF) ? [WEBSTORAGE_OFF] : [];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      // Vitest 4: pool options are top-level (was `poolOptions.{forks,threads}.execArgv` in v3).
      execArgv,
    },
  }),
);
