# Playful Redesign — "Bavarian Playful" (Direction A)

**Date:** 2026-06-07
**Status:** Approved direction, spec under review
**Goal:** Make the app more aesthetic and entertaining — a warm, game-like feel — *without* losing the distinctive German-flag identity it already has.

---

## 1. Vision

Keep everything that makes Deutsch· recognizable (parchment background, ink/red/gold flag palette, Fraunces serif for German words, **the JetBrains Mono typewriter labels**) and add the things that make game apps feel alive: **rounded corners, soft depth/shadows, chunky "3D-press" buttons, a single friendly green for "correct," and pop/bounce motion with small celebrations.** The playful feel is delivered through shape, depth, color, and motion — *not* by softening the typography. The result is a distinctive "playful editorial" look.

The current look is "flat editorial" — hard 2px black borders, zero radius, no shadows, typewriter labels. We are deliberately moving *away* from the severe editorial flatness toward warmth and bounce, while keeping the same colors and serif character.

Non-goal: we are **not** going full Duolingo (bright green primary, departing from the flag identity). Green is a supporting "correct/go" accent only; red and gold still lead.

---

## 2. Design tokens (source of truth: `src/lib/theme.js`)

All changes are centralized in `theme.js` first; components then consume the new tokens. Where components currently hard-code `border: 2px solid ink` / fixed paddings, those get swapped for the new radius/shadow/button tokens during per-surface application.

### 2.1 Colors — add to existing `COLORS`

Keep all existing colors. Add:

| Token | Value | Use |
|---|---|---|
| `green` | `#3FA34D` | "correct," "go," success, Send button |
| `greenDeep` | `#2F7D3A` | the 3D bottom-lip shadow under green buttons |
| `greenSoft` | `#E7F3E9` | success backgrounds / subtle fills |
| `lip` | `#D9CD9F` | the 3D bottom-lip under white/paper buttons (a tan parchment-shadow) |
| `lipInk` | `#000000` | the 3D bottom-lip under ink (black) buttons |

