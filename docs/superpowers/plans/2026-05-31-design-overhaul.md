# Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Deutsch · Sprachschule with German flag colors, a dramatic splash screen with level selection, and psychological micro-interactions to subconsciously keep users engaged.

**Architecture:** Three independent tracks executed in sequence — (1) color tokens first since everything else depends on them, (2) new SplashScreen component wired into App.jsx with level state, (3) micro-interactions added to VocabTab and StatBlock. No new dependencies required.

**Tech Stack:** React 18, Vite 5, inline styles, CSS keyframes in App.jsx `<style>` block, localStorage for onboarding + level persistence.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/theme.js` | Add `card`, `gold` tokens; update `paper`, `paperDeep` |
| Modify | `src/components/UI.jsx` | StatBlock: gold streak, `pulsing` prop |
| Create | `src/components/SplashScreen.jsx` | Dramatic flag splash + level picker |
| Modify | `src/App.jsx` | Level + showSplash state, new keyframes, wire SplashScreen |
| Modify | `src/components/ChatTab.jsx` | Accept `level` prop, level-aware system prompt |
| Modify | `src/components/VocabTab.jsx` | White card bg, min progress, deck celebration |

---

## Task 1: Update Color Tokens

**Files:**
- Modify: `src/lib/theme.js`

- [ ] **Step 1: Replace the file content**

```js
// src/lib/theme.js
// Design tokens — German flag palette (black · red · gold · white)
export const COLORS = {
  paper:     '#FDF3C0',   // gold tint — main page background
  paperDeep: '#FFF8DC',   // slightly deeper gold — sidebars
  card:      '#FFFFFF',   // white — cards, panels, chat bubbles
  ink:       '#16110b',   // near-black — text, header, nav
  inkSoft:   '#2a2218',   // softer black
  red:       '#D62828',   // German flag red — CTAs, corrections
  rust:      '#a82020',   // deeper red — hover states
  gold:      '#F5C518',   // German flag gold — streak, rewards
  mute:      '#7a6e5c',   // muted brown — secondary labels
};

export const FONT_DISPLAY = "'Fraunces', 'Playfair Display', Georgia, serif";
export const FONT_MONO    = "'JetBrains Mono', 'Courier New', monospace";
export const FONT_BODY    = "'Fraunces', Georgia, serif";
```

- [ ] **Step 2: Verify visually**

```bash
cd /Users/shimonesterkin/Downloads/deutsch-app && npm run dev
```

Open http://localhost:5173 — the page background should look **warm gold** (not parchment). Active nav tab should show gold text on black. If it still looks cream/parchment, hard-refresh with Cmd+Shift+R.

- [ ] **Step 3: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/lib/theme.js
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: update color tokens to German flag palette (black/red/gold/white)"
```

---

## Task 2: Update StatBlock — Gold Streak + Pulsing

**Files:**
- Modify: `src/components/UI.jsx`

- [ ] **Step 1: Update StatBlock to accept `pulsing` prop and use gold for `accent`**

Replace the `StatBlock` function (lines 1–18 of `src/components/UI.jsx`):

```jsx
export function StatBlock({ label, value, icon, accent, pulsing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36,
        background: accent ? COLORS.gold : COLORS.ink,
        color: accent ? COLORS.ink : COLORS.card,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: pulsing ? 'pulse-gold 2s infinite' : 'none',
        flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.15em', color: COLORS.mute }}>{label}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify visually**

The 🔥 Streak block in the header should now have a **gold square** (not red). LEARNED block stays dark.

- [ ] **Step 3: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/components/UI.jsx
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: streak icon uses gold, add pulsing prop to StatBlock"
```

---

## Task 3: Create SplashScreen Component

