# Grade All Glosses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the meaning drill marking correct answers wrong. Grade a typed answer against every gloss a card carries, split into its synonym runs, and show the learner the meanings they did not give.

**Architecture:** `matching.js` gains `glossCandidates` and `bestGlossMatch`; `VocabTab.submitTyped` calls the latter instead of `fuzzyMatch(card.en, …)`; the verdict's non-drill branch shows the full gloss list.

**Tech Stack:** React 18 + Vite 5, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-16-grade-all-glosses-design.md`

## Global Constraints

- **Tests use `globals: false`** — import from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **No existing test may change.** Both `VocabTab.test.jsx` typed-answer cases
  are safe by construction (one types `card.en`, which stays accepted; the other
  types `zzzzzzzzzz` against a single-gloss preset card) — but **verify that,
  do not assume it**. If one fails, the candidate set is too wide; fix the
  splitter, not the test.
- **Do not re-run `npm run import:lexicon`** or touch `cleanGloss.js`.
- Open a PR against `main`; never push to `main`.

## What is already true — do not rebuild

- `resolveCard` already sets `glosses: entry.en`; `resolveDecks` already gives
  authored cards `glosses: ['Hello']`. **Both card kinds carry the field**, so no
  data change is needed anywhere.
- `card.en` appears in exactly five places in `VocabTab.jsx`. Three of them stay:
  `chooseOption`'s identity comparison (spec F6) and the two `recordItem` calls,
  where `card.en` is the review-feed *detail* and should remain the primary
  meaning.

## File Structure

| file | change |
|---|---|
| `src/lib/matching.js` | `glossCandidates` + `bestGlossMatch` |
| `src/lib/matching.test.js` | new cases (additive) |
| `src/packs/lexiconSample.test.js` | the regression bar over real artifacts |
| `src/components/VocabTab.jsx` | `submitTyped` grades all glosses; verdict shows them |
| `src/components/VocabTab.test.jsx` | new case (additive) |

---

### Task 1: the matcher

**Files:** `src/lib/matching.js`, `src/lib/matching.test.js`

**Interfaces:**
- Produces `glossCandidates(glosses) → string[]` and
  `bestGlossMatch(glosses, given, rules) → { distance, matched }`. Task 2 uses
  the latter.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/matching.test.js`:

```js
describe('glossCandidates', () => {
  const UHR = ["hours, o'clock", 'clock, watch', 'meter; gauge'];

  it('keeps each whole gloss AND its synonym runs', () => {
    // The whole gloss must survive: it is what grades correct today, and
    // nothing that passes now may start failing.
    const c = glossCandidates(UHR);
    expect(c).toContain("hours, o'clock");
    expect(c).toContain('clock');
    expect(c).toContain('watch');
    expect(c).toContain('gauge');
  });

  it('splits on the separators the shipped data actually uses', () => {
    expect(glossCandidates(['a, b'])).toContain('b');
    expect(glossCandidates(['a; b'])).toContain('b');
    expect(glossCandidates(['a · b'])).toContain('b');
    expect(glossCandidates(['a / b'])).toContain('b');
  });

  it('accepts a bare string as well as an array', () => {
    expect(glossCandidates('clock, watch')).toEqual(
      expect.arrayContaining(['clock, watch', 'clock', 'watch'])
    );
  });

  it('trims, drops empties and dedupes', () => {
    expect(glossCandidates(['a,  a , '])).toEqual(['a,  a ,', 'a']);
  });

  it('is empty for nothing', () => {
    expect(glossCandidates(undefined)).toEqual([]);
    expect(glossCandidates([])).toEqual([]);
  });
});

describe('bestGlossMatch', () => {
  const UHR = ["hours, o'clock", 'clock, watch', 'meter; gauge'];

  it('accepts a secondary meaning — the bug this fixes', () => {
    // Today: fuzzyMatch(card.en, 'clock') is distance 9, i.e. WRONG.
    expect(bestGlossMatch(UHR, 'clock').distance).toBe(0);
    expect(bestGlossMatch(UHR, 'watch').distance).toBe(0);
    expect(bestGlossMatch(UHR, 'gauge').distance).toBe(0);
  });

  it('still accepts the primary gloss exactly', () => {
    expect(bestGlossMatch(UHR, "hours, o'clock").distance).toBe(0);
  });

  it('reports the BEST distance, so the almost band still works', () => {
    // 'clocl' is one edit from the candidate 'clock'.
    expect(bestGlossMatch(UHR, 'clocl').distance).toBe(1);
  });

  it('is far for an unrelated answer', () => {
    expect(bestGlossMatch(UHR, 'zzzzzzzzzz').distance).toBeGreaterThan(2);
  });

  it('names which candidate matched, for the caller to record', () => {
    expect(bestGlossMatch(UHR, 'watch').matched).toBe('watch');
  });

  it('has no match at all for an empty gloss list', () => {
    expect(bestGlossMatch([], 'anything').distance).toBe(Infinity);
  });
});
```