Existing red/gold/ink/parchment unchanged. `rust` (#a82020) becomes the red button's 3D lip.

### 2.2 Radius — new `RADIUS` scale

```js
export const RADIUS = {
  sm:   10,   // tiles, small chips
  md:   14,   // buttons, inputs
  lg:   16,   // standard cards, nav pills
  xl:   22,   // hero cards (vocab flashcard, panels)
  pill: 999,  // fully round (avatars, badges, progress pills)
};
```

### 2.3 Elevation — new `SHADOW` scale (replaces "flat" look)

```js
export const SHADOW = {
  // 3D-press button lip: a hard offset shadow, no blur. Pair with translateY on :active.
  press:     (lip) => `0 4px 0 ${lip}`,
  // floating cards — soft ambient lift
  card:      '0 6px 16px rgba(22,17,11,0.08)',
  // chunky hero card — a hard parchment-colored drop (matches the mockup vocab card)
  cardChunk: '0 8px 0 rgba(22,17,11,0.10)',
  // nav / sticky bars
  bar:       '0 6px 18px rgba(22,17,11,0.08)',
};
```

### 2.4 Typography — keep the existing two-font system (editorial texture preserved)

Per reviewer decision, we **keep the typewriter/editorial character** — no new UI font is introduced. No Google Fonts change.

- **Keep** `FONTS.display` (Fraunces) for all big German content words (flashcard word, Anna's German line, hero titles).
- **Keep** `FONTS.mono` (JetBrains Mono) for *all* UI chrome — nav labels, button text, section labels/kickers, tags, stat labels, English translations, IPA. The uppercase typewriter labels stay; they are part of the identity.
- **No Baloo 2 / rounded UI font.** Playfulness is delivered entirely through *shape* (rounded corners), *depth* (shadows), *color* (green accent), and *motion* (pop/bounce/confetti) — not through a friendlier font. This yields a distinctive "playful editorial" look rather than a generic rounded game app.

### 2.5 Buttons — rework `BUTTON` variants to the 3D-press style

Every primary action button becomes chunky with a hard bottom lip and a press animation. New shape for each variant:

```js
// shared base — keeps the uppercase typewriter label (editorial texture)
const btnBase = {
  border: 'none',
  borderRadius: RADIUS.md,
  fontFamily: FONTS.mono,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'transform .08s ease, box-shadow .08s ease',
  // :active → transform: translateY(3px); box-shadow lip shrinks to 0 1px 0
};
```

- `BUTTON.go`   — green fill (#3FA34D), white text, `SHADOW.press(greenDeep)` — the main "CHECK / Send / continue" CTA
- `BUTTON.primary` — ink fill, paper text, `SHADOW.press(lipInk)` — neutral primary (NEXT, nav active)
- `BUTTON.danger` — red fill, paper text, `SHADOW.press(rust)` — kept for destructive/alert CTAs
- `BUTTON.tile` — white fill, ink text, `SHADOW.press(lip)` — answer tiles / multiple-choice / word tiles
- `BUTTON.ghost` — transparent, used on dark surfaces (correction panel)

Press interaction: because inline styles can't do `:active`, add a tiny reusable `Pressable` wrapper (or `onPointerDown/Up` handlers) that applies the translateY + lip-shrink. (Implementation detail for the plan — likely a small `Button` component in `components/ui/`.)

### 2.6 Cards & inputs

- `CARD.base` → white, `RADIUS.xl`, `SHADOW.card` (was: 2px border, no radius). Hard borders removed in favor of shadow-defined edges.
- `CARD.soft` → paperDeep, `RADIUS.lg`, `SHADOW.card`.
- `CARD.dark` → ink, `RADIUS.lg` (chat/correction surfaces).
- Inputs → `RADIUS.md`, subtle inset shadow `inset 0 2px 4px rgba(0,0,0,.04)`, no hard border.
- The dot-grid page background is **kept** (it's a nice subtle texture that survives the restyle).

---

## 3. Motion (new keyframes in `App.jsx` `<style>` block)

Add to the existing keyframes (`blink`, `pulse-red`, `slide-up`, `bounce`, `pulse-gold`, `shimmer`):

| Name | Trigger | Effect |
|---|---|---|
| `pop` | correct answer / card flip-in | scale 0.9→1.06→1 over ~280ms (a satisfying bounce) |
| `press` | button active (via Pressable) | translateY(3px) + lip shrink, ~80ms |
| `celebrate` | deck complete / milestone | the celebration card scales in + a lightweight CSS confetti burst |
| `wiggle` | wrong answer (gentle, optional) | small ±3° rotate shake, ~300ms |

**Confetti:** a small dependency-free CSS/JS burst (a handful of absolutely-positioned colored squares animating up+out), reused for deck-complete and streak milestones. No new npm package — keep it lightweight.

**Reduced motion:** respect `@media (prefers-reduced-motion: reduce)` — disable pop/wiggle/confetti, keep instant state changes.

---

## 4. Per-surface application

The redesign touches every tab. Each surface, and the key change:

1. **Header** — logo unchanged; STREAK/LEARNED stat blocks become rounded chips with `SHADOW.card`; flame/check icons sit in `pill` circles.
2. **Nav** — the 5 tabs become rounded pills inside a `SHADOW.bar` container; active tab = ink fill with `SHADOW.press(lipInk)`; each tab gets a small emoji/icon; the Stats attention badge becomes a soft red `pill` dot.
3. **SplashScreen** — keep the German-flag 3-band layout; level buttons become chunky 3D-press cards with radius + lift; add a gentle entrance bounce.
4. **Chat** — Anna gets a circular avatar (emoji to start, mascot later); messages become rounded speech bubbles (gold for Anna w/ tail, ink for user); task panel → rounded red card; input row → chunky mic + rounded input + green Send; welcome banner → rounded.
5. **Alphabet** — quiz letter tiles → `BUTTON.tile`; the audio "play" button → big round `pill`; correct/wrong feedback uses pop + green/red.
6. **Vocab** — flashcard → white `RADIUS.xl` card with `SHADOW.cardChunk`; multiple-choice + Hard/Good/Easy → 3D-press buttons; progress dots → rounded green pills; deck-complete → `celebrate` + confetti.
7. **Translate** — word tiles & blank tiles → `BUTTON.tile`; CHECK → `BUTTON.go`; FeedbackPanel → rounded, with pop on result.
8. **Stats** — widgets get `RADIUS.lg` + `SHADOW.card`; heatmap squares get a touch of radius; bars get rounded ends; the review-feed rows become rounded tappable cards.

---

## 5. Scope & sequencing (for the implementation plan)

This is a large but mechanical change because tokens are centralized. Proposed build order (each a verifiable step / commit):

1. **Tokens + fonts** — add green/lip colors, `RADIUS`, `SHADOW`, `FONTS.round`; load Baloo 2; add motion keyframes + reduced-motion guard. No visual change yet beyond fonts.
2. **Shared primitives** — a small `components/ui/` with `Button` (Pressable 3D), `Card`, and `Confetti`. Rework `BUTTON`/`CARD` tokens.
3. **Chrome** — Header + Nav + SplashScreen.
4. **Exercise tabs** — Vocab, Translate, Alphabet (the buttons/cards/tiles).
5. **Chat** — bubbles, avatar, task panel, input row.
6. **Stats** — widget cards, bars, review rows.
7. **Motion polish** — pop on correct, celebrate + confetti on milestones, wiggle on wrong.

Each step: lint + build + browser screenshot pass. No logic changes — this is presentation only, so the 142 existing tests stay green throughout (they cover `lib/`/`data/`, not styling).

---

## 6. Decisions made (delegated by / confirmed with user)

- **Green** is a minimal "correct/go" accent only; red + gold still lead.
- **Anna** gets an emoji avatar now; a custom mascot is a possible later add-on.
- **Typography unchanged** — keep Fraunces (German words) + JetBrains Mono (all UI chrome, uppercase labels). Editorial typewriter texture is *preserved*; playfulness comes from shape/depth/color/motion, not font. *(Reviewer chose to keep the editorial texture.)*
- **All-in rollout** — apply the restyle across all tabs in one coordinated effort; no single-tab pilot. *(Reviewer choice.)*
- **No new heavy dependencies** — confetti is hand-rolled CSS/JS; no new font load.

## 7. Resolved questions

1. *Keep the typewriter/mono look?* → **Yes, keep it.** Mono stays across all UI chrome (see §2.4).
2. *Pilot one tab first, or all-in?* → **All-in** (see §5/§6).
