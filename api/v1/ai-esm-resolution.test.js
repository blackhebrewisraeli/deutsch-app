import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// validate.js imports the client catalog from src/lib. Vite and vitest resolve
// an extensionless relative import; native Node on Vercel does not, and the
// deployed function 500s with ERR_MODULE_NOT_FOUND. Spawning a real Node is the
// only way to see that — same guard as api/v1/league/esm-resolution.test.js.
//
// This used to list api/v1/ai/{chat,grade,deck}.js. Those three were collapsed
// into one api/v1/ai.js dispatching on `?op=`, because the Hobby plan caps a
// deployment at 12 Serverless Functions. Coverage is unchanged: the entry point
// pulls in api/_lib/aiEndpoints.js, which is where all three handlers and their
// transitive imports now live, so a missing extension anywhere under it still
// fails here.
const FUNCTIONS = ['./api/v1/ai.js'];

describe('AI serverless functions load under native Node ESM', () => {
  for (const mod of FUNCTIONS) {
    it(`${mod} resolves the catalog import from src/lib`, () => {
      expect(() =>
        execFileSync('node', ['--input-type=module', '-e', `await import('${mod}')`], {
          cwd: process.cwd(),
          stdio: 'pipe',
        })
      ).not.toThrow();
    });
  }
});