**Files:**
- Create: `src/components/SplashScreen.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/SplashScreen.jsx
import { useState } from 'react';
import { FONT_DISPLAY, FONT_MONO } from '../lib/theme';

const S = {
  black: '#16110b',
  red:   '#D62828',
  gold:  '#F5C518',
  white: '#FFFFFF',
};

export default function SplashScreen({ onComplete }) {
  const [selected, setSelected]     = useState(null);
  const [fadingOut, setFadingOut]   = useState(false);

  const handleSelect = (level) => {
    if (fadingOut) return;
    setSelected(level);
    setFadingOut(true);
    setTimeout(() => {
      localStorage.setItem('deutsch-onboarded', 'true');
      localStorage.setItem('deutsch-level', level);
      onComplete(level);
    }, 420);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      opacity: fadingOut ? 0 : 1,
      transition: 'opacity 0.42s ease-out',
    }}>

      {/* ── Stripe 1: Black — Logo ── */}
      <div style={{
        flex: 1.2,
        background: S.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 'clamp(52px, 10vw, 88px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: S.white,
          lineHeight: 1,
        }}>
          Deutsch<span style={{ color: S.red }}>.</span>
        </div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.45em',
          color: `${S.white}55`,
          textTransform: 'uppercase',
        }}>
          Sprachschule
        </div>
      </div>

      {/* ── Stripe 2: Red — Level Picker ── */}
      <div style={{
        flex: 1,
        background: S.red,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.3em',
          color: `${S.white}CC`,
          textTransform: 'uppercase',
        }}>
          What's your level?
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { id: 'beginner',     label: '🌱 Beginner'     },
            { id: 'intermediate', label: '📚 Intermediate' },
          ].map(({ id, label }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                style={{
                  padding: '12px 28px',
                  background:  isSelected ? S.white : 'transparent',
                  color:       isSelected ? S.red   : S.white,
                  border:      `2px solid ${isSelected ? S.white : 'rgba(255,255,255,0.45)'}`,
                  fontFamily:  FONT_MONO,
                  fontWeight:  700,
                  fontSize:    13,
                  letterSpacing: '0.08em',
                  cursor:      'pointer',
                  transform:   isSelected ? 'scale(0.97)' : 'scale(1)',
                  transition:  'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stripe 3: Gold — Tagline ── */}
      <div style={{
        flex: 0.65,
        background: S.gold,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.35em',
          color: `${S.black}99`,
          textTransform: 'uppercase',
        }}>
          Lernen · Sprechen · Verstehen
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify the component exists**

```bash
ls /Users/shimonesterkin/Downloads/deutsch-app/src/components/SplashScreen.jsx
```

Expected: file listed with no error.

- [ ] **Step 3: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/components/SplashScreen.jsx
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: add SplashScreen component with German flag stripes and level picker"
```

---

## Task 4: Wire SplashScreen into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports and new state at the top of App.jsx**

Replace the existing imports block and the `export default function App()` opening with:

```jsx
import { useState, useEffect } from 'react';
import { Check, Flame, BookOpen, MessageSquare, Type, Languages } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from './lib/theme';
import { loadState, saveState } from './lib/storage';
import { StatBlock } from './components/UI';
import ChatTab from './components/ChatTab';
import AlphabetTab from './components/AlphabetTab';
import VocabTab from './components/VocabTab';
import TranslateTab from './components/TranslateTab';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const [tab, setTab] = useState('chat');
  const [stats, setStats] = useState({ streak: 0, learnedCount: 0, lastVisit: null });
  const [learnedWords, setLearnedWords] = useState({});

  // Onboarding + level
  const [showSplash, setShowSplash] = useState(
    () => !localStorage.getItem('deutsch-onboarded')
  );
  const [level, setLevel] = useState(
    () => localStorage.getItem('deutsch-level') || 'intermediate'
  );

  const handleSplashComplete = (chosenLevel) => {
    setLevel(chosenLevel);
    setShowSplash(false);
  };
```

- [ ] **Step 2: Add new CSS keyframes to the `<style>` block in the JSX**

Find the existing `<style>` tag inside the `return (` block. It currently contains keyframes for `blink`, `pulse-red`, and `slide-up`. Add three new keyframes at the end:

```css
@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.18); }
}
@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0.7); }
  50%       { box-shadow: 0 0 0 10px rgba(245, 197, 24, 0); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
```

- [ ] **Step 3: Add `streakPulsing` computation and update StatBlock + render SplashScreen**

Find the `<header>` JSX block. Replace the two `<StatBlock>` calls so that the Streak one receives `pulsing`:

```jsx
// Compute just before the return — after both useEffects
const streakPulsing =
  stats.streak > 0 && stats.lastVisit !== new Date().toDateString();
```

