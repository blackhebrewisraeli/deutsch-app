# Verb Conjugation Card Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface a verb's conjugation on the vocab card — up to two compact lines (3rd-person-singular present and Perfekt/participle) rendered in the existing `PL:` line style.

**Architecture:** A pure, tested `formatVerb(verb)` helper turns the relaxed verb block into an ordered list of `{label, value}` lines; `VocabTab` maps them to compact mono divs after the plural block. `resolveCard` already passes `card.verb` through — no pipeline change.

**Tech Stack:** React (function component), Vitest + Testing Library. Pure helper in `src/lib/`.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — `lint-staged` + full `npm test`; no `--no-verify`; wait for it.
- **`src/` imports use NO file extension.** Match existing 2-space indent / quote style.
- **`formatVerb` shape (exact):** returns `Array<{ label: string, value: string }>`, `[]` when nothing to show.
- **Line rules:** er-form (`{label:'er', value: present.er}`) when `present.er`; Perfekt (`{label:'Perfekt', value: `${aux==='sein'?'ist':'hat'} ${partizip2}`}`) when `partizip2` AND `aux`; else participle fallback (`{label:'Part. II', value: partizip2}`) when `partizip2` and no `aux`. Order: er first, then Perfekt/participle.
- **Pure-function-only:** no changes to the import pipeline or the committed sample lexicon (`public/lexicon/*`). No VocabTab integration test for verbs (no verb card is reachable in a test deck).

## File Structure
- Create `src/lib/verbDisplay.js` — `formatVerb(verb)` pure helper.
- Create `src/lib/verbDisplay.test.js` — its unit tests.
- Modify `src/components/VocabTab.jsx` — import `formatVerb`; render the lines after the plural block (~line 586), before the example block (~line 587).

---

## Task 1: `formatVerb` pure helper

**Files:**
- Create: `src/lib/verbDisplay.js`
- Test: `src/lib/verbDisplay.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatVerb(verb) => Array<{ label: string, value: string }>`. Input is a resolved card's `verb` field: `null` or `{ aux: null|'haben'|'sein', partizip2: null|string, present: { ich, du, er, wir, ihr, sie } }` (each present value string|null). Returns `[]` for `null`/non-object/empty blocks.

- [ ] **Step 1: Write the failing test**

Create `src/lib/verbDisplay.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatVerb } from './verbDisplay';

const present = (over = {}) => ({ ich: null, du: null, er: null, wir: null, ihr: null, sie: null, ...over });

describe('formatVerb', () => {
  it('returns [] for null / non-object', () => {
    expect(formatVerb(null)).toEqual([]);
    expect(formatVerb(undefined)).toEqual([]);
    expect(formatVerb('nope')).toEqual([]);
  });
  it('returns [] for an all-null block', () => {
    expect(formatVerb({ aux: null, partizip2: null, present: present() })).toEqual([]);
  });
  it('renders er-form + Perfekt with sein → ist', () => {
    expect(
      formatVerb({ aux: 'sein', partizip2: 'gegangen', present: present({ er: 'geht' }) })
    ).toEqual([
      { label: 'er', value: 'geht' },
      { label: 'Perfekt', value: 'ist gegangen' },
    ]);
  });
  it('renders Perfekt with haben → hat', () => {
    expect(
      formatVerb({ aux: 'haben', partizip2: 'gemacht', present: present({ er: 'macht' }) })
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Perfekt', value: 'hat gemacht' },
    ]);
  });
  it('falls back to Part. II when aux is null', () => {
    expect(
      formatVerb({ aux: null, partizip2: 'gemacht', present: present({ er: 'macht' }) })
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Part. II', value: 'gemacht' },
    ]);
  });
  it('renders only the er-form when there is no partizip2', () => {
    expect(formatVerb({ aux: null, partizip2: null, present: present({ er: 'geht' }) })).toEqual([
      { label: 'er', value: 'geht' },
    ]);
  });
  it('renders only Perfekt when there is no er-form', () => {
    expect(
      formatVerb({ aux: 'haben', partizip2: 'gesagt', present: present() })
    ).toEqual([{ label: 'Perfekt', value: 'hat gesagt' }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/verbDisplay.test.js`
