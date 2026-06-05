// Vitest config — covers the small pure-logic + data-invariant test suite.
// jsdom is required for storage.js tests (they exercise localStorage).
// See docs/MAINTENANCE_CHECKLIST.md for how tests fit into the release flow.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.js'],
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**'],
      exclude: ['src/**/*.test.js'],
    },
  },
});
