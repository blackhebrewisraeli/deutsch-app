# UI Sub-Project 2 — Page Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the six tabs and the app shell on one page skeleton — one measure, one gutter, one Hero rhythm — with no visible change except a stated 8px.

**Architecture:** `PageFrame` (built in sub-project 1b, zero consumers) is changed to describe `App.jsx`'s `<main>` exactly, then `<main>` adopts it, then two tabs move onto the shared rhythm. Verification is a geometry probe driven by Playwright against a production build: it records measure, padding, Hero gap and overflow for six tabs at three widths, run once before any change and again after, so the diff is a table of numbers rather than an opinion.

**Tech Stack:** React 18, Vite 5, inline styles, Vitest + React Testing Library (jsdom, `globals: false`), Playwright 1.62, ESLint 10, Prettier, husky pre-commit running lint-staged **and** the full suite.

**Spec:** `docs/superpowers/specs/2026-08-28-ui-sub-project-2-layout-design.md` — read it alongside this plan. Section references (§3.4, §5, …) point into it.

## Global Constraints

- **This is not a redesign.** Success is a user noticing nothing except that things line up. (§1)
- **The complete intended diff is:** Alphabet gains 8px above its first block; Vocab's raw `32` becomes `SPACE[8]` (same value). **Anything else that moves is a bug.** (§5)
- **Measure stays 1400.** `PageFrame` adopts the app's numbers, never the reverse. (§2, §3.3)
- **Scope is the six tabs plus `<main>`.** Header, nav, dialogs and entry screens are out. (§2, §8)
- **The safe-area inset is ADDED to a bottom gutter, never substituted for it.** (§3.4)
- **`PageFrame` stays dumb** — no `useWindowWidth` inside it; the caller passes the responsive gutter. (§4.1)
- **Tokens only.** Every spacing value from `SPACE` in `src/lib/theme.js`. No raw numbers.
- **Tests import from `'vitest'` explicitly** — the suite runs `globals: false`.
- **Never bypass `.husky/pre-commit`.** `--no-verify` is forbidden.
- **One branch per task, PR into `main`.** Never commit to `main` directly. Target every PR at `main` — a PR based on any other branch gets **zero** Actions runs in this repo.
- Targeted test run: `npx vitest run <path>`. Full suite: `npm test`. Lint: `npm run lint`.

## A correction to the spec's verification widths

§7 names viewports 320 / 375 / **1400**. Use **1600**, not 1400: `max-width: 1400` never constrains at a 1400px viewport, so the measure would be the one property the probe fails to verify. The plan uses **320 / 375 / 1600**.

## Two rules that govern the tests here

1. **A test that passes the first time has proven nothing.** Every guard below has an explicit "watch it fail" step naming the expected failure. If a step says it should fail and it passes, stop — the test is not reaching the code.
2. **The probe must print its denominator.** "0 differences" and "visited 0 tabs" read identically. Every run reports tabs × widths actually measured.

---

## File Structure

**Created — 1 file:**

| File | Responsibility |
| --- | --- |
| `scripts/dev/audit-layout.mjs` | Geometry probe. Walks six tabs × three widths against a running production build and prints one JSON row per (tab, width). Self-contained: it requires `AUDIT_BASE` rather than duplicating `audit-contrast.mjs`'s ~200 lines of server provisioning, and it does not import from that file — its helpers are not exported, and refactoring a working CI gate to export them is risk this plan does not need. |

**Modified — 5 files:**

| File | Change |
| --- | --- |
| `src/components/ui/Layout.jsx` | `PageFrame`: `maxWidth` 900 → 1400; `gutter` also drives `paddingTop`; new `bottomGutter` prop; bottom padding becomes `calc(<space>px + env(...))` |
| `src/components/ui/Layout.test.jsx` | Tests for the above |
| `src/App.jsx:849-855` | `<main>` becomes `<PageFrame as="main" gutter={mobile ? 4 : 8}>` |
| `src/components/AlphabetTab.jsx:144` | `marginTop: SPACE[6]` → `SPACE[8]` |
| `src/components/VocabTab.jsx:273` | `marginTop: 32` → `SPACE[8]` |
| `package.json` | `audit:layout` script |

**Task order.** Task 1 must come first: it produces the **baseline** by running against the unmodified tree. Once any app code changes, the baseline is unrecoverable without a checkout dance.

