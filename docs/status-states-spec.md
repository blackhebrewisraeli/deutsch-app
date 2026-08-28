# Status States — Design Contract

**UI sub-project 3.** Empty states and error states as one family: shared
structure, different tone.

Sibling to `docs/ui-primitives-spec.md`, which this depends on — `StatusNote`
composes `Stack`, `Body` and `Button` rather than re-deriving their styling.

---

## 1. Why

Six surfaces in this app tell the user that something is absent or broken. They
were written independently and share nothing. Two of them are byte-identical by
coincidence; the other four each invented a recipe. Three announce nothing to a
screen reader. One offers recovery, and its recovery control is the only button
in the app that misses the global focus ring.

This is the same failure sub-project 1b addressed for buttons and typography:
not ugliness, but _n_ independent definitions of one idea, drifting apart at
_n_ different rates.

---

## 2. The measured inventory

Every surface below was read in full at `549c812`. This section is the
denominator: any later claim about "all the empty states" is checkable against
it.

### 2.1 Empty — content is absent

| #   | Surface                           | Copy                                              | Treatment                                             |
| --- | --------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| E1  | `stats/PerTabBars.jsx:16`         | "No exercises recorded yet."                      | `FONTS.body`, italic, `COLORS.mute`, `FONT_SIZE.base` |
| E2  | `stats/ReviewFeed.jsx:22`         | "Nothing to review — keep practicing."            | byte-identical to E1                                  |
| E3  | `stats/LeaderboardSection.jsx:66` | "Sign in to join a league and compete this week." | `SPACE[6]`, centred, `COLORS.mute`, no italic, `<p>`  |

E1 and E2 are the same five declarations in the same order. E3 is the drift:
same intent, different padding, no italic, no font family.

### 2.2 Error — content failed to arrive

| #   | Surface                           | Copy                         | Treatment                                   | Recovery | `role="alert"` |
| --- | --------------------------------- | ---------------------------- | ------------------------------------------- | -------- | -------------- |
| X1  | `VocabTab.jsx:300`                | "Could not load this deck."  | `SPACE[8]`, centred, **mono**, `COLORS.red` | Retry    | **no**         |
| X2  | `stats/LeaderboardSection.jsx:74` | "Couldn't load your league." | `COLORS.red`, `SPACE[4]`, `<p>`             | **none** | **no**         |
| X3  | `stats/ProfileCard.jsx:137`       | "Couldn't load profile."     | `COLORS.red` only                           | **none** | **no**         |

Three surfaces, three recipes. One uses mono, two do not. Padding is 32, 16 and 0. None of the three is announced.

### 2.3 What the inventory corrected

Two claims made earlier in this project's planning were wrong, and are recorded
here so they are not re-derived:

- **`stats/TodaySnapshot.jsx:55` is not an empty state.** The italic muted line
  there is the unit label "exercise(s)" under a count. It is always rendered.
  It resembles E1/E2 because it uses the same declarations, which is precisely
  why an eyeball census is not evidence.
- **`stats/LeaderboardSection.jsx:99`'s raw `fontSize: 13` is not an empty-state
  drift.** It is the league countdown. (It is still a raw literal where
  `FONT_SIZE.base` would do — 13 is exactly `FONT_SIZE.base` — but that is an
  unrelated nit, not part of this system.)

---

## 3. Findings

**F1 — Errors are silent.** X1, X2 and X3 all appear _after_ an async failure,
replacing content that was previously loading. A sighted user sees the text
change; a screen-reader user is told nothing, because none of the three is a
live region. E1–E3 do not need announcement (they are present on first render),
but every error in this system does.

**F2 — Only one error offers recovery, and it is unreachable by the design
system.** X1's Retry is `<button style={{ textDecoration: 'underline' }}>` —
no `BUTTON` token, no `data-ui`, so `injectGlobalStyles`' single focus ring does
not match it. X2 and X3 are dead ends: the user's only recovery is to leave the
tab and come back.

**F3 — Empty and error are the same shape wearing different clothes.** Both are
"this region has no content, here is why, here is what you can do". They differ
in tone (muted versus error ink) and in whether recovery exists — not in
structure.

---

## 4. `StatusNote`

`src/components/ui/StatusNote.jsx`. Named for what it is: a note about a
region's status. Not `EmptyState`, which would not honestly cover half its
call sites.

```jsx
<StatusNote tone="empty" icon={BarChart3}>
  No exercises recorded yet.
</StatusNote>

<StatusNote tone="error" icon={AlertTriangle} action={{ label: 'Retry', onClick: retry }}>
  Could not load this deck.
</StatusNote>
```

### 4.1 API

