# Playful Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Deutsch app into the approved "playful editorial" look — rounded cards, soft depth, chunky 3D-press buttons, a green "correct" accent, and pop/bounce/confetti motion — while keeping the German-flag palette, Fraunces serif, and JetBrains Mono labels.

**Architecture:** All visual change flows from centralized tokens in `src/lib/theme.js` (new `RADIUS`, `SHADOW`, extra `COLORS`, reworked `BUTTON`/`CARD`) plus three new reusable primitives in `src/components/ui/` (`Button`, `Card`, `Confetti`). Motion lives as keyframes in the global `<style>` block in `App.jsx`. Surfaces are then migrated tab-by-tab to consume the new tokens/primitives. **Presentation only — no logic changes.**

**Tech Stack:** React 18, Vite, inline-style design tokens (no CSS framework), Vitest (142 existing tests must stay green).

**Branch:** `playful-redesign` (already created; spec committed).

---

## Conventions for every task

- **No logic changes.** Only styling, markup wrappers, and motion. State, handlers, data flow stay identical.
- **Verification per task** (there are no component unit tests — the guard is build + lint + the existing suite + a visual check):
  1. `npm test` → Expected: `Tests 142 passed (142)`
  2. `npm run lint` → Expected: no output (clean)
  3. `npm run build` → Expected: `✓ built` with no errors
  4. Browser screenshot pass (dev server) of the affected tab — confirm it renders and matches the spec.
- **Commit** at the end of each task with the message shown.
- The dev-server + screenshot recipe (used in the verify steps):
  ```bash
  npm run dev   # background; wait for port 5173
  # then drive with the browser tool: navigate localhost:5173, seed localStorage as needed, screenshot the tab
  ```

---

## File Structure

**Create:**
- `src/components/ui/Button.jsx` — Pressable 3D-press button; reads `BUTTON[variant]` tokens.
- `src/components/ui/Card.jsx` — rounded card wrapper; reads `CARD[variant]` tokens.
- `src/components/ui/Confetti.jsx` — dependency-free confetti burst (absolutely-positioned squares).

**Modify:**
- `src/lib/theme.js` — add `COLORS` (green/greenDeep/greenSoft/lip), `RADIUS`, `SHADOW`; rework `BUTTON`, `CARD`. Fonts unchanged.
- `src/App.jsx` — add motion keyframes + `prefers-reduced-motion` guard to the global `<style>`; restyle Header + Nav.
- `src/components/UI.jsx` — restyle `StatBlock`, `Hero`, `SectionLabel` (rounded chips, no behavior change).
- `src/components/SplashScreen.jsx` — chunky level cards.
- `src/components/VocabTab.jsx` — card + answer buttons via primitives.
- `src/components/TranslateTab.jsx` + `src/components/translate/{FeedbackPanel,TileExercise,BlankExercise,TypingExercise,PromptCard}.jsx` — tiles/buttons/cards.
- `src/components/AlphabetTab.jsx` — quiz tiles + play button.
- `src/components/ChatTab.jsx` + `src/components/chat/{MessageBubble,TaskPanel,ChatInput,CorrectionPanel,WelcomeBanner,ScenarioPicker}.jsx` — bubbles, avatar, rounded panels.
- `src/components/StatsTab.jsx` — widget cards, rounded bars, review rows.

---

## Task 1: Design tokens — colors, radius, shadow

**Files:**
- Modify: `src/lib/theme.js`

- [ ] **Step 1: Add new colors.** In `src/lib/theme.js`, inside the `COLORS` object, after the `gold` line, add:

```js
  // Playful redesign additions
  green:     '#3FA34D',   // "correct / go" — success, Send/Check CTA
  greenDeep: '#2F7D3A',   // 3D bottom-lip under green buttons
  greenSoft: '#E7F3E9',   // subtle success backgrounds
  lip:       '#D9CD9F',   // 3D bottom-lip under white/paper buttons (tan parchment-shadow)
```

