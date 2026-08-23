// Vitest config — pure-logic + data-invariant tests plus React component tests.
// jsdom is required for storage.js tests and component rendering.
// See docs/MAINTENANCE_CHECKLIST.md for how tests fit into the release flow.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.js'],
    // Generous timeouts on purpose. These budgets bound how long we wait for
    // something that is going to happen anyway, so on a loaded machine the
    // default 5s turns passing tests red: with the box at load 16, component
    // tests here took 7.4s, 10.0s and 12.6s and failed, in files the change
    // under test had never touched. A real hang still fails, just later.
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js', 'scripts/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // src/App.jsx is listed explicitly. It was absent for the app's whole
      // life, so the 939-line orchestrator that owns the sync effects, the
      // trial-wall gate and the entry gate never appeared in a coverage
      // report — a sweep for uncovered flag branches found 58 of them and
      // silently missed App's four. An audit that cannot see a file reports
      // zero findings there and zero files inspected identically.
      //
      // src/data/** is gone, not omitted: the directory was deleted in Phase
      // 1.5 (PR #101) and the stale glob had been matching nothing since.
      include: ['src/lib/**', 'src/components/**', 'src/App.jsx', 'api/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    },
  },
});