And update the StatBlock in the header:

```jsx
<StatBlock label="STREAK" value={stats.streak} icon={<Flame size={14} />} accent pulsing={streakPulsing} />
```

Then, at the very top of the `return (` block (before the outer `<div>`), add:

```jsx
if (showSplash) return <SplashScreen onComplete={handleSplashComplete} />;
```

- [ ] **Step 4: Verify splash appears on first load**

```bash
# In a new terminal tab, open browser storage and clear the key:
# DevTools → Application → Local Storage → delete 'deutsch-onboarded'
# Then refresh http://localhost:5173
```

You should see the three-stripe splash screen. Clicking Beginner or Intermediate should fade into the main app.

- [ ] **Step 5: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/App.jsx
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: wire SplashScreen into App, add level state and new CSS keyframes"
```

---

## Task 5: Level-Aware ChatTab

**Files:**
- Modify: `src/components/ChatTab.jsx`

- [ ] **Step 1: Accept `level` prop and use it in the system prompt**

Find the `export default function ChatTab()` line and change it to:

```jsx
export default function ChatTab({ level = 'intermediate' }) {
```

Then find `const systemPrompt = \`You are a friendly German tutor...` inside `sendMessage`. Replace the full system prompt string with:

```jsx
const levelInstructions = level === 'beginner'
  ? `The learner is a BEGINNER (A1-A2). Keep your German very simple: short sentences, common vocabulary only, always provide the English translation. Use lots of encouragement.`
  : `The learner is INTERMEDIATE (A2-B1). Use natural German, moderate complexity. Provide English translation but push them a little.`;

const systemPrompt = `You are a friendly German tutor named Anna for a language learner. The current scenario is: ${scenarioDesc}.

${levelInstructions}

You MUST always respond with strict JSON only (no markdown, no extra text):
{
  "de": "your reply in German (1-2 sentences)",
  "ipa": "IPA pronunciation of the German",
  "en": "English translation",
  "correction": null OR { "original": "what they said", "fixed": "corrected German", "explain": "brief friendly explanation in English" }
}

Stay in the scenario. Only provide 'correction' if the user made a real grammar/vocabulary mistake. If they spoke perfectly or just sent a greeting, set correction to null.`;
```

- [ ] **Step 2: Pass `level` from App.jsx to ChatTab**

In `src/App.jsx`, find the line:

```jsx
{tab === 'chat' && <ChatTab />}
```

Replace with:

```jsx
{tab === 'chat' && <ChatTab level={level} />}
```

- [ ] **Step 3: Verify**

In DevTools → Local Storage, set `deutsch-level` to `beginner`. Reload. Open Chat. Type "Hallo" and send. Anna's reply should be shorter and simpler, with more English context. Then change level to `intermediate` — replies should be longer.

- [ ] **Step 4: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/components/ChatTab.jsx src/App.jsx
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: ChatTab adapts difficulty based on learner level prop"
```

---

## Task 6: VocabTab — White Cards, Min Progress, Deck Celebration

**Files:**
- Modify: `src/components/VocabTab.jsx`

- [ ] **Step 1: Add `deckComplete` state and white card background**

Add `deckComplete` to the state declarations at the top of the component:

```jsx
const [deckComplete, setDeckComplete] = useState(false);
```

Also reset it when the deck changes:

```jsx
useEffect(() => {
  setCardIdx(0);
  setFlipped(false);
  setDeckComplete(false);   // ← add this line
}, [deckId, customCards]);
```

- [ ] **Step 2: Update `markLearned` call to detect completion**

Find the `<button` that calls `markLearned(card.de)`. Add an `onClick` wrapper that also checks for deck completion **after** marking:

```jsx
onClick={(e) => {
  e.stopPropagation();
  markLearned(card.de);
  // Check if this was the last unlearned card
  const updatedLearned = { ...learnedWords, [card.de]: !learnedWords[card.de] };
  const allDone = activeDeck.every(c => updatedLearned[c.de]);
  if (allDone) setDeckComplete(true);
}}
```

- [ ] **Step 3: Add the celebration banner and update the flashcard background**

Find the flashcard `<div onClick={() => setFlipped...}` block. Replace its `background` style:

```jsx
background: flipped ? COLORS.ink : COLORS.card,
```

Then, directly **above** the flashcard div, add the celebration banner conditionally:

```jsx
{deckComplete && (
  <div style={{
    background: 'linear-gradient(90deg, #F5C518 0%, #FFE44D 50%, #F5C518 100%)',
    backgroundSize: '200% auto',
    animation: 'shimmer 2s linear infinite',
    border: `2px solid ${COLORS.ink}`,
    padding: '14px 24px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: COLORS.ink }}>
      ✓ Deck complete — {activeDeck.filter(c => learnedWords[c.de]).length} words learned
    </span>
    <button
      onClick={() => setDeckComplete(false)}
      style={{
        background: 'transparent',
        border: `1px solid ${COLORS.ink}`,
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.15em',
        padding: '4px 10px',
        cursor: 'pointer',
      }}
    >
      DISMISS
    </button>
  </div>
)}
```

- [ ] **Step 4: Fix progress bar — always show at least 1 filled segment**

Find the progress bar `<div>` that renders `activeDeck.map(...)`. The inner div currently uses:

```jsx
background: i === cardIdx ? COLORS.red : (learnedWords[activeDeck[i].de] ? COLORS.ink : COLORS.paperDeep),
```

Replace with:

```jsx
background: i === cardIdx
  ? COLORS.red
  : learnedWords[activeDeck[i]?.de]
    ? COLORS.ink
    : i === 0 && cardIdx === 0
      ? `${COLORS.ink}30`   // first segment always slightly visible
      : COLORS.paperDeep,
```

- [ ] **Step 5: Verify**

Open the Vocab tab. The flashcard front should now be **white** (not gold). Work through a deck, marking all cards learned — the gold shimmer banner should appear. Dismiss it, switch decks — banner should be gone.

- [ ] **Step 6: Commit**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add src/components/VocabTab.jsx
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "feat: white flashcard bg, deck completion celebration, min progress bar"
```

---

## Task 7: Push and Deploy

- [ ] **Step 1: Push all commits to GitHub**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app push origin main
```

- [ ] **Step 2: Verify Vercel auto-deploys**

Open https://vercel.com/blackhebrewisraelis-projects/deutsch-app — a new deployment should start automatically within 30 seconds of the push. Wait for it to reach "Ready".

- [ ] **Step 3: Smoke-test on production URL**

Open https://deutsch-app-dusky.vercel.app in a fresh incognito window (so localStorage is empty).

Verify:
1. ✓ Splash screen appears with 3 flag stripes
2. ✓ Click Beginner → fades into app
3. ✓ Background is gold-tinted
4. ✓ Streak icon is gold
5. ✓ Vocab flashcard front is white
6. ✓ Mark all cards in Greetings deck → shimmer celebration banner appears
7. ✓ Revisiting the URL skips the splash (localStorage key is set)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git -C /Users/shimonesterkin/Downloads/deutsch-app add -A
git -C /Users/shimonesterkin/Downloads/deutsch-app commit -m "fix: post-deploy corrections"
git -C /Users/shimonesterkin/Downloads/deutsch-app push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Splash screen with 3 flag stripes → Task 3 + Task 4
- [x] Level selection → Task 3 (SplashScreen) + Task 5 (ChatTab)
- [x] `deutsch-onboarded` + `deutsch-level` localStorage keys → Task 3 + Task 4
- [x] Color tokens updated → Task 1
- [x] `card` + `gold` tokens added → Task 1
- [x] Streak icon gold → Task 2
- [x] `pulsing` prop on StatBlock → Task 2 + Task 4
- [x] White flashcard background → Task 6
- [x] Deck completion celebration with shimmer → Task 6
- [x] Min progress bar → Task 6
- [x] `bounce` + `pulse-gold` + `shimmer` keyframes → Task 4
- [x] Anna adapts to level → Task 5

**No placeholders:** All steps contain complete code. ✓

**Type consistency:** `level` is `'beginner' | 'intermediate'` string throughout. `onComplete(level)` in SplashScreen matches `handleSplashComplete(chosenLevel)` in App.jsx. `pulsing` boolean flows from App.jsx → StatBlock. ✓