(`rust` #a82020 already exists and is reused as the red button lip; the ink lip is `#000000`.)

- [ ] **Step 2: Add the `RADIUS` scale.** After the `BORDER` export (around line 111), add:

```js
// ── Radius ───────────────────────────────────────────────────
export const RADIUS = {
  sm:   10,   // tiles, small chips
  md:   14,   // buttons, inputs
  lg:   16,   // standard cards, nav pills
  xl:   22,   // hero cards (flashcard, panels)
  pill: 999,  // fully round (avatars, badges, progress pills)
};
```

- [ ] **Step 3: Add the `SHADOW` scale.** Immediately after `RADIUS`, add:

```js
// ── Elevation ────────────────────────────────────────────────
export const SHADOW = {
  // 3D-press button lip: hard offset, no blur. Pair with translateY on press.
  press:     (lipColor) => `0 4px 0 ${lipColor}`,
  // soft floating card lift
  card:      '0 6px 16px rgba(22,17,11,0.08)',
  // chunky hero card — hard parchment drop (flashcard)
  cardChunk: '0 8px 0 rgba(22,17,11,0.10)',
  // nav / sticky bars
  bar:       '0 6px 18px rgba(22,17,11,0.08)',
};
```

- [ ] **Step 4: Verify build + tests.**

Run: `npm run build && npm test`
Expected: build `✓ built`, `Tests 142 passed (142)`. (No visual change yet — tokens are additive.)

- [ ] **Step 5: Commit.**

```bash
git add src/lib/theme.js
git commit -m "feat(theme): add green/lip colors, RADIUS and SHADOW scales"
```

---

## Task 2: Rework BUTTON and CARD tokens

**Files:**
- Modify: `src/lib/theme.js:142-217` (the `BUTTON` block + `btnSecondary` alias) and the `CARD` block.

- [ ] **Step 1: Replace the entire `BUTTON` export** (lines ~142-214) with this. It keeps existing variant names (`primary`, `danger`, `secondary`, `ghost`) so current imports keep working, and adds `go` and `tile`:

```js
// ── Buttons ──────────────────────────────────────────────────
// Resting styles only. The <Button> primitive (components/ui/Button.jsx)
// adds the press interaction (translateY + lip-shrink) on pointer-down.
const btnBase = {
  border:        'none',
  borderRadius:  RADIUS.md,
  fontFamily:    FONTS.mono,
  fontWeight:    FONT_WEIGHT.bold,
  fontSize:      FONT_SIZE.sm,
  letterSpacing: LETTER_SPACING.widest,
  textTransform: 'uppercase',
  padding:       `${SPACE[4]}px ${SPACE[6]}px`,
  cursor:        'pointer',
  display:       'flex',
  alignItems:    'center',
  justifyContent:'center',
  gap:           SPACE[2],
  transition:    'transform .08s ease, box-shadow .08s ease',
};

export const BUTTON = {
  // Green — the main "correct / go" CTA (Check, Send, continue)
  go:        { ...btnBase, background: COLORS.green, color: COLORS.paper, boxShadow: SHADOW.press(COLORS.greenDeep) },
  // Ink — neutral primary (Next, nav-style)
  primary:   { ...btnBase, background: COLORS.ink,   color: COLORS.paper, boxShadow: SHADOW.press('#000000') },
  // Red — alert / destructive CTA
  danger:    { ...btnBase, background: COLORS.red,   color: COLORS.paper, boxShadow: SHADOW.press(COLORS.rust) },
  // White — answer tiles / multiple choice / word tiles
  tile:      { ...btnBase, background: COLORS.card,  color: COLORS.ink,   boxShadow: SHADOW.press(COLORS.lip) },
  // White, flex:1 — secondary actions (kept name for back-compat)
  secondary: { ...btnBase, background: COLORS.card,  color: COLORS.ink,   boxShadow: SHADOW.press(COLORS.lip), flex: 1 },
  // Transparent — on dark surfaces (HEAR IT, correction). No lip.
  ghost: {
    ...btnBase,
    background:    'transparent',
    color:         COLORS.paper,
    border:        BORDER.ghost,
    boxShadow:     'none',
    textTransform: 'none',
    fontSize:      FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.wider,
    padding:       `${SPACE[1]}px ${SPACE[3]}px`,
  },
};

// Backward-compat alias — UI.jsx re-exports this
export const btnSecondary = BUTTON.secondary;
```

- [ ] **Step 2: Replace the `CARD` export** with rounded + shadow (remove the hard borders):

```js
// ── Cards / panels ───────────────────────────────────────────
export const CARD = {
  base:  { background: COLORS.card,      borderRadius: RADIUS.xl, boxShadow: SHADOW.card,      color: COLORS.ink },
  dark:  { background: COLORS.ink,       borderRadius: RADIUS.lg, color: COLORS.paper },
  soft:  { background: COLORS.paperDeep, borderRadius: RADIUS.lg, boxShadow: SHADOW.card,      color: COLORS.ink },
  alert: { background: COLORS.red,       borderRadius: RADIUS.lg, color: COLORS.paper },
};
```

- [ ] **Step 2.5: `RADIUS`/`SHADOW`/`COLORS` must be declared above `BUTTON`/`CARD`.** They are (Task 1 placed `RADIUS`/`SHADOW` right after `BORDER`, ~line 111; `BUTTON` starts ~142). Confirm ordering after editing.

- [ ] **Step 3: Verify build + lint + tests.**

Run: `npm run build && npm run lint && npm test`
Expected: build `✓ built`, lint clean, `142 passed`. Existing buttons now render rounded with a lip (no press animation yet — that arrives with the primitive). This is acceptable interim state.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/theme.js
git commit -m "feat(theme): rework BUTTON (add go/tile, 3D lip) and CARD (rounded + shadow)"
```

---

## Task 3: Motion keyframes + reduced-motion guard

**Files:**
- Modify: `src/App.jsx` (the global `<style>` block, currently ~lines 93-108)

- [ ] **Step 1: Add keyframes.** Inside the existing `<style>{`...`}</style>` block in `App.jsx`, after the existing `.slide-up` animation line, add:

```css
        @keyframes pop      { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
        @keyframes wiggle   { 0%, 100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-4px) rotate(-1.5deg); } 75% { transform: translateX(4px) rotate(1.5deg); } }
        @keyframes confetti { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), 120px) rotate(var(--rot)); opacity: 0; } }
        .pop    { animation: pop 0.28s ease-out; }
        .wiggle { animation: wiggle 0.30s ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .pop, .wiggle, .slide-up { animation: none !important; }
        }
