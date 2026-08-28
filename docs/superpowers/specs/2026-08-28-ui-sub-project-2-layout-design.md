# UI sub-project 2 — one page skeleton, one rhythm

**Status:** design, ready for a plan
**Date:** 2026-08-28
**Unblocks:** `docs/BACKLOG.md` → "Blocked" → **UI sub-project 2 — the Nocturne visual redesign proper**
**Builds on:** `docs/ui-primitives-spec.md` (sub-project 1b), whose layout primitives this is the first real consumer of.
**Branch target:** `main`

---

## 1 · What this is

Sub-project 1b built a layout vocabulary. **Nothing speaks it**: `PageFrame`, `Stack` and `Grid` have zero consumers, and only `UI.jsx` uses `Row`. Sub-project 2 adopts it across the six tabs and the app shell.

The backlog framed this as "layout and rhythm… composition, not colour". Concretely, that means: **there is no shared page skeleton.** `App.jsx`'s `<main>` decides a measure and a gutter, and each tab then decides some of its own, with no rule connecting them.

**This is explicitly not a redesign.** Success is a user noticing nothing except that things line up.

## 2 · Decisions taken during brainstorming

Settled with the owner; not open for re-litigation without new information.

- **Intent: consistency, not a new look.** The app should look as it does today, on one skeleton.
- **Measure stays 1400.** `PageFrame` adopts the app's real numbers rather than the app adopting `PageFrame`'s. The alternative — moving the app to `PageFrame`'s 900 default — was costed and rejected (§3.3).
- **Scope: the six tabs plus `<main>`.** Header, nav, dialogs and entry screens keep their own layout.
- **Verification is assertion-based**, not screenshot diffing: measure computed geometry in a real browser (§7).
- **Rhythm unifies at the Hero boundary only** (Approach B). A full audit of every vertical gap (Approach C) was rejected — the tabs' inner spacing is already on the `SPACE` scale, so the marginal gain is small and the diff large.

## 3 · Facts verified against the code

Everything below was read from the tree at `4f02b1c`, not assumed.

### 3.1 The primitives have no consumers

`PageFrame`, `Stack`, `Grid`: **zero**. `Row`: two call sites, both in `UI.jsx` from Task 7. (`VitalsOverlay.jsx` defines its own local `Row` — a name collision to be aware of, not a bug.)

### 3.2 `<main>` is the whole shell layout

```jsx
// src/App.jsx:849
<main style={{ padding: mobile ? '16px 16px 32px' : '32px 32px', maxWidth: 1400, margin: '0 auto' }}>
```

Which resolves to:

| | mobile | desktop |
| --- | --- | --- |
| inline gutter | 16 = `SPACE[4]` | 32 = `SPACE[8]` |
| top | 16 = `SPACE[4]` | 32 = `SPACE[8]` |
| **bottom** | **32 = `SPACE[8]`** | **32 = `SPACE[8]`** |
| measure | 1400 | 1400 |

### 3.3 `PageFrame`'s defaults do not describe this app

`PageFrame` ships `maxWidth: 900` and `gutter: SPACE[4]`. Those were written in Task 6 with no consumer to check them against — a guess, and a wrong one.

Adopting them as-is would narrow every screen from 1400 to 900. That was costed against the widest layout, Chat's `280px minmax(0, 1fr) 320px` grid:

```
page 1400px -> content 1336px -> chat centre column 688px
page  900px -> content  836px -> chat centre column 188px
```

The side columns are fixed, so the entire loss lands on the conversation area — the app's primary surface, cut 3.6×. This is why the measure stays 1400 and the primitive moves instead.

### 3.4 `PageFrame`'s bottom padding would silently drop 32px

`PageFrame` currently sets `paddingBottom: env(safe-area-inset-bottom, 0px)`, which computes to **0 on desktop**. `<main>` has a real 32px bottom gutter in both modes. Adopting `PageFrame` naively removes it on every tab — a visible change, and exactly the kind that passes unit tests.

The safe-area inset must be **added to** a bottom gutter, not substituted for it.

### 3.5 The rhythm inconsistency is one tab, not four

At the Hero → first-block boundary:

