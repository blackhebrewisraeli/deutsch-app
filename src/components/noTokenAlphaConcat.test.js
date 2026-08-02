import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
const COMPONENTS_DIR = 'src/components';

// After theme tokens became CSS variables, `COLORS.ink + '30'` produces the
// invalid `var(--c-fg)30`. Alpha companions are named tokens (inkA30, etc.).
// Mirrors noHardcodedHex.test.js — a source-level guard, not a runtime check.
const TOKEN_ALPHA_CONCAT =
  /COLORS\.\w+\s*\+\s*['"`][0-9a-fA-F]{2}['"`]|['"`][0-9a-fA-F]{2}['"`]\s*\+\s*COLORS\.\w+/;

function walkJsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkJsx(full, out);
      continue;
    }
    if (name.endsWith('.jsx') && !name.endsWith('.test.jsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('no CSS-variable + hex-alpha concatenation', () => {
  it('fails if any component concatenates a hex alpha onto a COLORS token', () => {
    const files = walkJsx(COMPONENTS_DIR);
    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Allow the explanatory comment in MessageBubble that documents the ban.
        if (line.includes('Appending') || line.trimStart().startsWith('//')) return;
        if (TOKEN_ALPHA_CONCAT.test(line)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `token+alpha concat:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('fails on a deliberately reintroduced token + alpha concat', () => {
    const bad = "background: COLORS.ink + '30'";
    expect(TOKEN_ALPHA_CONCAT.test(bad)).toBe(true);
    expect(TOKEN_ALPHA_CONCAT.test('background: COLORS.inkA30')).toBe(false);
  });
});