| Prop       | Type                 | Default   | Rule                                                       |
| ---------- | -------------------- | --------- | ---------------------------------------------------------- |
| `tone`     | `'empty' \| 'error'` | `'empty'` | Selects ink and live-region behaviour.                     |
| `icon`     | component            | —         | **Required.** A `lucide-react` component, passed uncalled. |
| `action`   | `{ label, onClick }` | —         | Optional. Renders a `Button`.                              |
| `children` | node                 | —         | **Required.** The message.                                 |
| `as`       | element type         | `'div'`   | Root element.                                              |
| `style`    | object               | —         | Merged last, per the 1b merge-order contract.              |

`icon` is required rather than optional. An optional icon is one that call sites
omit, and the family drifts back to bare lines within a release. Requiring it
makes the omission unrepresentable.

`action` is a single object, not `actionLabel` + `onAction`. Two props that are
only valid together are a shape the type system cannot express; one object can
be present or absent.

### 4.2 Structure

`Stack` (`gap={3}`, `align="center"`) containing, in order: the icon, a `Body`,
and the `Button` when `action` is present. Centred text, `SPACE[6]` block
padding.

`StatusNote` composes and does not re-derive. It sets no font family, no font
size and no line height of its own — `Body` owns those. It sets no button
styling — `Button` owns that. Its whole contribution is the arrangement, the
tone, and the live-region behaviour.

### 4.3 Tone

| `tone`  | Ink           | Style   | Live region    |
| ------- | ------------- | ------- | -------------- |
| `empty` | `COLORS.mute` | italic  | none           |
| `error` | `COLORS.red`  | upright | `role="alert"` |

Italic is retained for `empty` because E1 and E2 already ship it and it reads as
the deliberate hush an absent-content note wants. `error` is upright: an error
set in italic reads as an aside.

**`TONE` gains a fourth entry.** `src/components/ui/tone.js` currently exports
three text tones and its comment states there are deliberately no more. That
prohibition is specifically about _accent-as-foreground_ — accents in this
system are fills carrying paired ink, and an accent used as text is the drift
`contrast.test.js` exists to catch. `error` is not that case: `c.error` is
already swept as a **foreground** against ground and against surface-1/2/3 in
both palettes (`contrast.test.js:62,120,180`). Adding `error: COLORS.red` to
`TONE` therefore introduces **no new contrast pair** and needs no new sweep.

The comment in `tone.js` must be updated in the same change to say three text
tones plus `error`, and to say why `error` qualifies where `accent` does not.
A code change that leaves a comment asserting the opposite is a worse defect
than the drift it fixes.

### 4.4 Icon

- Rendered at **32px**. The app's inline icons are 14–16px; a status note is a
  block-level statement, and 32 has existing precedent in this codebase.
- Always `aria-hidden="true"`. The message already carries the meaning, and an
  announced icon name would duplicate it.
- Colour is `currentColor`, inherited from the tone. One decision, not two, and
  the icon cannot drift out of contrast independently of its text.
- Passed as a component reference (`icon={BarChart3}`), not an element. This
  keeps size and `aria-hidden` under `StatusNote`'s control rather than
  repeating them at six call sites.

### 4.5 Accessibility

- `tone="error"` sets `role="alert"` on the root. This is the whole of finding
  F1: the three existing errors replace loading content asynchronously, and
  without a live region that substitution is silent.
- `tone="empty"` sets no role. Empty states render with the region on first
  paint; announcing them would interrupt for a non-event.
- The action, being a `Button`, carries `data-ui="button"` and therefore the
  global focus ring — resolving F2 without a per-call-site fix.

---

## 5. Call-site migration

Six call sites. Each keeps its existing copy verbatim; this change is about
structure, tone and recovery, not wording.

| #   | Surface                     | `tone`  | Icon                             | Action           |
| --- | --------------------------- | ------- | -------------------------------- | ---------------- |
| E1  | `PerTabBars.jsx:16`         | `empty` | `BarChart3` _(imported already)_ | —                |
| E2  | `ReviewFeed.jsx:22`         | `empty` | `BookOpen` _(imported already)_  | —                |
| E3  | `LeaderboardSection.jsx:66` | `empty` | `Users` _(new)_                  | —                |
| X1  | `VocabTab.jsx:300`          | `error` | `AlertTriangle` _(new)_          | existing `retry` |
| X2  | `LeaderboardSection.jsx:74` | `error` | `AlertTriangle`                  | **new** retry    |
| X3  | `ProfileCard.jsx:137`       | `error` | `AlertTriangle`                  | **new** retry    |

Every call site adds its own `lucide-react` import line; none of these files
imports one today except `VocabTab` (`Volume2`).

