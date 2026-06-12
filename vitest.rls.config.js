import { defineConfig } from 'vitest/config';

// RLS adversarial suite — requires a running local Supabase stack
// (`supabase start`, Docker). Deliberately separate from the main config so
// `npm test` and the pre-commit hook never need Docker.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['supabase/tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