| tab | Hero | value |
| --- | --- | --- |
| Home | `HomeTab.jsx:15` | `marginTop: SPACE[8]` = 32 |
| Stats — Ligen | `StatsTab.jsx:123` | `marginTop: SPACE[8]` = 32 |
| Stats — Statistik | `StatsTab.jsx:134` | `marginTop: SPACE[8]` = 32 |
| Translate | `TranslateTab.jsx:114` | `marginTop: SPACE[8]` = 32 |
| Vocab | `VocabTab.jsx:258` | `marginTop: 32` — raw literal, same value |
| **Alphabet** | `AlphabetTab.jsx:130` | `marginTop: SPACE[6]` = **24** |
| **Chat** | **none** | n/a — `ChatTab` renders no `Hero` |

`StatsTab` renders **two** Heroes, not one: `activeView === 'leagues'` shows the Ligen Hero at `:123`, otherwise the Statistik Hero at `:134`. An earlier version of this table cited `:123` for a row it described as "Stats" but whose value — the 32px gap before `LevelCard` — belongs to the Statistik view at `:134`. Read directly from `StatsTab.jsx`, the Ligen Hero is *also* already at `SPACE[8]` (the `<div style={{ marginTop: SPACE[8] }}>` wrapping `LeaderboardSection`), so adding the missing row does not change the conclusion below.

An earlier reading of this table claimed *four* tabs disagreed and that Chat sat at 24. Both were wrong: `ChatTab` has no `Hero`, and its `mobile ? 16 : 24` is a **grid gap**, not a margin. The real disagreement is **Alphabet alone**.

**Verification gap this creates:** §7's geometry probe drives `openTab(page, 'Stats')`, which lands on whichever view is active by default (Statistik) and has no way to also select Ligen. The Ligen Hero is therefore never measured at any width — not 320, not 375, not 1600 — and the probe's 18/18 (six tabs × three widths) denominator gives no indication that one of the app's six Heroes is missing from every run.

This section opens by promising everything in it was "read from the code, not assumed" (§3, line 31). This row was not — it's the one place in the spec where that promise was broken.

### 3.6 Rhythm varies *within* a tab too

`HomeTab` is Hero → 32 → `LevelCard` → 24 → the goal row. A single `Stack gap` cannot express that, which is a further reason the rule is scoped to the Hero boundary rather than applied to whole tabs.

## 4 · The skeleton

### 4.1 `PageFrame` becomes a description of `<main>`

| prop | today | becomes |
| --- | --- | --- |
| `maxWidth` | `900` | `1400` |
| `gutter` | `SPACE` key, default `4`; applies to `paddingInline` only | **also applies to `paddingTop`**; default `4` |
| `bottomGutter` | *does not exist* | **new prop**, `SPACE` key, default `8` |
| bottom padding | `env(safe-area-inset-bottom, 0px)` | `calc(<SPACE[bottomGutter]>px + env(safe-area-inset-bottom, 0px))` |

**`gutter` covers inline *and* top because in this app they are the same number.** From §3.2: inline and top are both 16 on mobile and both 32 on desktop. One prop describes both without losing anything, and a separate `topGutter` would be a third spacing prop with no caller that needs it.

Bottom is separate because it is the only edge that differs (always 32, regardless of viewport) **and** the only one that must compose with the safe-area inset rather than be replaced by it (§3.4).

**`PageFrame` stays dumb — no `useWindowWidth` inside it.** The responsive gutter is passed by the caller, which already has `mobile` in scope. A layout primitive that reads the viewport is a primitive with a hidden dependency, and it would make every consumer's output untestable without stubbing the hook.

### 4.2 `<main>` adopts it

```jsx
<PageFrame as="main" gutter={mobile ? 4 : 8}>
```

That single line reproduces all four of §3.2's numbers: inline 16/32, top 16/32, bottom 32 (from `bottomGutter`'s default of 8), measure 1400. Measure, gutter and bottom clearance are then decided in exactly one place.

### 4.3 The rhythm rule

**The gap between a tab's `Hero` and its first content block is `SPACE[8]`.**

That is the whole rule. It is not a general vertical rhythm; inner section gaps are untouched. `ChatTab` is exempt because it has no `Hero` — stated so a future reader does not "fix" the omission.

## 5 · The expected diff

The complete list of intended movement:

