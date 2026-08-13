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
});
