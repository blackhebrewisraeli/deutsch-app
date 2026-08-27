import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMPONENTS_DIR = 'src/components';

// A <button> may not contain a <button>: the HTML content model forbids it and
// browsers repair it by un-nesting, which silently changes the DOM the tests
// assert against. An InteractiveCard with its own affordance inside (a row with
// a "remove" control) is two siblings in a Row, not a nest.
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sources(full, out);
      continue;
    }
    if (name.endsWith('.jsx') && !name.endsWith('.test.jsx')) out.push(full);
  }
  return out;
}

// Matches an <InteractiveCard …> opening tag through to its closing tag, across
// lines, non-greedily.
const CARD_BLOCK = /<InteractiveCard\b[\s\S]*?<\/InteractiveCard>/g;
const NESTED = /<(Button|button)\b/;

describe('no interactive element nested inside an InteractiveCard', () => {
  it('finds no Button or <button> inside an InteractiveCard block', () => {
    const files = sources(COMPONENTS_DIR);
    // Denominator: a walk that finds nothing reports the same zero offenders as
    // a clean tree.
    expect(files.length).toBeGreaterThan(50);

    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const block of src.match(CARD_BLOCK) ?? []) {
        if (NESTED.test(block)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}: ${block.slice(0, 80)}…`);
        }
      }
    }
    expect(
      offenders,
      `scanned ${files.length} files; nested interactive elements:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  // The matcher itself, proven both ways. Until a real InteractiveCard consumer
  // exists this guard scans for a pattern that appears nowhere, so it would pass
  // vacuously and prove nothing — the failure mode this suite exists to prevent.
  it('would catch a nested control, and does not fire on a sibling one', () => {
    const nested = `
      <InteractiveCard>
        Deck A
        <Button>Remove</Button>
      </InteractiveCard>`;
    expect((nested.match(CARD_BLOCK) ?? []).some((b) => NESTED.test(b))).toBe(true);

    const nestedLowercase = `
      <InteractiveCard>
        <button type="button">Remove</button>
      </InteractiveCard>`;
    expect((nestedLowercase.match(CARD_BLOCK) ?? []).some((b) => NESTED.test(b))).toBe(true);

    // The correct shape: the control is a SIBLING of the card, not inside it.
    const sibling = `
      <Row>
        <InteractiveCard>Deck A</InteractiveCard>
        <Button>Remove</Button>
      </Row>`;
    expect((sibling.match(CARD_BLOCK) ?? []).some((b) => NESTED.test(b))).toBe(false);
  });
});
