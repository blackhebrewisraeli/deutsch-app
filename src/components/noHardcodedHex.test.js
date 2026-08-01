import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
const COMPONENTS_DIR = 'src/components';
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function walkJsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkJsx(full, out);
      continue;
    }
    // Component sources only — tests may assert resolved values.
    if (name.endsWith('.jsx') && !name.endsWith('.test.jsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('no hardcoded hex colours in components', () => {
  it('fails if any non-test .jsx under src/components contains a raw hex literal', () => {
    const files = walkJsx(COMPONENTS_DIR);
    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (HEX.test(line)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `hardcoded hex literals:\n${offenders.join('\n')}`).toEqual([]);
  });
});