Expected: FAIL — cannot resolve `./verbDisplay`.

- [ ] **Step 3: Implement**

Create `src/lib/verbDisplay.js`:

```js
// Formats a resolved card's (best-effort, nullable-fielded) verb block into
// compact display lines for the vocab card. Pure — each line appears only when
// its data exists. Order: er-form, then Perfekt (or a Part. II fallback when the
// auxiliary is unknown).
export function formatVerb(verb) {
  if (!verb || typeof verb !== 'object') return [];
  const lines = [];
  if (verb.present?.er) {
    lines.push({ label: 'er', value: verb.present.er });
  }
  if (verb.partizip2) {
    if (verb.aux) {
      const aux3sg = verb.aux === 'sein' ? 'ist' : 'hat';
      lines.push({ label: 'Perfekt', value: `${aux3sg} ${verb.partizip2}` });
    } else {
      lines.push({ label: 'Part. II', value: verb.partizip2 });
    }
  }
  return lines;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/verbDisplay.test.js`
Expected: PASS (7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/verbDisplay.js src/lib/verbDisplay.test.js
git commit -m "feat(vocab): formatVerb helper for card conjugation lines"
```

---

## Task 2: Render verb lines on the card

**Files:**
- Modify: `src/components/VocabTab.jsx` (import near the other `../lib/*` imports; render block after the plural block, before the example block ~line 587)

**Interfaces:**
- Consumes: `formatVerb` from `../lib/verbDisplay` (Task 1); `card.verb` (already on resolved cards).
- Produces: the card face shows the verb lines; nouns/phrases (`verb: null`) render nothing new.

- [ ] **Step 1: Add the import**

In `src/components/VocabTab.jsx`, add near the other `../lib/...` imports (e.g. after the `getDueCards`/`recordVocabAnswer` import from `../lib/srs`):

```js
import { formatVerb } from '../lib/verbDisplay';
```

- [ ] **Step 2: Render the lines after the plural block**

In the card-face block, immediately AFTER the plural block (the `{card.plural && ( … )}` that ends around line 586) and BEFORE the example block (`{card.examples?.length > 0 && (`), insert:

```jsx
                {formatVerb(card.verb).map((line) => (
                  <div
                    key={line.label}
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.caps,
                      color: COLORS.mute,
                      marginTop: SPACE[2],
                    }}
                  >
                    {line.label}: {line.value}
                  </div>
                ))}
```

(These theme tokens — `FONTS.mono`, `FONT_SIZE.tag`, `LETTER_SPACING.caps`, `COLORS.mute`, `SPACE` — are already imported and in use by the adjacent plural block.)

- [ ] **Step 3: Run the VocabTab suite + full suite**

Run: `npx vitest run src/components/VocabTab.test.jsx`
Expected: PASS (existing tests unaffected — the new render is additive and gated on `card.verb`, which is `null` for every card in the test decks).
Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 4: Commit**

```bash
git add src/components/VocabTab.jsx
git commit -m "feat(vocab): show verb conjugation lines on the card face"
```

---

## Self-Review

**Spec coverage:**
- §1 pure formatter → Task 1 (exact rules + tests).
- §2 VocabTab rendering (after plural, before example, PL-style mono) → Task 2.
- §3 testing → Task 1 unit tests; §3's "no VocabTab integration test / no sample change" honored (Task 2 relies on the existing suite staying green).
- §4 out of scope → nothing beyond the two lines.

**Placeholder scan:** No TBD/TODO; every code step has complete code.

**Type consistency:** `formatVerb` returns `Array<{label,value}>` in Task 1 and is consumed exactly that way in Task 2 (`.map((line) => … line.label … line.value)`). The verb block field names (`aux`, `partizip2`, `present.er`) match the merged verb-import schema.

## Notes / risks for the implementer
- `card.verb` is `null` for every card in the current test decks (curated + sample lexicon are nouns/phrases), so Task 2's render is dormant in tests — the existing VocabTab tests must simply stay green. The real logic is fully covered by Task 1.
- Keep the render inside the card-face `<div>`, between the plural and example blocks, so grammar facts group before the usage example.