```
1 (probe + baseline)  →  2 (PageFrame)  →  3 (<main> adopts)  →  4 (rhythm)
```

---

## Task 1: The geometry probe, and the baseline it captures

Task 1 changes **no application code**. Its deliverable is the probe plus a recorded baseline of today's geometry.

**Files:**
- Create: `scripts/dev/audit-layout.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run audit:layout` → JSON on stdout, one row per (tab, width), plus a denominator line. Tasks 3 and 4 diff against the baseline this task records.

- [ ] **Step 1: Write the probe**

Create `scripts/dev/audit-layout.mjs`:

```js
/**
 * Geometry probe for UI sub-project 2.
 *
 * Records the page skeleton's measurable properties for every tab at every
 * width, so "nothing moved" is a diff of numbers rather than an opinion.
 * Run it before the change and after; diff the two JSON outputs.
 *
 *   npm run build
 *   npx vite preview --port 5290 --strictPort &
 *   AUDIT_BASE=http://localhost:5290 npm run audit:layout > before.json
 *
 * AUDIT_BASE is required. audit-contrast.mjs can provision its own server, but
 * that is ~200 lines this probe does not need, and its helpers are not exported
 * — refactoring a working CI gate to share them is risk for no gain here.
 *
 * What this DOES NOT verify: colour, typography, z-order, or anything visual
 * outside the five measurements below. That limit is deliberate and recorded in
 * the spec (§7); it is the trade taken to avoid committing screenshot baselines.
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE;
if (!BASE) {
  console.error('audit-layout: set AUDIT_BASE to a running production build, e.g.');
  console.error('  npm run build && npx vite preview --port 5290 --strictPort &');
  console.error('  AUDIT_BASE=http://localhost:5290 npm run audit:layout');
  process.exit(2);
}

const TABS = ['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];

// 1600, not 1400: `max-width: 1400` never constrains at a 1400px viewport, so
// the measure — the property this whole sub-project turns on — would be the one
// thing left unverified.
const WIDTHS = [320, 375, 1600];

/** Click through the welcome gate. */
async function dismissEntryScreens(page) {
  // `[data-entry="guest"]`, not a styling class: the previous selector was
  // `.welcome-guest`, which existed only to carry a scoped :focus-visible rule
  // and vanished when that rule moved to the global sheet.
  const gate = await page.$('[data-entry="guest"]');
  if (gate) {
    await gate.click();
    await page.waitForTimeout(200);
  }
  const onShell = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!onShell) {
    throw new Error('audit-layout: never reached the app shell — the entry flow changed.');
  }
}

/** Switch tabs by the nav button's accessible name. */
async function openTab(page, tab) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      new RegExp(`^\\s*${t}\\s*$`, 'i').test(x.getAttribute('aria-label') || x.textContent || '')
    );
    if (b) b.click();
  }, tab);
  await page.waitForTimeout(500);
}

/**
 * Runs in the page. Reads the five properties the spec names.
 *
 * The Hero gap is measured as a RENDERED distance (next block's top minus the
 * Hero's bottom) rather than by reading marginTop. The rendered number is what
 * a user sees, and it stays correct if the spacing later moves to a flex gap.
 */
function measureLayout() {
  const main = document.querySelector('main');
  if (!main) return { error: 'no <main> element' };
  const cs = getComputedStyle(main);
  const doc = document.documentElement;

  let heroGap = null;
  const h1 = main.querySelector('h1');
  if (h1) {
    const heroRoot = h1.parentElement;
    const next = heroRoot?.nextElementSibling;
    if (next) {
      heroGap = Math.round(
        next.getBoundingClientRect().top - heroRoot.getBoundingClientRect().bottom
      );
    }
  }

  return {
    maxWidth: cs.maxWidth,
    clientWidth: main.clientWidth,
    padTop: cs.paddingTop,
    padLeft: cs.paddingLeft,
    padRight: cs.paddingRight,
    padBottom: cs.paddingBottom,
    heroGap,
    overflow: doc.scrollWidth - doc.clientWidth,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rows = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await dismissEntryScreens(page);
    for (const tab of TABS) {
      await openTab(page, tab);
      const m = await page.evaluate(measureLayout);
      rows.push({ tab, width, ...m });
    }
  }

  await browser.close();

  // The denominator. "0 differences" and "visited 0 tabs" print identically
  // without it, and a probe that silently reached nothing would read as success.
  const expected = TABS.length * WIDTHS.length;
  console.error(`audit-layout: measured ${rows.length}/${expected} (tab × width) combinations`);
  if (rows.length !== expected) {
    console.error('audit-layout: incomplete sweep');
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Wire the npm script**

In `package.json`, beside `"audit:contrast"`:

```json
"audit:layout": "node scripts/dev/audit-layout.mjs",
```

- [ ] **Step 3: Prove the probe fails loudly when it cannot reach the app**

Run it with no server:

```bash
AUDIT_BASE=http://localhost:9999 npm run audit:layout
```

Expected: a non-zero exit and a connection error — **not** an empty JSON array with a success exit. A probe that reports "nothing to see" when it reached nothing is the failure mode this whole plan is guarding against.

- [ ] **Step 4: Capture the baseline**

The tree is unmodified at this point, so this run **is** the `main` baseline.

```bash
npm run build
npx vite preview --port 5290 --strictPort &
AUDIT_BASE=http://localhost:5290 npm run audit:layout > /tmp/layout-before.json
```

Expected on stderr: `measured 18/18 (tab × width) combinations`.

- [ ] **Step 5: Sanity-check the baseline against the spec's claims**

The baseline must agree with §3.2 and §3.5, or one of them is wrong:

```bash
node -e "
const r=require('/tmp/layout-before.json');
const at=(t,w)=>r.find(x=>x.tab===t&&x.width===w);
console.log('desktop pad  ', at('Home',1600).padTop, at('Home',1600).padLeft, at('Home',1600).padBottom);
console.log('mobile pad   ', at('Home',375).padTop, at('Home',375).padLeft, at('Home',375).padBottom);
console.log('measure      ', at('Home',1600).maxWidth);
console.log('hero gaps    ', ['Home','Stats','Translate','Vocab','Alphabet','Chat'].map(t=>t+'='+at(t,1600).heroGap).join(' '));
console.log('overflow@320 ', r.filter(x=>x.width===320).map(x=>x.tab+'='+x.overflow).join(' '));
"
```

Expected: desktop `32px 32px 32px`; mobile `16px 16px 32px`; measure `1400px`; Hero gaps 32 for Home/Stats/Translate/Vocab, **24 for Alphabet**, `null` for Chat (it renders no `Hero`); overflow `0` everywhere.

> **If Alphabet does not read 24, or Chat is not `null`, STOP.** The spec's §3.5 is the premise of Task 4, and a mismatch means the premise is wrong — not that the probe needs adjusting.

- [ ] **Step 6: Commit**

```bash
git add scripts/dev/audit-layout.mjs package.json
git commit -m "test(layout): geometry probe for the page skeleton"
```

---

## Task 2: `PageFrame` describes the shell

**Files:**
- Modify: `src/components/ui/Layout.jsx` (the `PageFrame` function)
- Modify: `src/components/ui/Layout.test.jsx` (the `PageFrame` describe block)

**Interfaces:**
- Consumes: `SPACE` from `src/lib/theme`.
- Produces: `PageFrame` with props `{ maxWidth = 1400, gutter = 4, bottomGutter = 8, as = 'div', style, children, ...rest }`. `gutter` sets `paddingInline` **and** `paddingTop`. Task 3 calls it as `<PageFrame as="main" gutter={mobile ? 4 : 8}>`.

- [ ] **Step 1: Write the failing tests**

Replace the `describe('PageFrame', …)` block in `src/components/ui/Layout.test.jsx` with:

```jsx
describe('PageFrame', () => {
  it('centres within the app measure', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el.style.marginInline).toBe('auto');
    // 1400, not 900. The 900 default was written with no consumer to check it
    // against; the shell is 1400, and moving the app to 900 would cut Chat's
    // conversation column from 688px to 188px (spec §3.3).
    expect(el).toHaveStyle({ maxWidth: '1400px' });
  });

  // In this app the inline and top gutters are always the same number —
  // 16 mobile, 32 desktop — so one prop describes both (spec §4.1).
  it('applies the gutter to the inline edges and the top alike', () => {
    render(
      <PageFrame gutter={8} data-testid="p">
        x
      </PageFrame>
    );
    const el = screen.getByTestId('p');
    expect(el.style.paddingInline).toBe('32px');
    expect(el.style.paddingTop).toBe('32px');
  });

  it('defaults the gutter to SPACE[4]', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el.style.paddingInline).toBe('16px');
    expect(el.style.paddingTop).toBe('16px');
  });

  // The defect this prevents: PageFrame used to set
  // `paddingBottom: env(safe-area-inset-bottom, 0px)`, which computes to 0 on
  // desktop. <main> has a real 32px bottom gutter, so adopting the primitive
  // naively would have removed it from every tab — invisible to unit tests,
  // visible as content sitting closer to the nav (spec §3.4).
  it('adds the safe-area inset to the bottom gutter rather than replacing it', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const pb = screen.getByTestId('p').style.paddingBottom;
    expect(pb).toContain('32px');
    expect(pb).toContain('safe-area-inset-bottom');
    expect(pb).toMatch(/^calc\(/);
  });

  it('takes the bottom gutter from the SPACE scale', () => {
    render(
      <PageFrame bottomGutter={4} data-testid="p">
        x
      </PageFrame>
    );
    expect(screen.getByTestId('p').style.paddingBottom).toContain('16px');
  });

  it('renders the element `as` names, so <main> can be one', () => {
    const { container } = render(<PageFrame as="main">x</PageFrame>);
    expect(container.firstChild.tagName).toBe('MAIN');
  });
});
```

> `.style.paddingBottom` rather than `toHaveStyle`: jsdom drops `env()` from *computed* style entirely, but keeps the authored value on `.style`. A `calc()` containing `env()` is only assertable this way.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/components/ui/Layout.test.jsx`

