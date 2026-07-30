# Deck Progress Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the vocab tab's per-card dot strip from blowing out page width on large lexicon decks, while keeping a real progress signal at every deck size.

**Architecture:** Extract the progress indicator from `VocabTab`'s inline `.map` into a presentational `DeckProgress` component under `src/components/ui/`. It renders the existing dot strip at or below 12 cards and a fixed-width progress bar plus an `N / M LEARNED` count above it, so DOM cost and rendered width are bounded at any deck size.

**Tech Stack:** React 18, Vite 5, inline styles from `src/lib/theme.js`, Vitest + React Testing Library (`globals: false`).

Spec: `docs/superpowers/specs/2026-07-29-deck-progress-indicator-design.md`

## Global Constraints

- Branch is `fix/deck-progress-indicator`, based on `main` @ `ce2e7b7`. Never commit to `main`; land via PR.
- NEVER bypass `.husky/pre-commit` (lint-staged + full vitest suite, 717 tests). `--no-verify` is forbidden.
- `src/` relative imports carry NO file extension. Two-space indent, single quotes.
- Inline styles only; all colors, radii, spacing, fonts from `src/lib/theme.js`. The one exception already in the codebase is the neutral dot color `'#e7dcae'` — carry it over verbatim, do not invent a token.
- Test files import `{ describe, it, expect, ... }` from `'vitest'` explicitly (`globals: false`).
- Do NOT touch `public/lexicon/` — canonical, byte-reproducible data.
- `DOT_THRESHOLD = 12`.
- Existing `describe('auto deck loading')` tests in `src/components/VocabTab.test.jsx` must stay green and unmodified.

## File Structure

- **Create** `src/components/ui/DeckProgress.jsx` — the whole indicator. Default export. Sole responsibility: given a deck and the learned map, render bounded progress UI.
- **Create** `src/components/ui/DeckProgress.test.jsx` — unit tests for the component in isolation (threshold, dot colors, bar math, a11y attributes).
- **Modify** `src/components/VocabTab.jsx` — replace the inline `.map` at ~line 458-470 with `<DeckProgress …>`; add the import.
- **Modify** `src/components/VocabTab.test.jsx` — add a `describe('deck progress')` block proving the swap works through the real component at both deck scales.
- **Modify** `docs/DEMO_READINESS.md` — add the layout bug (ticked) and the gloss-quality finding (unticked); tick #3, #4, #6.

---

### Task 1: `DeckProgress` component

**Files:**

- Create: `src/components/ui/DeckProgress.jsx`
- Test: `src/components/ui/DeckProgress.test.jsx`

**Interfaces:**

- Consumes: `COLORS`, `FONTS`, `FONT_SIZE`, `LETTER_SPACING`, `RADIUS` from `../../lib/theme`.
- Produces: `export default function DeckProgress({ cards, learnedWords })`.
  - `cards`: array of card objects, each with a string `id`. May be empty.
  - `learnedWords`: object map, `card.id` → truthy when learned.
  - Returns `null` when `cards` is empty or missing.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/DeckProgress.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeckProgress from './DeckProgress';

const deck = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

