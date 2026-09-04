import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// validate.js now imports the client catalog. Vite/vitest would hide a
// missing .js extension; native Node (Vercel) would 500. Same guard as
// api/v1/league/esm-resolution.test.js.
const FUNCTIONS = ['./api/v1/ai/chat.js', './api/v1/ai/grade.js', './api/v1/ai/deck.js'];

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