Expected: **5 failed**, at five distinct reasons —
`maxWidth` received `900px`; `paddingTop` received `''` (the prop does not touch it yet); the default-gutter test likewise; `paddingBottom` received `env(safe-area-inset-bottom, 0px)` with no `32px` and no `calc(`; and `bottomGutter` is an unknown prop so the padding is unchanged. The `as="main"` test **passes** already — `as` exists.

- [ ] **Step 3: Rewrite `PageFrame`**

Replace the `PageFrame` function in `src/components/ui/Layout.jsx`:

```jsx
// The outermost per-tab wrapper, and the one place the measure, the gutters and
// the safe-area inset are decided.
//
// The defaults describe THIS APP's shell rather than a general recommendation:
// 1400 is App.jsx's <main> measure, and 900 (the value shipped in sub-project
// 1b, written with no consumer to check it against) would cut Chat's
// conversation column from 688px to 188px.
//
// `gutter` drives the inline edges AND the top because in this app they are the
// same number — 16 on mobile, 32 on desktop. Bottom is its own prop because it
// is the only edge that does not vary with viewport, and the only one that must
// COMPOSE with the safe-area inset instead of being replaced by it.
//
// No useWindowWidth in here. A layout primitive that reads the viewport has a
// hidden dependency and cannot be tested without stubbing the hook; the caller
// already knows whether it is mobile.
export function PageFrame({
  maxWidth = 1400,
  gutter = 4,
  bottomGutter = 8,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  const inline = SPACE[gutter] ?? SPACE[4];
  const bottom = SPACE[bottomGutter] ?? SPACE[8];
  return (
    <Tag
      style={{
        maxWidth,
        marginInline: 'auto',
        paddingInline: inline,
        paddingTop: inline,
        // Keeps content clear of the home indicator on iOS — ADDED to the
        // gutter, not substituted for it.
        paddingBottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
        width: '100%',
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run src/components/ui/Layout.test.jsx`

