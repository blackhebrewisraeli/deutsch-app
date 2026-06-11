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
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**', 'src/components/**', 'api/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    },
  },
});
