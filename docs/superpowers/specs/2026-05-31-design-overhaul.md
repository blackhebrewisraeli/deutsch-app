# Design Overhaul — Splash Screen, Color Palette & Micro-interactions

## Goal

Redesign the visual layer of Deutsch · Sprachschule to subconsciously encourage users to stay longer, using proven psychological design patterns from major platforms (Duolingo, Instagram, Spotify). No changes to AI logic or data structures.

## Scope

Two parallel tracks:
1. **Onboarding** — new splash/welcome screen with level selection
2. **Visual refresh** — new color palette + micro-animations throughout the app

---

## Track 1 — Splash Screen (Onboarding)

### Behavior
- Shown **once only** on first visit (controlled via `localStorage` key `deutsch-onboarded`)
- After level selection → 400ms fade-out → app loads normally
- Level is saved to `localStorage` as `deutsch-level` (`"beginner"` | `"intermediate"`)
- No way to "skip" — must choose a level to proceed
- Returning users go directly to the app; level is remembered

### Layout — Dramatic Flag (3 full-bleed stripes)

```
┌─────────────────────────────────────┐
│                                     │  stripe 1: #16110b (black)
│   Deutsch.        SPRACHSCHULE      │  logo centered, full height ~40%
│                                     │
├─────────────────────────────────────┤
│                                     │  stripe 2: #D62828 (red)
│       WHAT'S YOUR LEVEL?            │  level buttons, height ~35%
│   [ 🌱 BEGINNER ]  [ 📚 INTERMEDIATE ] │
│                                     │
├─────────────────────────────────────┤
│   LERNEN · SPRECHEN · VERSTEHEN     │  stripe 3: #F5C518 (gold)
└─────────────────────────────────────┘
```

### Typography
- Logo: Fraunces 900, 64px, white, `letter-spacing: -0.04em`
- "SPRACHSCHULE": JetBrains Mono, 10px, white 40% opacity, letter-spacing 0.4em
- "WHAT'S YOUR LEVEL?": JetBrains Mono, 11px, white 70% opacity, letter-spacing 0.3em
- Level buttons: JetBrains Mono 700, 13px
- Tagline: JetBrains Mono, 10px, `#16110b` 70% opacity, letter-spacing 0.3em

### Level Buttons (on red stripe)
- **Beginner** (unselected): `border: 2px solid rgba(255,255,255,0.4)`, white text, transparent background
- **Intermediate** (unselected): same
- **Selected state**: `background: #FFFFFF`, text in stripe color (`#D62828`), bold
- Hover: slight background brighten (`rgba(255,255,255,0.15)`)
- On click: button scales to 0.97 (100ms) then back, then fade-out begins

### Anna behavior per level
- **Beginner**: system prompt instructs simpler A1-A2 German, shorter sentences, more English translation
- **Intermediate**: current default behavior (A2-B1) — no change needed

### Component
- New file: `src/components/SplashScreen.jsx`
- Rendered in `App.jsx` before the main layout, conditionally on `!localStorage.getItem('deutsch-onboarded')`

---

## Track 2 — Color Palette Refresh

### New Design Tokens (`src/lib/theme.js`)

```js
// Current → New
paper:      '#f4ede0'  →  '#FDF3C0'   // gold tint (main background)
paperDeep:  '#e8dec9'  →  '#FFF8DC'   // slightly deeper gold
card:       (new)      →  '#FFFFFF'   // white — cards, panels, chat bubbles
ink:        '#16110b'  →  '#16110b'   // unchanged
red:        '#d62828'  →  '#D62828'   // unchanged
gold:       (new)      →  '#F5C518'   // German flag gold
mute:       '#7a6e5c'  →  '#7a6e5c'   // unchanged
```

### Where each token applies

| Element | Token |
|---|---|
| Page background | `paper` (`#FDF3C0`) |
| Header, nav bar | `ink` (`#16110b`) — unchanged |
| Chat messages (Anna) | `card` (`#FFFFFF`) |
| Chat messages (user) | `ink` (`#16110b`) — unchanged |
| Flashcard face | `card` (`#FFFFFF`) |
| Correction panel (no error) | `card` (`#FFFFFF`) |
| Correction panel (error) | `red` (`#D62828`) — unchanged |
| Vocab sidebar | `paperDeep` (`#FFF8DC`) |
| Streak icon background | `gold` (`#F5C518`) |
| Translate output box | `ink` (`#16110b`) — unchanged |
| Section labels | `ink` + `card` text |

---

## Track 3 — Micro-interactions & Animations

### Tab transitions
- Switching tabs: content fades in with `slide-up` animation (already defined in global CSS)
- Duration: 0.25s ease-out — no change needed, just ensure it applies consistently

### Streak — Psychological reinforcement
- Icon background: changes from red → **gold** (`#F5C518`)
- On streak increment: `bounce` keyframe (scale 1 → 1.15 → 1, 400ms)
- If user has not visited today AND streak > 0: subtle `pulse-gold` animation on the streak block (draws attention without being annoying). Detection: `stats.lastVisit !== new Date().toDateString()` — already computed in `App.jsx`. Pass as `pulsing` boolean prop to `StatBlock`.

```css
@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0.6); }
  50% { box-shadow: 0 0 0 10px rgba(245, 197, 24, 0); }
}
```

### Flashcard — Mark Learned
- On "MARK LEARNED" click: green checkmark briefly overlays the card (scale in 0.2s, fade out 0.4s)
- Card border flashes `#22c55e` for 300ms

### Deck completion celebration
- Trigger: user clicks "MARK LEARNED" on the last unlearned card in the active deck — i.e. `Object.values(learnedWords).filter(Boolean).length === activeDeck.length` after the mark action
- Effect: 1.5s confetti burst using CSS-only keyframes (gold + red particles, no library needed)
- After animation: show inline summary banner "✓ Deck complete — X words learned" (replaces the progress bar row, persists until user switches deck)

### Anna correction — slide-in
- Correction panel already animates with `.slide-up`
- Enhance: when correction appears, the panel border pulses red once (`pulse-red` — already defined)

### Progress bar — never empty
- In `VocabTab.jsx`, initialize progress display at minimum 1 segment filled (even if cardIdx === 0)
- Visual only — does not affect actual card index logic

---

## Files to Create / Modify

| Action | File | What changes |
|---|---|---|
| **Create** | `src/components/SplashScreen.jsx` | New splash component |
| **Modify** | `src/lib/theme.js` | New color tokens |
| **Modify** | `src/App.jsx` | Render SplashScreen, pass level to ChatTab, update CSS keyframes |
| **Modify** | `src/components/ChatTab.jsx` | Accept `level` prop, pass to system prompt |
| **Modify** | `src/components/VocabTab.jsx` | Deck completion celebration, min progress bar |
| **Modify** | `src/components/UI.jsx` | StatBlock Streak icon → gold background |

---

## Out of Scope (deliberately excluded)

- Mobile responsive layout (separate project)
- Dark mode
- User accounts / cloud persistence
- New AI features (grammar quiz, pronunciation scoring)
- TypeScript migration

---

## Success Criteria

1. First-time user sees the dramatic splash screen before anything else
2. Choosing "Beginner" makes Anna respond with simpler German than "Intermediate"
3. The app background is visibly gold-tinted (not parchment)
4. Cards and chat bubbles are white, creating clear contrast against the gold background
5. Streak icon is gold
6. Completing a full deck triggers a visible celebration
7. No regressions — all four tabs work identically to before