Expected: PASS, **18 tests** — the file holds 15 today (Stack 3, Row 4, Grid 3, PageFrame 3, shared 2); this replaces PageFrame's 3 with 6.

- [ ] **Step 5: Prove the bottom-gutter test has teeth**

Temporarily revert just that line to the old form:

```jsx
paddingBottom: 'env(safe-area-inset-bottom, 0px)',
```

Run: `npx vitest run src/components/ui/Layout.test.jsx`

Expected: **exactly two** failures — `adds the safe-area inset to the bottom gutter rather than replacing it` and `takes the bottom gutter from the SPACE scale`. Nothing else. This is the regression §3.4 warns about, reproduced on demand. Restore.

- [ ] **Step 6: Lint, full suite, commit**

```bash
npm run lint
npx vitest run src/components/ui/
git add src/components/ui/Layout.jsx src/components/ui/Layout.test.jsx
git commit -m "feat(ui): PageFrame describes the app shell"
```

---

## Task 3: `<main>` adopts `PageFrame`

The task where "nothing moves" is claimed — and measured.

**Files:**
- Modify: `src/App.jsx:849-855`

**Interfaces:**
- Consumes: `PageFrame` from Task 2, called as `<PageFrame as="main" gutter={mobile ? 4 : 8}>`.
- Produces: nothing importable.

