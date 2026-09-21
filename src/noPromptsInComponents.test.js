import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
const SRC_DIR = 'src';
const ALLOWED = 'src/lib/prompts.js';

// Four AI prompts drifted into four different files before Phase 1.3 pulled
// them together — one of them a .js under components/, which prompt-hunting
// greps for .jsx never reached. This is what stops a fifth appearing. Mirrors
// noHardcodedHex.test.js and noTokenAlphaConcat.test.js — a source-level
// guard, not a runtime check.
const PROMPT_MARKER = /\bYou are\b|\bYou generate\b/;

// Verbatim legal copy, which addresses the reader in the second person because
// that is how a terms document is written ("You are responsible for
// maintaining the security of your account"). The marker is a heuristic for
// LLM system prompts and this is the one legitimate non-prompt hit for it.
//
// Scoped to these exact files rather than a directory prefix, and asserted to
// exist below — an exclusion that outlives the file it excuses is an exclusion
// nobody notices has stopped meaning anything.
const NOT_PROMPTS = ['src/components/legal/TermsOfService.jsx'];

function walkSource(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkSource(full, out);
      continue;
    }
    if (!/\.jsx?$/.test(name)) continue;
    // Tests are excluded: prompts.test.js asserts on this very text, and so
    // does this file.
    if (/\.test\.jsx?$/.test(name)) continue;
    out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

describe('AI prompt text lives in one place', () => {
  it('finds prompt markers only in src/lib/prompts.js', () => {
    const offenders = [];
    for (const file of walkSource(SRC_DIR)) {
      if (file === ALLOWED) continue;
      if (NOT_PROMPTS.includes(file)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (PROMPT_MARKER.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, `prompt text outside ${ALLOWED}:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('still sees the prompts module itself, so the guard cannot pass vacuously', () => {
    const text = readFileSync(ALLOWED, 'utf8');
    expect(PROMPT_MARKER.test(text)).toBe(true);
  });

  it('keeps every excused file real and still matching, so no exclusion goes stale', () => {
    for (const file of NOT_PROMPTS) {
      // Exists: a path that no longer resolves would silently excuse nothing
      // while reading as though it still guards something.
      const text = readFileSync(file, 'utf8');
      // Still matches: once the copy no longer trips the marker the exclusion
      // has outlived its reason and should be deleted rather than left to
      // cover a future, real offender in the same file.
      expect(PROMPT_MARKER.test(text), `${file} no longer needs its exclusion`).toBe(true);
    }
  });
});