```

- [ ] **Step 2: Verify build.**

Run: `npm run build`
Expected: `✓ built`. (Keyframes unused as yet — no visual change.)

- [ ] **Step 3: Commit.**

```bash
git add src/App.jsx
git commit -m "feat(motion): add pop/wiggle/confetti keyframes + reduced-motion guard"
```

---

## Task 4: `Button` primitive (3D press)

**Files:**
- Create: `src/components/ui/Button.jsx`

- [ ] **Step 1: Create the component.** Full file:

```jsx
import { useState } from 'react';
import { BUTTON } from '../../lib/theme';

// Chunky 3D-press button. Reads resting styles from BUTTON[variant] and adds
// the press interaction (translateY + lip-shrink) on pointer-down — inline
// styles can't express :active, so we track it in state.
export default function Button({
  variant = 'primary',
  style,
  children,
  onClick,
  disabled = false,
  type = 'button',
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const base = BUTTON[variant] ?? BUTTON.primary;

  // Shrink the 4px lip to 1px and sink the button 3px while pressed.
  const pressStyle =
    pressed && !disabled && typeof base.boxShadow === 'string'
      ? { transform: 'translateY(3px)', boxShadow: base.boxShadow.replace('0 4px 0', '0 1px 0') }
      : null;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...base,
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
        ...style,
        ...pressStyle,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Smoke-test it renders.** Temporarily import and drop `<Button variant="go">CHECK →</Button>` into any tab, run the dev server, confirm it shows green and sinks on click, then remove the temporary usage. (Real wiring happens in the surface tasks.)

- [ ] **Step 3: Verify build + lint.**

Run: `npm run lint && npm run build`
Expected: lint clean, `✓ built`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/ui/Button.jsx
git commit -m "feat(ui): add Button primitive with 3D-press interaction"
```

---

## Task 5: `Card` primitive

**Files:**
- Create: `src/components/ui/Card.jsx`

- [ ] **Step 1: Create the component.** Full file:

```jsx
import { CARD } from '../../lib/theme';

// Rounded, soft-shadow card. Spread CARD[variant] then allow per-use overrides.
export default function Card({ variant = 'base', style, children, ...rest }) {
  return (
    <div style={{ ...(CARD[variant] ?? CARD.base), ...style }} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint.**

Run: `npm run lint && npm run build`
Expected: lint clean, `✓ built`.

- [ ] **Step 3: Commit.**

```bash
git add src/components/ui/Card.jsx
git commit -m "feat(ui): add Card primitive (rounded + shadow)"
```

---

## Task 6: `Confetti` primitive

**Files:**
- Create: `src/components/ui/Confetti.jsx`

- [ ] **Step 1: Create the component.** Full file (relies on the `confetti` keyframe from Task 3):

```jsx
import { useMemo } from 'react';
import { COLORS } from '../../lib/theme';

const PIECE_COLORS = [COLORS.red, COLORS.gold, COLORS.green, COLORS.ink];

// Dependency-free celebration burst. Mount it (conditionally, from the parent)
// to play once; absolutely positioned, fills its nearest positioned ancestor.
export default function Confetti({ count = 28 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        bg: PIECE_COLORS[i % PIECE_COLORS.length],
        delay: Math.random() * 0.15,
        dx: (Math.random() - 0.5) * 240,
        rot: Math.random() * 720 - 360,
        dur: 0.9 + Math.random() * 0.6,
      })),
    [count]
  );

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: '38%',
            left: `${p.left}%`,
            width: 8,
            height: 8,
            background: p.bg,
            borderRadius: 2,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
            animation: `confetti ${p.dur}s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add a reduced-motion guard for confetti.** In `App.jsx`'s `@media (prefers-reduced-motion: reduce)` block (added in Task 3), append a rule so confetti pieces don't animate. Since the pieces use an inline `animation`, the cleanest guard is to give the burst a class. Update `Confetti.jsx` wrapper `<div>` to add `className="confetti-layer"`, then in `App.jsx` reduced-motion block add:

```css
          .confetti-layer { display: none !important; }
```

- [ ] **Step 3: Verify build + lint.**

Run: `npm run lint && npm run build`
Expected: lint clean, `✓ built`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/ui/Confetti.jsx src/App.jsx
git commit -m "feat(ui): add dependency-free Confetti burst + reduced-motion guard"
```

---

## Task 7: Chrome — Header, Nav, and shared UI bits

**Files:**
- Modify: `src/App.jsx` (Header ~110-191, Nav ~193-251)
- Modify: `src/components/UI.jsx` (`StatBlock` ~14-48, `SectionLabel` ~52-68, `Hero` ~72-103)

**Mapping rules (apply throughout):**
- Any `border: 2px solid ${COLORS.ink}` on a container → remove border, add `borderRadius: RADIUS.lg`, `boxShadow: SHADOW.card` (or `SHADOW.bar` for sticky bars).
- Keep all mono fonts/labels.

- [ ] **Step 1: Nav pills.** In `App.jsx` nav, wrap the tab row so the `<nav>` becomes a rounded bar: set the `<nav>` style to `borderBottom: 'none'`, add `margin: '0 16px'` (desktop), `borderRadius: RADIUS.lg`, `boxShadow: SHADOW.bar`, `padding: 8`, `gap: 8`, `background: COLORS.paper`. Each tab `<button>`: remove `borderRight`, add `borderRadius: RADIUS.md`; active tab `background: COLORS.ink` + `boxShadow: SHADOW.press('#000000')`; keep the `num` + `label` mono text and the emoji-free icon. Keep the existing red active-dot OR replace with the existing Stats badge logic (unchanged). Keep mobile icon-only behavior; just add `borderRadius`.

- [ ] **Step 2: Header stat chips.** In `UI.jsx` `StatBlock`, change the icon container to `borderRadius: RADIUS.pill` (circle) and wrap the label+value in a chip: add `borderRadius: RADIUS.lg`, `boxShadow: SHADOW.card`, `background: COLORS.card`, `padding: '6px 12px'`. Keep `pulsing` animation prop behavior.

- [ ] **Step 3: SectionLabel + Hero.** `SectionLabel` — no structural change needed (it's text); leave as-is. `Hero` — leave type as-is (Fraunces title stays); optionally soften the `borderBottom` divider to `1px solid ${COLORS.ink}20`. (Keep minimal.)

- [ ] **Step 4: Verify.** Run the 4-step verification (test/lint/build/screenshot). Screenshot the app header+nav on any tab; confirm rounded pills + chips, active tab sunk, Stats badge intact.

- [ ] **Step 5: Commit.**

```bash
git add src/App.jsx src/components/UI.jsx
git commit -m "style(chrome): rounded nav pills + header stat chips"
```

---

## Task 8: SplashScreen

**Files:**
- Modify: `src/components/SplashScreen.jsx`

- [ ] **Step 1: Chunky level cards.** Replace each level `<button>`'s flat border style with `BUTTON.tile` shape: `borderRadius: RADIUS.lg`, `boxShadow: SHADOW.press(COLORS.lip)`, no hard border. Keep the 3-band German-flag layout and the existing `onComplete(level)` handler. Optionally wrap each with the `Button` primitive (`variant="tile"`) for the press effect — but keep the existing `onClick`/level logic.

- [ ] **Step 2: Entrance bounce.** Add `className="pop"` to the level-button container so they pop in on mount.

- [ ] **Step 3: Verify.** 4-step verification; screenshot the splash (clear `deutsch-onboarded` in localStorage to see it).

- [ ] **Step 4: Commit.**

```bash
git add src/components/SplashScreen.jsx
git commit -m "style(splash): chunky rounded level cards + entrance pop"
```

---

## Task 9: Vocab tab

**Files:**
- Modify: `src/components/VocabTab.jsx`

- [ ] **Step 1: Flashcard.** The white card showing the German word: replace `border: BORDER.standard` with `borderRadius: RADIUS.xl` + `boxShadow: SHADOW.cardChunk`. Keep the Fraunces word + mono IPA.
- [ ] **Step 2: Progress pills.** The deck progress dots: `borderRadius: RADIUS.pill`, learned = `COLORS.green`, unlearned = `#e7dcae`.
- [ ] **Step 3: Multiple-choice + Hard/Good/Easy buttons.** Replace the inline `<button>`s with the `Button` primitive: MC options use `variant="tile"`; the correct-answer highlight on answer uses `variant="go"`; the typed-answer CHECK uses `variant="go"`; Hard = `variant="tile"`, Good = `variant="primary"`, Easy = `variant="go"`. Keep every existing `onClick` handler (`recordVocabAnswer`, `markLearned`, `advanceQueue`, the `clickLockRef` guard) exactly.
- [ ] **Step 4: Deck-complete banner → celebration.** Keep the existing shimmer banner but add `<Confetti />` inside a `position: relative` wrapper when `deckComplete` is true. Add `className="pop"` to the banner.
- [ ] **Step 5: Verify.** 4-step verification; screenshot Vocab (seed an SRS state if helpful). Click an answer → confirm pop + green correct + 3D press. Confirm `LEARNED` still increments correctly (logic unchanged).
- [ ] **Step 6: Commit.**

```bash
git add src/components/VocabTab.jsx
git commit -m "style(vocab): rounded flashcard, 3D answer buttons, confetti on deck complete"
```

---

## Task 10: Translate tab

**Files:**
- Modify: `src/components/translate/FeedbackPanel.jsx`, `TileExercise.jsx`, `BlankExercise.jsx`, `TypingExercise.jsx`, `PromptCard.jsx`

- [ ] **Step 1: PromptCard.** Replace `BORDER.standard` with `borderRadius: RADIUS.lg` + `boxShadow: SHADOW.card`.
- [ ] **Step 2: Word/blank tiles.** In `TileExercise` and `BlankExercise`, swap the inline tile `<button>`s for `Button variant="tile"`; the CHECK button → `Button variant="go"`; the skip button → `Button variant="secondary"`. Keep `check`, `addTile`, `removeTile`, `fillNext`, `clearBlank`, `onSkip` handlers exactly.
- [ ] **Step 3: TypingExercise.** Textarea → `borderRadius: RADIUS.md`, inset shadow, no hard border. CHECK → `Button variant="go"`; skip → `Button variant="secondary"`.
- [ ] **Step 4: FeedbackPanel.** Container → `borderRadius: RADIUS.lg` + `SHADOW.card`; keep the three-way `verdict` colors (correct=gold, almost=paperDeep, wrong=red). NEXT → `Button variant="primary"` for correct / `Button variant="go"` otherwise (keep current color logic). Add `className="pop"` to the panel so results pop in.
- [ ] **Step 5: Verify.** 4-step verification; screenshot Translate at A1 (assemble tiles → CHECK → pop feedback) and A2 (blanks render).
- [ ] **Step 6: Commit.**

```bash
git add src/components/translate/
git commit -m "style(translate): rounded tiles/cards, 3D buttons, pop feedback"
```

---

## Task 11: Alphabet tab

**Files:**
- Modify: `src/components/AlphabetTab.jsx`

- [ ] **Step 1: Quiz letter tiles.** The four letter-choice `<button>`s → `Button variant="tile"` (keep `handleLetterGuess`). On answer, the chosen tile shows green (`variant="go"`) if correct / red (`variant="danger"`) if wrong; add `className="pop"` to the result.
- [ ] **Step 2: Audio play button.** The big "play" button → circle: `borderRadius: RADIUS.pill`, `boxShadow: SHADOW.press(COLORS.greenDeep)` (or keep gold with `SHADOW.press` using a gold-deep `#caa10f`). Keep `speak()` handler.
- [ ] **Step 3: Browse-mode letter grid.** Soften the grid cells: `borderRadius: RADIUS.sm`; keep the existing letter+word layout.
- [ ] **Step 4: Verify.** 4-step verification; screenshot Alphabet quiz + browse.
- [ ] **Step 5: Commit.**

```bash
git add src/components/AlphabetTab.jsx
git commit -m "style(alphabet): rounded quiz tiles, round play button, pop feedback"
```

---

## Task 12: Chat tab

**Files:**
- Modify: `src/components/chat/MessageBubble.jsx`, `TaskPanel.jsx`, `ChatInput.jsx`, `CorrectionPanel.jsx`, `WelcomeBanner.jsx`, `ScenarioPicker.jsx`

- [ ] **Step 1: Anna avatar + bubbles.** In `MessageBubble`, add a circular avatar (`borderRadius: RADIUS.pill`, gold bg, emoji `🧑‍🏫`) beside Anna's messages. Bubble: gold for Anna with `borderRadius: '20px 20px 20px 6px'` (tail) + `SHADOW.press('rgba(22,17,11,.10)')`; user bubble ink with `borderRadius: '20px 20px 6px 20px'`. Keep the `speak()` button + IPA (mono) + English (kept; mono or body as today).
- [ ] **Step 2: TaskPanel.** Red card → `borderRadius: RADIUS.lg` + `SHADOW.press(COLORS.rust)`; "all done" gold card → `borderRadius: RADIUS.lg`. Keep `SHOW HINT`/reset handlers.
- [ ] **Step 3: ChatInput.** Mic button → `borderRadius: RADIUS.md` chunky (`SHADOW.press('#000000')`); text input → `borderRadius: RADIUS.md`, inset shadow, no hard border; Send → `Button variant="go"`. Keep `onSend`/`onStartListening`/`onStopListening`.
- [ ] **Step 4: CorrectionPanel + WelcomeBanner + ScenarioPicker.** Correction `<aside>` panel → `borderRadius: RADIUS.lg`; keep red/parchment states. WelcomeBanner → `borderRadius: RADIUS.lg`. ScenarioPicker buttons → `borderRadius` on the container + active state; keep `setScenario`.
- [ ] **Step 5: Verify.** 4-step verification; screenshot Chat (welcome banner, Anna bubble + avatar, task card, input row, correction panel).
- [ ] **Step 6: Commit.**

```bash
git add src/components/chat/
git commit -m "style(chat): avatar + rounded bubbles, chunky input, rounded panels"
```

---

## Task 13: Stats tab

**Files:**
- Modify: `src/components/StatsTab.jsx`

- [ ] **Step 1: Widget cards.** Each section container (Today, By section, Accuracy, Vocab queue) → `borderRadius: RADIUS.lg` + `SHADOW.card`, remove hard borders.
- [ ] **Step 2: Bars + heatmap.** Bar fills (`PerTabBars`, `AccuracyByLevel`, SRS progress) → rounded ends (`borderRadius: RADIUS.pill` on the fill). Heatmap cells → `borderRadius: 3`.
- [ ] **Step 3: Review-feed rows.** Each tappable review row → `borderRadius: RADIUS.md` + hover `SHADOW.card`; keep the `onReview` click handler and badges.
- [ ] **Step 4: Verify.** 4-step verification; screenshot Stats with seeded data (daily + items + srs).
- [ ] **Step 5: Commit.**

```bash
git add src/components/StatsTab.jsx
git commit -m "style(stats): rounded widget cards, pill bars, tappable review rows"
```

---

## Task 14: Motion polish — pop on correct, celebrate on milestones, wiggle on wrong

**Files:**
- Modify: `src/components/VocabTab.jsx`, `src/components/AlphabetTab.jsx`, `src/components/translate/FeedbackPanel.jsx` (most `pop` hooks added in earlier tasks — this task fills gaps + adds `wiggle` + streak confetti)

- [ ] **Step 1: Wrong-answer wiggle.** In Vocab MC/typed-wrong, Alphabet wrong, and Translate wrong feedback, add `className="wiggle"` to the result/feedback element when the verdict is `wrong`.
- [ ] **Step 2: Streak-milestone confetti.** In `App.jsx`, when `stats.streak` crosses a milestone (every 7) on load, render `<Confetti />` once over the header for ~1.2s (a `useState` flag cleared by `setTimeout`). Keep it lightweight; guard with the reduced-motion class already in place.
- [ ] **Step 3: Verify.** 4-step verification; screenshot a wrong answer (wiggle) and confirm confetti fires on a seeded 7-streak.
- [ ] **Step 4: Commit.**

```bash
git add src/components/VocabTab.jsx src/components/AlphabetTab.jsx src/components/translate/FeedbackPanel.jsx src/App.jsx
git commit -m "feat(motion): wiggle on wrong, confetti on streak milestones"
```

---

## Final: full regression pass + finish the branch

- [ ] **Step 1: Full verification.** `npm test` (142 pass) + `npm run lint` (clean) + `npm run build` (`✓ built`).
- [ ] **Step 2: Whole-app screenshot tour.** Dev server; screenshot all 5 tabs + splash to confirm the cohesive playful-editorial look.
- [ ] **Step 3:** Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR for `playful-redesign`.

---

## Notes for the executor

- **Keep imports clean** — when a file stops using `BORDER`/`BUTTON` inline objects in favor of the `Button`/`Card` primitives, remove now-unused imports (lint will flag them).
- **`Button` press + disabled** — the primitive already greys-out + blocks pointer when `disabled`; pass `disabled` instead of manually styling opacity.
- **Don't touch logic** — if a change requires editing a handler, stop: it's out of scope. The 142 tests must stay green every task.
- **Mobile** — preserve the existing `mobile` branches; just add `borderRadius`/shadow, don't restructure the responsive layout.