- [ ] **Step 1: Add the import**

In `src/App.jsx`, beside the other `./components/ui/...` imports:

```jsx
import { PageFrame } from './components/ui/Layout';
```

- [ ] **Step 2: Replace `<main>`**

Replace:

```jsx
          <main
            style={{
              padding: mobile ? '16px 16px 32px' : '32px 32px',
              maxWidth: 1400,
              margin: '0 auto',
            }}
          >
```

with:

```jsx
          {/* The measure, both gutters and the safe-area inset all live in
              PageFrame now. `gutter` covers the inline edges and the top, which
              in this app are the same number; the 32px bottom is PageFrame's
              bottomGutter default. */}
          <PageFrame as="main" gutter={mobile ? 4 : 8}>
```

and its closing `</main>` with `</PageFrame>`.

- [ ] **Step 3: Run the unit suite**

Run: `npm test`

Expected: PASS. No test asserts `<main>`'s inline style, so this should be invisible to jsdom — which is exactly why Step 4 exists.

- [ ] **Step 4: Measure — the actual verification**

```bash
npm run build
npx vite preview --port 5290 --strictPort &
AUDIT_BASE=http://localhost:5290 npm run audit:layout > /tmp/layout-after-t3.json
node -e "
const a=require('/tmp/layout-before.json'), b=require('/tmp/layout-after-t3.json');
const key=r=>r.tab+'@'+r.width;
const A=Object.fromEntries(a.map(r=>[key(r),r])), B=Object.fromEntries(b.map(r=>[key(r),r]));
let diffs=0;
for (const k of Object.keys(A)) {
  for (const f of ['maxWidth','clientWidth','padTop','padLeft','padRight','padBottom','heroGap','overflow']) {
    if (String(A[k][f]) !== String(B[k][f])) { console.log(\`\${k}.\${f}: \${A[k][f]} -> \${B[k][f]}\`); diffs++; }
  }
}
console.log('compared', Object.keys(A).length, 'combinations;', diffs, 'differences');
"
```

Expected: **`0 differences`** across 18 combinations.

> **A non-zero diff here is a bug, not a surprise to accept.** The most likely culprit is `padBottom` — if it reads `0px` on desktop, `bottomGutter` is not composing (spec §3.4). Fix it before continuing rather than folding it into Task 4's expected delta.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(ui): <main> adopts PageFrame"
```

---

## Task 4: The rhythm rule

**Files:**
- Modify: `src/components/AlphabetTab.jsx:144`
- Modify: `src/components/VocabTab.jsx:273`

**Interfaces:**
- Consumes: `SPACE` from `src/lib/theme` (already imported in both files).
- Produces: nothing importable.

- [ ] **Step 1: Alphabet — the one real change**

In `src/components/AlphabetTab.jsx`, in the block that follows `<Hero>`:

```jsx
              marginTop: SPACE[6],
```

becomes:

```jsx
              // The rhythm rule: the gap between a tab's Hero and its first
              // content block is SPACE[8]. Alphabet was the only tab that
              // disagreed (spec §3.5, §4.3).
              marginTop: SPACE[8],
```

- [ ] **Step 2: Vocab — same value, now on the scale**

In `src/components/VocabTab.jsx`, in the grid that follows `<Hero>`:

```jsx
              marginTop: 32,
```

becomes:

```jsx
              marginTop: SPACE[8],
