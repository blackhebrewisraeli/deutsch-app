import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// Regression guard for the prod incident where /api/v1/league/refresh and
// /profile 500'd with ERR_MODULE_NOT_FOUND: src/lib/xpCore.js imported
// './gameConfig' without a .js extension. Vercel serverless functions run
// under NATIVE Node ESM, which (unlike Vite/vitest) does not resolve
// extensionless relative imports. The normal vitest suite uses Vite's resolver
// and therefore CANNOT catch this class of bug — so here we spawn a real `node`
// process to import each deployed league function module and assert it loads.
const FUNCTIONS = [
  './api/v1/league/join.js',
  './api/v1/league/refresh.js',
  './api/v1/league/profile.js',
  './api/v1/league/settle.js',
  './api/v1/league/handle.js',
];

describe('league serverless functions load under native Node ESM', () => {
  for (const mod of FUNCTIONS) {
    it(`${mod} resolves all imports (no missing .js extension)`, () => {
      expect(() =>
        execFileSync('node', ['--input-type=module', '-e', `await import('${mod}')`], {
          cwd: process.cwd(),
          stdio: 'pipe',
        })
      ).not.toThrow();
    });
  }
});