| change | effect |
| --- | --- |
| `AlphabetTab.jsx:130` `SPACE[6]` → `SPACE[8]` | **+8px** above the first block |
| `VocabTab.jsx:258` raw `32` → `SPACE[8]` | none — same value, now on the scale |
| `<main>` → `PageFrame` | not strictly none: `<main>`'s bottom padding gains an `env(safe-area-inset-bottom, 0px)` term it never had. Measured **zero today** only because that term currently resolves to 0 everywhere — `index.html`'s viewport meta has no `viewport-fit=cover` (see the `PageFrame` comment in `src/components/ui/Layout.jsx`) — not because the term is inert |

**Anything else that moves is a bug.** Stating the diff up front is what lets review check two numbers instead of hunting six screens.

## 6 · Structure

No new files in `src/`. The change is: `PageFrame`'s defaults and bottom-padding composition (`src/components/ui/Layout.jsx`), its tests, `App.jsx`'s `<main>`, and two one-line tab edits.

One new script, `scripts/dev/audit-layout.mjs` (§7).

## 7 · Verification — the geometry probe

`scripts/dev/audit-layout.mjs`, reusing `audit-contrast.mjs`'s harness: Playwright, `openTab(page, name)`, `dismissEntryScreens(page)` (which selects `[data-entry="guest"]` — a hook named for what the button *is*, precisely so a styling change cannot delete it again), and `AUDIT_BASE` against the production build.

For each of the six tabs × {320, 375, 1400} it records:

- the page measure (`<main>`'s `clientWidth` and computed `max-width`)
- computed inline padding, left and right
- computed `padding-bottom`
- the Hero → first-block gap, where a `Hero` exists
- `document.documentElement.scrollWidth - clientWidth` (horizontal overflow)

It prints its **denominator** — tabs × widths visited — so a probe that silently reached nothing cannot read as success. Run against `main`, then the branch; diff the numbers.

**Stated limit:** this verifies only the geometry it names. Colour, typography, z-order, and anything visual outside those five measurements are unverified by it. That is an accepted trade, chosen over screenshot baselines to avoid committing binaries.

**jsdom cannot substitute.** It computes no layout, and this section's original claim was disproved during implementation: bare `env()` alone *is* dropped from the style attribute, but `env()` **inside `calc()` is kept** — jsdom only reorders its arguments on read-back. `calc(32px + env(safe-area-inset-bottom, 0px))` comes back from `.style.paddingBottom` as `calc(32px + env(0px * , * safe-area-inset-bottom))`. The branch ships four working assertions on that value via `.style.paddingBottom` — substring matches against the mangled-but-stable string. `toHaveStyle` was never used and would not have worked: it compares computed style, and jsdom computes no layout for this property, so it would never match. Substring assertions on `.style.paddingBottom` are the workable form here; a full-string or computed-style assertion is not.

## 8 · Out of scope

Colour and typography. The header, nav and masthead — the header's spare width at 320px is ~10px, measured, and the level-control regression there survived 1,570 green tests. Dialogs, sheets and entry screens. Inner section rhythm (Approach C). The 480 and 760 reading measures inside Alphabet and Translate, which are deliberate narrow columns, not page measures.

## 9 · Risks

- **The bottom-gutter substitution (§3.4) is the likeliest silent regression.** It is invisible to unit tests and only shows as content sitting closer to the nav. The probe measures `padding-bottom` specifically for this reason.
- **`PageFrame`'s `maxWidth` default changing from 900 to 1400 affects any future consumer**, not just `<main>`. There are none today, so the blast radius is zero now — but the default is a decision, and §4.1 records that it describes this app's shell rather than a general recommendation.
- **`VitalsOverlay` has a local `Row`.** Importing `ui/Layout`'s `Row` into that file would shadow or collide. Not touched here; noted so it is not discovered mid-edit.

## 10 · Open question for the owner

`PageFrame` will describe a 1400px measure. That is wide for reading — the two narrow columns that exist (480, 760) were added precisely because some content wanted less. If a future sub-project wants a reading measure as a first-class concept, `PageFrame` growing a named `measure` prop (`wide` / `reading` / `narrow`) is the natural place. **Deliberately not built now**: it has one hypothetical consumer, and the primitives spec's §12 rule is that a primitive earns its place by a second real one.