```

`SPACE[8]` is 32, so this moves nothing — it removes the last raw literal at this boundary.

- [ ] **Step 3: Confirm no other tab needs touching**

Run:

```bash
grep -n "marginTop" src/components/HomeTab.jsx src/components/StatsTab.jsx src/components/TranslateTab.jsx | head -5
grep -n "<Hero" src/components/ChatTab.jsx || echo "ChatTab: no Hero — exempt by design (spec §4.3)"
```

Expected: Home, Stats and Translate already read `SPACE[8]` at their Hero boundary; ChatTab prints the exemption line. **ChatTab is deliberately untouched** — it renders no `Hero`, so the rule does not apply. Do not "fix" it.

- [ ] **Step 4: Run the unit suite**

Run: `npm test`

Expected: PASS. Neither change is asserted by a unit test — jsdom computes no layout, so the 8px is invisible here. Step 5 is the real check.

- [ ] **Step 5: Measure — expect exactly one number to move**

```bash
npm run build
npx vite preview --port 5290 --strictPort &
AUDIT_BASE=http://localhost:5290 npm run audit:layout > /tmp/layout-after-t4.json
node -e "
const a=require('/tmp/layout-before.json'), b=require('/tmp/layout-after-t4.json');
const key=r=>r.tab+'@'+r.width;
const A=Object.fromEntries(a.map(r=>[key(r),r])), B=Object.fromEntries(b.map(r=>[key(r),r]));
let diffs=0;
for (const k of Object.keys(A)) {
  for (const f of ['maxWidth','clientWidth','padTop','padLeft','padRight','padBottom','heroGap','overflow']) {
    if (String(A[k][f]) !== String(B[k][f])) { console.log(\`\${k}.\${f}: \${A[k][f]} -> \${B[k][f]}\`); diffs++; }
  }
}
console.log('compared', Object.keys(A).length, 'combinations;', diffs, 'differences');
"
```

Expected — **exactly three lines of diff, all Alphabet's `heroGap`, all `24 -> 32`**:

```
Alphabet@320.heroGap: 24 -> 32
Alphabet@375.heroGap: 24 -> 32
Alphabet@1600.heroGap: 24 -> 32
compared 18 combinations; 3 differences
```

That is §5's stated diff, measured. Any fourth line is a bug.

- [ ] **Step 6: Confirm 320px is still clean**

```bash
node -e "
const b=require('/tmp/layout-after-t4.json');
const bad=b.filter(r=>r.overflow!==0);
console.log(bad.length===0 ? 'no horizontal overflow at any width' : JSON.stringify(bad,null,2));
"
```

Expected: `no horizontal overflow at any width`. The measure and gutters changed hands in Task 3, and 320px is where that would show.

- [ ] **Step 7: Lint, full suite, commit**

```bash
npm run lint
npm test
git add src/components/AlphabetTab.jsx src/components/VocabTab.jsx
git commit -m "refactor(ui): one Hero rhythm across the tabs"
```

---

## Definition of done

- [ ] All four tasks committed, each as its own PR into `main`, each green through `.husky/pre-commit` unbypassed.
- [ ] `npm run audit:layout` reports `18/18` combinations and exits non-zero if it cannot reach the app.
- [ ] The Task 4 diff against the baseline is **exactly three lines**, all `Alphabet.heroGap: 24 -> 32`.
- [ ] `padBottom` reads `32px` on desktop at every tab — the §3.4 regression did not happen.
- [ ] No horizontal overflow at 320, 375 or 1600 on any tab.
- [ ] `docs/BACKLOG.md`'s sub-project 2 row moves out of **Blocked**.

## Known gaps in this plan

- **The probe requires a manually started server.** `audit-contrast.mjs` can provision its own, but its helpers are not exported and duplicating ~200 lines of provisioning is worse than a two-line invocation. If a third probe ever wants them, that is the moment to extract a shared module — not before.
- **The probe is not wired into CI.** It is a before/after tool, and CI has no "before". Adding it as a gate would require committing a baseline, which is the screenshot-baseline cost the spec rejected. It stays a local instrument.
- **`VitalsOverlay.jsx` defines its own local `Row`.** Untouched here, but anyone importing `ui/Layout`'s `Row` into that file will collide (spec §9).

## Spec requirements deliberately not implemented

- **A named `measure` prop** (`wide` / `reading` / `narrow`) for `PageFrame`. Spec §10 raises it and defers it: one hypothetical consumer, and the primitives spec's rule is that a primitive earns its place by a second real one. The 480 and 760 reading columns stay raw numbers inside their tabs.