`BarChart3` and `BookOpen` are chosen because they are **already this app's
icons for those places** — `App.jsx` uses them for the Stats and Vocab nav tabs.
The Stats empty state therefore wears the Stats icon, which is a stronger reason
to pick them than novelty would be. `Users` and `AlertTriangle` are new to the
bundle; `AlertTriangle` is shared by all three error sites, so the error tone
has one face rather than three.

### 5.1 Adding recovery to X2 and X3

Both fetch inside a `useEffect` with a dependency array. Recovery is a `nonce`
in state, added to the deps, incremented by the action:

```js
const [nonce, setNonce] = useState(0);
useEffect(() => {
  /* unchanged */
}, [userId, nonce]);
// action={{ label: 'Retry', onClick: () => setNonce((n) => n + 1) }}
```

No change to data flow, no new fetch path, nothing hoisted.

**One thing the implementer must confirm rather than assume:** the effect in
`LeaderboardSection` calls `joinLeague()`, and its existing comment warns
against re-firing because a double-create is possible. Re-running on an explicit
retry is equivalent to leaving the tab and returning, which already re-runs the
same effect — so it should be safe. Verify that equivalence against
`joinLeague`'s implementation before relying on it; if it does not hold, X2 ships
without an action and the reason is recorded here.

---

## 6. Deliberately out of scope

**`ErrorBoundary.jsx` keeps its own full-page fallback.** It is a different
object: the whole app has died, the shell is gone, and the response is a
full-page card with an `h1` and a reload. Folding it in would mean either a
`fullPage` variant bloating `StatusNote` for one caller, or shrinking the
boundary's presence at the moment it most needs presence.

**Form submission errors keep their inline treatment** —
`FeedbackDialog.jsx:255` and `auth/MagicLinkForm.jsx:132`. These are dynamic
`{error}` strings sitting beside a submit button inside a dialog, not regions
reporting their own status. They are also, notably, the _only_ two error
surfaces in the app that already set `role="alert"` — they are the well-behaved
ones. A 32px icon block next to a submit button would be worse than what ships
today. Their remaining inconsistency is font size (`FONT_SIZE.sm` versus
`FONT_SIZE.tag`); that is a nit, and it is not this system.

**Loading states are not in this family, yet.** `LeaderboardSection.jsx:77` and
`ProfileCard.jsx:138` render bare muted "Loading…" text. They are the obvious
third tone, and `StatusNote` should be able to grow one — but a loading state
that flashes an icon on every fetch is a regression, so it needs its own
treatment of delay and motion. Not designed here; explicitly left for later so
the third tone is a decision rather than a drift.

**`AccountSection.jsx:189,219` are not errors.** They are the "DANGER ZONE"
heading and a destructive-action confirmation. They use error ink to mean
_danger_, which is correct, and they are not status reports.

---

## 7. Verification

**Unit — `StatusNote.test.jsx`:**

- Each tone maps to its documented ink, and only `error` carries `role="alert"`.
- The action renders only when `action` is passed, and its `onClick` fires.
- The icon is rendered and is `aria-hidden`.
- The action is a `data-ui="button"` element — the assertion that ties F2 shut.

**Unit — per migrated call site:** the existing tests for `PerTabBars`,
`ReviewFeed`, `LeaderboardSection`, `ProfileCard` and `VocabTab` assert on
rendered text and must keep passing **untouched**. If one needs editing, the
migration changed behaviour and the change is wrong until explained.

**Guard — no reintroduction:** a repository test asserting that the E1/E2 recipe
(`fontStyle: 'italic'` together with `COLORS.mute`) appears nowhere in
`src/components/stats/` **except at declared exceptions**.

The exception list is not a convenience. `stats/TodaySnapshot.jsx:55` uses that
exact recipe for the "exercise(s)" unit label (§2.3) and must *not* be migrated
— so a naive recipe scan fires on correct code, which is worse than no guard at
all. The allowlist is one entry, carries its reason inline, and any *second*
appearance fails the test.

The guard must print its denominator (files scanned) and ship both controls: a
positive case proving the matcher fires, and a negative proving it does not fire
on a migrated call site. A guard that has never been seen to fail is not a
guard.

**Not a browser probe.** Sub-project 2 needed `audit-layout.mjs` because it was
about geometry at 320px, which jsdom cannot compute. Nothing here is
geometry-dependent: a centred stack of three block elements has no overflow mode
that jsdom hides. Adding a Playwright probe would be ceremony.

**Contrast:** no new pairs. §4.3 records why.

---

## 8. Visible change

This is not a pure refactor, and should not be described as one:

- Four surfaces gain a 32px icon they do not have today.
- E3 gains italic and loses its bespoke padding.
- X1 loses mono and gains a real button in place of an underlined span.
- X2 and X3 gain a Retry control that did not exist.
- Errors become audible to screen readers for the first time.