describe('DeckProgress', () => {
  it('renders nothing for an empty deck', () => {
    const { container } = render(<DeckProgress cards={[]} learnedWords={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one dot per card at or below the threshold', () => {
    render(<DeckProgress cards={deck(12)} learnedWords={{}} />);
    expect(screen.getAllByTestId('deck-progress-dot')).toHaveLength(12);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('marks learned cards green in the dot strip', () => {
    render(<DeckProgress cards={deck(3)} learnedWords={{ c1: true }} />);
    const dots = screen.getAllByTestId('deck-progress-dot');
    expect(dots[1]).toHaveStyle({ background: '#3FA34D' });
    expect(dots[0]).toHaveStyle({ background: '#e7dcae' });
  });

  it('switches to a progress bar above the threshold', () => {
    render(<DeckProgress cards={deck(13)} learnedWords={{}} />);
    expect(screen.queryAllByTestId('deck-progress-dot')).toHaveLength(0);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('reports learned count and deck size on the bar', () => {
    render(<DeckProgress cards={deck(100)} learnedWords={{ c0: true, c5: true, c9: true }} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('3 / 100 LEARNED')).toBeInTheDocument();
  });

  it('ignores learned ids that are not in this deck', () => {
    render(<DeckProgress cards={deck(20)} learnedWords={{ c1: true, 'not-in-deck': true }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/DeckProgress.test.jsx`
Expected: FAIL — cannot resolve `./DeckProgress`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/ui/DeckProgress.jsx`:

```jsx
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, RADIUS } from '../../lib/theme';

// Above this many cards the per-card dot strip stops being readable — and, more
// importantly, stops fitting: it is the only unbounded child of the progress
// row, so at 2,212 cards (the B1 deck) it dragged the page 54x wider than the
// viewport. Small decks (curated + generated, 10 cards) keep the dots.
const DOT_THRESHOLD = 12;

const TRACK = '#e7dcae';

// Per-card progress for the active deck: dots for small decks, a bounded bar
// plus a count for lexicon-sized ones. Bounded DOM either way.
export default function DeckProgress({ cards, learnedWords }) {
  if (!cards?.length) return null;

  const total = cards.length;
  const learned = cards.filter((c) => learnedWords[c.id]).length;

  if (total <= DOT_THRESHOLD) {
    return (
      <div style={{ display: 'flex', gap: 5, minWidth: 0 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            data-testid="deck-progress-dot"
            style={{
              flex: '0 1 26px',
              width: 26,
              height: 8,
              borderRadius: RADIUS.pill,
              background: learnedWords[c.id] ? COLORS.green : TRACK,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div
        role="progressbar"
        aria-label="Words learned in this deck"
        aria-valuenow={learned}
        aria-valuemin={0}
        aria-valuemax={total}
        style={{
          width: 120,
          height: 8,
          borderRadius: RADIUS.pill,
          background: TRACK,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(learned / total) * 100}%`,
            height: '100%',
            borderRadius: RADIUS.pill,
            background: COLORS.green,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.mute,
          whiteSpace: 'nowrap',
        }}
      >
        {learned} / {total} LEARNED
      </span>
    </div>
  );
}
```

Note on the text assertion: `{learned} / {total} LEARNED` renders as separate
text nodes, so `getByText('3 / 100 LEARNED')` matches on the element's
normalized text content. If it does not match, use
`screen.getByText((_, el) => el?.textContent === '3 / 100 LEARNED')` rather than
changing the markup.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/DeckProgress.test.jsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/DeckProgress.jsx src/components/ui/DeckProgress.test.jsx
git commit -m "feat(vocab): bounded DeckProgress indicator (dots small, bar large)"
```

---

### Task 2: Wire `DeckProgress` into `VocabTab`

**Files:**

- Modify: `src/components/VocabTab.jsx` (import block near line 24; progress row at lines 458-470)
- Test: `src/components/VocabTab.test.jsx` (new `describe` block, appended inside the top-level `describe`)

**Interfaces:**

- Consumes: `DeckProgress` from Task 1 — `<DeckProgress cards={activeDeck} learnedWords={learnedWords} />`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Append this block inside the top-level `describe` in `src/components/VocabTab.test.jsx`, after the existing `describe('auto deck loading')` block (do not modify that block):

```jsx
describe('deck progress', () => {
  it('shows one dot per card on a 10-card curated deck', async () => {
    renderTab();
    expect(await screen.findByText(firstCard().de)).toBeInTheDocument();
    expect(screen.getAllByTestId('deck-progress-dot')).toHaveLength(10);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a bounded progress bar instead of dots on a large auto deck', async () => {
    __resetCache();
    const fixtures = {
      '/lexicon/index.json': indexJson,
      '/lexicon/chunk-00.json': chunk0,
      '/lexicon/chunk-01.json': chunk1,
    };
    globalThis.fetch = vi.fn((url) => {
      const key = Object.keys(fixtures).find((k) => String(url).endsWith(k));
      return key
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) })
        : Promise.resolve({ ok: false, status: 404 });
    });

    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole('button', { name: /Core 100/i }));
    expect(await screen.findByText('das Haus')).toBeInTheDocument();

    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryAllByTestId('deck-progress-dot')).toHaveLength(0);
  });
});
```

The second test depends on the fixture lexicon resolving more than 12 cards for
`Core 100`. Confirm before running: `node -e "const i=require('./src/packs/__fixtures__/lexicon/index.json'); console.log(i.length ?? i.entries?.length)"` — if the fixture holds 12 or fewer entries, the deck falls under the threshold and the test is wrong. In that case, drop this second test from `VocabTab.test.jsx` (the threshold swap is already covered in isolation by Task 1) and keep only the curated-deck test, noting why in a comment.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/VocabTab.test.jsx -t "deck progress"`
Expected: FAIL — no elements with `data-testid="deck-progress-dot"` (VocabTab still renders bare `<div>`s).

- [ ] **Step 3: Write minimal implementation**

In `src/components/VocabTab.jsx`, add to the import block (after the `Confetti` import at line 24):

```jsx
import DeckProgress from './ui/DeckProgress';
```

Replace lines 458-470 — the whole dot-strip `<div>` — with:

```jsx
                <DeckProgress cards={activeDeck} learnedWords={learnedWords} />
```

The surrounding row (`display: flex; justifyContent: space-between`) and the
"N cards remaining" label to its left are unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/VocabTab.test.jsx`
Expected: PASS — all pre-existing tests plus the 2 new ones.

- [ ] **Step 5: Full suite, lint, format**

Run: `npm test && npm run lint && npm run format:check`
Expected: all green; test count 717 + new tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/VocabTab.jsx src/components/VocabTab.test.jsx
git commit -m "fix(vocab): swap per-card dots for a bounded bar on large decks"
```

---

### Task 3: Browser verification at desktop and mobile

**Files:** none modified unless a defect is found.

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Use the `preview_start` tool with the project's `.claude/launch.json` entry (do NOT run the dev server through Bash). If no entry exists, add one running `npm run dev` on port 5173.

- [ ] **Step 2: Measure the desktop viewport**

Resize to 1274x800. Open the Vocab tab, click through to a B1 deck, wait for it to load, then evaluate:

```js
({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })
```

Expected: `scrollWidth === clientWidth` (was 69,023 vs 1,274 before the fix).

- [ ] **Step 3: Measure the mobile viewport**

Resize to 375x812. Repeat the measurement on a B1 deck **and** on the 10-card Greetings deck (the dot strip is ~305px wide; this is the case the `flex: '0 1 26px'` shrink guard exists for).

Expected: `scrollWidth === clientWidth` on both.

- [ ] **Step 4: Confirm no console errors**

Read console messages; expected: no errors from the vocab tab.

- [ ] **Step 5: Screenshot both states**

Capture the 10-card dot strip and the large-deck bar for the PR description.

- [ ] **Step 6: Fix and re-verify if any measurement fails**

If `scrollWidth > clientWidth` at any viewport, find the actual overflowing element before changing anything:

```js
[...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth).map((el) => el.tagName + ' ' + el.className).slice(0, 10)
```

Fix the real culprit, then re-run Steps 2-3. If the culprit is outside the progress row, record it in `docs/DEMO_READINESS.md` as a separate item rather than expanding this task's scope.

---

### Task 4: Update `docs/DEMO_READINESS.md`

**Files:**

- Modify: `docs/DEMO_READINESS.md`

**Interfaces:** none.

- [ ] **Step 1: Tick the items that already landed**

Items #3 and #4 (P1 import quality) landed in PR #64; item #6 (README) landed in PR #65. Change `- [ ]` to `- [x]` on each and append the PR reference to the item's first line, matching the existing style of #1 and #2 (`— FIXED in #62 (…)`):

- #3 → `— FIXED in #64 (examples[].en now nullable; import re-run)`
- #4 → `— FIXED in #64 (position-based CEFR over kept entries)`
- #6 → `— FIXED in #65 (counts refreshed; lexicon surfaced)`

- [ ] **Step 2: Add the layout bug as a new, ticked P0 item**

Append to the P0 section, after item #2:

```markdown
- [x] **13. Vocab progress dots blew out page width on lexicon decks.** — FIXED in this
  branch (`src/components/ui/DeckProgress.jsx`) `VocabTab` rendered one 26px dot per card
  unconditionally, in a `justify-content: space-between` row where it was the only unbounded
  child. Sized for 10-card decks; with the 4,424-word lexicon, Core 100 pushed page
  `scrollWidth` to 3,551px (2.8x the 1,274px viewport) and B1 to 69,023px (54x) while mounting
  2,212 needless DOM nodes.
  **Fix:** extract `DeckProgress` — keep the dot strip at ≤12 cards, switch to a fixed-width
  bar plus an `N / M LEARNED` count above it. Bounded DOM and bounded width at any deck size;
  verified `scrollWidth === clientWidth` at 1274px and 375px.
```

- [ ] **Step 3: Add the gloss-quality finding as a new, unticked P1 item**

Append to the P1 section, after item #5:

```markdown
- [ ] **14. Flashcard answers are raw Wiktionary glosses.** Some are long or
  meta-linguistic, and `VocabTab` renders them verbatim as multiple-choice options and as the
  revealed answer. Seen on the live demo: an option reading "ARCHAIC FORM OF STANDEN,
  FIRST/THIRD-PERSON PLURAL PRETERITE OF STEHEN", and the correct answer for *in* being
  "[WITH DATIVE] IN, INSIDE, WITHIN, AT (INSIDE A BUILDING)". A learner cannot pick between
  options like these, and they make the demo look unfinished.
  **Fix:** needs its own design pass — gloss cleanup belongs in the import pipeline
  (`scripts/import-lexicon/parseWiktextract.js`: strip bracketed grammar labels, drop
  `form of` glosses, truncate to the first sense) and requires an import re-run. Not attempted
  as part of #13.
```

- [ ] **Step 4: Refresh the header and suggested order**

Update the assessment line to note the 2026-07-29 revision, and update the "Suggested order" section so it does not still recommend work that is now closed. Keep it short — the closing lines should reflect that #1-#4, #6 and #13 are done and that #14 joins #7-#12 as remaining.

- [ ] **Step 5: Commit**

```bash
git add docs/DEMO_READINESS.md
git commit -m "docs(demo): record the progress-indicator fix and the raw-gloss finding"
```

---

### Task 5: Finish the branch

- [ ] **Step 1: Verify everything one more time**

Run: `npm test && npm run lint && npm run format:check`
Expected: all three green. Do not proceed on a red suite.

- [ ] **Step 2: Push and open a PR**

```bash
git push -u origin fix/deck-progress-indicator
```

Then open a PR against `main` describing the measured before/after numbers and including the two screenshots from Task 3.

- [ ] **Step 3: Hand off**

REQUIRED SUB-SKILL: use superpowers:finishing-a-development-branch to decide on merge/cleanup.

---

## Self-Review

**Spec coverage:** component + threshold + bar (Task 1) · call-site swap (Task 2) · mobile shrink guard (Task 1 styles, verified Task 3) · a11y progressbar (Task 1) · tests incl. untouched auto-deck block (Tasks 1-2) · `scrollWidth` verification at both viewports (Task 3) · DEMO_READINESS updates, both items (Task 4) · out-of-scope boundaries restated in Global Constraints (no `public/lexicon/`, no gloss cleanup). No gaps.

**Placeholders:** none — every code step carries complete code; the one conditional branch (fixture deck size in Task 2) states the exact command to resolve it and the exact fallback.

**Type consistency:** `DeckProgress({ cards, learnedWords })` is defined in Task 1 and called with exactly those props in Task 2. `data-testid="deck-progress-dot"` and `role="progressbar"` are the only query hooks and are spelled identically in Tasks 1 and 2. `DOT_THRESHOLD = 12` matches the ≤12 / >12 boundaries asserted in both test files.