Add `glossCandidates, bestGlossMatch` to the existing import at the top.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/matching.test.js`
Expected: FAIL — `glossCandidates is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/matching.js`:

```js
// Glosses are synonym runs, not single words: 36% of the shipped ones contain a
// comma, 6% a semicolon, 3% a middot, 1% a slash. Splitting on those is what
// makes "clock" match the gloss "clock, watch".
const GLOSS_SEPARATORS = /[,;·/]/;

/**
 * Every string that should count as a correct answer for a card.
 *
 * Each whole gloss is kept ALONGSIDE its fragments. That is not redundancy: the
 * whole gloss is what grades correct today, so keeping it is what guarantees
 * this change cannot make a passing answer fail.
 *
 * @param {string[]|string|undefined} glosses
 * @returns {string[]}
 */
export function glossCandidates(glosses) {
  const list = Array.isArray(glosses) ? glosses : glosses ? [glosses] : [];
  const out = [];
  for (const gloss of list) {
    for (const candidate of [gloss, ...gloss.split(GLOSS_SEPARATORS)]) {
      const trimmed = candidate.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

/**
 * The closest candidate to what the learner typed.
 *
 * Returns the minimum distance across the candidate set, so the caller's
 * existing 0 → correct, ≤2 → almost bands keep working unchanged; only the set
 * of things that can score 0 has widened.
 *
 * @param {string[]|string|undefined} glosses
 * @param {string} given
 * @param {import('./textRules').TextRules} [rules=ANSWER]
 * @returns {{ distance: number, matched: string|null }}
 */
export function bestGlossMatch(glosses, given, rules = ANSWER) {
  let best = { distance: Infinity, matched: null };
  for (const candidate of glossCandidates(glosses)) {
    const { distance } = fuzzyMatch(candidate, given, rules);
    if (distance < best.distance) best = { distance, matched: candidate };
  }
  return best;
}
```

- [ ] **Step 4: Run to verify, then commit**

Run: `npx vitest run src/lib/matching.test.js` — expected PASS, with the ten
existing `exactMatch`/`fuzzyMatch` cases unchanged.

```bash
git add src/lib/matching.js src/lib/matching.test.js
git commit -m "feat(matching): grade against every gloss, not just the first"
```

---

### Task 2: the regression bar, before wiring anything

**Files:** `src/packs/lexiconSample.test.js`

**Why before Task 3:** the spec's §6 bar is that nothing which grades correct
today may grade wrong after. Proving that over the **real shipped lexicon**
before changing the caller means a failure points at the matcher, not at
VocabTab.

- [ ] **Step 1: Add the bar**

In `src/packs/lexiconSample.test.js`, add a new `it` inside the existing
`describe` over the shipped artifacts:

```js
  it('every entry\'s primary gloss still grades correct under the wider matcher', () => {
    // The bug being fixed is that only glosses[0] was accepted. Widening the
    // candidate set must not lose it: verified here against all 4,201 shipped
    // entries rather than argued.
    const failures = [];
    for (const chunk of chunks) {
      for (const entry of Object.values(chunk)) {
        const primary = [].concat(entry.en ?? [])[0];
        if (!primary) continue;
        if (bestGlossMatch(entry.en, primary).distance !== 0) {
          failures.push(`${entry.id}: ${JSON.stringify(primary)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
```

Import `bestGlossMatch` from `'../lib/matching'`.

- [ ] **Step 2: Run**

Run: `npx vitest run src/packs/lexiconSample.test.js`
Expected: PASS with zero failures. (Confirmed while writing the spec: the whole
gloss survives the split for all 4,201 entries.)

**If it reports failures, stop.** The splitter is dropping something and Task 3
must not proceed.

- [ ] **Step 3: Commit**

```bash
git add src/packs/lexiconSample.test.js
git commit -m "test(lexicon): pin that the primary gloss still grades correct"
```

---

### Task 3: wire it into the drill

**Files:** `src/components/VocabTab.jsx`, `src/components/VocabTab.test.jsx`

- [ ] **Step 1: Grade against all glosses**

Import `bestGlossMatch` alongside the existing matchers, then in `submitTyped`
replace:

```js
    const { distance: dist } = fuzzyMatch(card.en, typedAnswer, ANSWER);
```

with:

```js
    // Every gloss, not just the first. card.en is glosses[0]; a card like
    // "die Uhr" ships "clock, watch" and "meter; gauge" too, and typing "clock"
    // used to be marked wrong.
    const { distance: dist } = bestGlossMatch(card.glosses ?? card.en, typedAnswer, ANSWER);
```

Leave `markLearned`, `recordEvent` and `recordItem` exactly as they are —
`card.en` remains the right review-feed detail.

- [ ] **Step 2: Show the meanings they did not give**

The verdict's non-drill branch currently reads `: card.en`. Change it to the
full list:

```jsx
                  answer={drill ? drill.answer(card, activePack.grammar) : glossList(card)}
```

with a small helper near the top of the component file:

```js
// The verdict is where the other meanings can be taught — the card face must
// not show them, since that would print the answer above the question.
const glossList = (card) => (card.glosses?.length ? card.glosses.join(' · ') : card.en);
```

- [ ] **Step 3: Add the regression test (additive)**

**Checked while writing this plan: every fixture entry has exactly one gloss** —
`n:brot ["bread"]`, `n:wasser ["water"]`, `n:haus ["house"]`, and so on. So this
test cannot be written against the fixture as it stands; it would pass while
proving nothing.

Give one entry a real second gloss first. `n:wasser` is the natural choice
because the food tag decks already resolve it:

```json
"en": ["water", "waters, body of water"]
```

**Then check nothing regressed:** `lexiconStore.test.js` asserts the exact card
list for the food tag deck, and `VocabTab.test.jsx` builds multiple-choice
options from `en` values. Changing `en[0]` would break both — appending a second
gloss leaves `en[0] === 'water'` untouched, which is why it is an append rather
than a rewrite. Run `npx vitest run src/packs src/components` immediately after
editing the fixture, before writing the test.

Then cover: typing `waters` (a fragment of the **second** gloss) grades
**correct**; the verdict shows the glosses joined with ` · `.

- [ ] **Step 4: Verify**

Run: `npx vitest run`, `npm run lint`, `npm run format:check`.

**Both existing typed-answer tests must still pass**: one types `card.en`
(accepted by construction), the other `zzzzzzzzzz` against a single-gloss preset
card. Confirm rather than assume — a too-wide splitter would show up here first.

**Prove the fix is load-bearing**: revert `submitTyped` to
`fuzzyMatch(card.en, …)` and confirm the new secondary-gloss test fails.
Restore.

- [ ] **Step 5: Commit**

```bash
git add src/components/VocabTab.jsx src/components/VocabTab.test.jsx
git commit -m "fix(vocab): accept any correct meaning, not only the first gloss"
```

---

### Task 4: browser, then PR

- [ ] **Step 1: Build and check the layout risk**

```bash
npm run build
```

Start `prod-preview`. **Unregister the service worker and clear caches first** —
this has cost a detour on three of the last four features.

Pick a lexicon deck (Core 100), find a multi-gloss card, and at **375px**:

1. type a **secondary** meaning → must grade correct;
2. read the verdict → it should list the glosses joined with ` · `;
3. **assert no horizontal scroll** by setting `document.documentElement.scrollLeft = 999`
   and reading it back — not by comparing `scrollWidth` to `innerWidth`, which
   has hidden real 2px scroll before (#90).

The long verdict line is the one visual risk in this change; a three-gloss card
is a wide string on a phone.

- [ ] **Step 2: Open the PR**

Non-draft, targeting `main`. In the body: the `die Uhr` before/after table; that
48% of entries carry more than one gloss; why whole-gloss matching alone was
insufficient (36% contain commas); the measured widening (1.0 → 2.7 accepted
answers per card); the regression bar over all 4,201 entries; and the asymmetry
argument for erring toward acceptance.

Note `kassieren` accepts 15 answers including `get` — the source data's breadth,
recorded rather than hidden.

---

## Self-Review

**Spec coverage.** §3.1 → Task 1. §3.2 → Task 1's `glossCandidates` plus Task 2's
bar. §3.3 → the generous splitter, argued in the code comment. §3.4 → Task 3
Step 2. §6 → Tasks 2 and 3 Step 4, and Task 4 Step 1 for the wrap check.

**Task order is deliberate.** The regression bar (Task 2) lands *before* the
caller changes (Task 3), so if the splitter loses something the failure names
the matcher rather than the component.

**The one place this could go wrong quietly** is a too-wide candidate set making
a genuinely wrong answer pass. The `zzzzzzzzzz` test is the tripwire and Task 3
Step 4 says to check it rather than assume — but note it only guards *far* wrong
answers. A near-miss wrong answer (`watch` for a card meaning `clock` in a
different sense) is accepted by design; §3.3 argues why that is the right way to
be wrong.

**Type consistency.** `glossCandidates` takes `string[] | string | undefined`
and always returns an array. `bestGlossMatch` returns
`{ distance: number, matched: string|null }`, with `Infinity` for an empty set —
so the caller's `dist === 0 ? … : dist <= 2 ? …` bands treat "no candidates" as
wrong, which is correct.
