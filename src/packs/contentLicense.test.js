import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CONTENT_LICENSE.md', () => {
  it('documents the three sources and their licenses', () => {
    // vitest runs from the repo root, so a repo-relative path resolves here
    // without needing `process` (ESLint no-undef) or a file:// URL.
    const txt = readFileSync('CONTENT_LICENSE.md', 'utf8');
    expect(txt).toMatch(/CC BY-SA 4\.0/);
    expect(txt).toMatch(/Wiktionary/);
    expect(txt).toMatch(/Tatoeba/);
    expect(txt).toMatch(/Leipzig/);
  });
});
