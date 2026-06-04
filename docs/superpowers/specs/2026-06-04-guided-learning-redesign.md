# Guided Learning Redesign — Design Spec
**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Full philosophy shift — all interactive tabs become exercise-driven

---

## 1. Philosophy

The app's current assumption — that the user can already produce German — is wrong for the target audience. The redesign flips this: **the app always leads, the learner always responds.** No tab presents a blank input waiting for the user to know what to do.

Every tab follows the same four-step exercise loop:

```
PROMPT → RESPOND → FEEDBACK → NEXT
```

1. **Prompt** — the app generates a task suited to the learner's level  
2. **Respond** — the learner answers using tiles, blanks, or free typing (level-dependent)  
3. **Feedback** — correct answer shown with a brief explanation  
4. **Next** — new exercise loads; streak and score tracked

---

## 2. Level System (Splash Screen Update)

The current two-level picker (Beginner / Intermediate) expands to three levels. Every tab's exercise mode is driven by this setting.

| Level | Code | Exercise mode | Description |
|-------|------|--------------|-------------|
| Beginner | A1 | Full word tiles | All words provided; learner assembles sentence by clicking tiles in order |
| Elementary | A2 | Fill the blanks | Sentence shown with 2–3 key words missing; learner selects from a small tile bank |
| Intermediate | B1 | Free typing + AI feedback | Learner types full answer; Claude grades it and explains errors |

The splash screen `SplashScreen.jsx` gains a third button. The chosen level is stored in `localStorage` as `deutsch-level` (already exists) and read by every tab.

---

## 3. Content — Hybrid Sentence Bank

Exercises need a pool of sentences. Two sources, used in order:

**Built-in bank (primary)**  
- ~30 sentences per level, hardcoded in `src/data/content.js`  
- Categorised by grammar focus (word order, articles, verb conjugation, cases)  
- No API call needed — available instantly and offline  
- Sentences are shuffled on each session start

**AI generation (on exhaustion or on demand)**  
- Triggered when the built-in bank for the active level is exhausted, or via a "Generate more" button  
- Claude generates 5 new sentences suited to the level and a chosen topic  
- Generated sentences stored in component state for the session (not persisted)

**Exercise counter**  
- Displayed as "Exercise N / 10"  
- Completing a set of 10 earns one streak point  
- Counter resets at the start of each new set

---

## 4. Tab Designs

### 4.1 — 04 Translate → Übersetzen Exercise

**Old:** Free textarea input; user types anything; Claude translates it.  
**New:** App gives a sentence to translate; learner responds by level.

**A1 — Word Tiles**
- English sentence displayed in a prominent card at the top
- Empty "answer area" below (dashed border)
- Word bank beneath — all German words of the correct translation, shuffled, plus 1–2 distractors for A2 transition readiness
- Clicking a tile moves it to the answer area in order
- Clicking a placed tile returns it to the bank
- **CHECK** button submits; disabled until at least one tile is placed
- On submit: correct sentence shown, tiles colour green/red, brief grammar note displayed

**A2 — Fill the Blanks**
- English sentence displayed at top
- German sentence shown with 2–3 blanks (chosen to target articles, verb forms, prepositions)
- Small tile bank contains the missing words plus 1–2 distractors
- Clicking a tile fills the next blank; clicking a filled blank returns it
- **CHECK** button submits
- On submit: correct words highlighted, explanation shown per blank

**B1 — Free Typing + AI Feedback**
- English sentence displayed at top
- Plain textarea for German translation
- **CHECK** button submits; calls `/api/chat` with the sentence and learner's answer
- Claude grades the answer: correct / partially correct / incorrect
- Feedback shown inline: corrected sentence + explanation of each error
- If correct, an encouraging note with a grammar tip

**Shared behaviour (all levels)**
- "Skip" button always available — shows correct answer and moves on, no streak penalty
- After feedback is shown, **NEXT EXERCISE** button loads the next sentence
- Exercise counter shown: "Exercise 3 / 10"

---

### 4.2 — 01 Chat → Guided Conversation

**Old:** Anna greets the user and waits for them to say something.  
**New:** Anna gives the learner a specific speaking task at the start of every conversation turn.

**Task panel (left sidebar)**
- Scenario selector stays (Free Chat, Order Coffee, Meet Someone, At the Airport)
- Below the scenario, a **YOUR TASK** box (red background) shows the current prompt:
  - A1: `"Say hello and tell Anna your name."`
  - A2: `"Order a large coffee and ask how much it costs."`
  - B1: `"Describe what you did yesterday evening."`
- A collapsible **Hint** below the task shows a model answer in German (A1/A2 always visible, B1 hidden by default)

**Conversation behaviour**
- Anna's opening message is now task-aware: she sets up the scenario and implicitly invites the learner to attempt the task
- After each learner message, Anna responds in-character AND the correction panel still functions as before
- When the task is considered complete — Anna's JSON response includes a `"taskComplete": true` flag, set when the system prompt instructs her to mark completion once the learner has addressed all parts of the task — Anna suggests the next task
- "New Task" button generates the next prompt for the current scenario

**Level differences**
- A1: Task is a single short sentence; hint always visible; Anna uses very simple German back
- A2: Task is 1–2 sentences; hint visible but collapsed; Anna uses natural German
- B1: Task is a multi-sentence scenario; hint hidden; Anna responds at natural speed

---

### 4.3 — 03 Vocab → Active Recall

**Old:** Passive flashcard flip — learner clicks to reveal the English side.  
**New:** Learner must produce or select the meaning before it is revealed.

**A1/A2 — Multiple Choice**
- German word/phrase shown large on the card (with IPA)
- Four English options shown as buttons below the card
- Learner taps the correct meaning
- Correct: card flashes gold, counter increments, 1-second delay, next card loads
- Incorrect: wrong option highlighted red, correct option highlighted gold, explanation shown before moving on

**B1 — Type the meaning**
- German word shown on the card
- Text input below: "Type the English meaning"
- On submit: exact match accepted (case-insensitive); answers within 2 characters of the correct answer (Levenshtein distance ≤ 2) shown as "Almost — check your spelling" and not counted as correct
- Feedback: correct / almost (shows accepted answer in gold) / incorrect (shows answer + usage note in red)

**Deck behaviour**
- Preset decks and custom generation remain
- Cards answered correctly move to a "done" pile; incorrect cards return to the end of the deck
- Deck complete only when all cards answered correctly at least once
- Completion banner updated: shows score (e.g. "8/10 first try")

---

### 4.4 — 02 Alphabet → Listen & Identify

**Old:** Visual grid of letters; tap to hear; passive browsing.  
**New:** A letter is spoken aloud; learner identifies which letter they heard.

**Exercise flow**
- App plays a letter using the Web Speech API (already integrated via `speech.js`)
- Four letter buttons shown as large tiles (chosen to be confusable: e.g. U / Ü / O / Ö)
- Learner taps the letter they heard
- Correct: tile flashes gold, brief positive feedback
- Incorrect: correct tile highlighted, incorrect tile highlighted red

**Letter selection logic**
- Rounds focus on the letters learners most commonly confuse:
  - Ä/A/E, Ö/O/U, Ü/U/I, ß/S, W/V, Z/TS
- After 10 rounds, a summary shows which letters caused errors
- "Browse" button still available to view the full alphabet grid (reference mode, not exercise)

---

## 5. Component Changes Summary

| File | Change |
|------|--------|
| `src/components/SplashScreen.jsx` | Add third level button (A2 — Elementary) |
| `src/data/content.js` | Add `TRANSLATE_SENTENCES` bank (A1/A2/B1 arrays, ~30 each) |
| `src/components/TranslateTab.jsx` | Full rewrite — exercise mode with tiles/blanks/typing by level |
| `src/components/ChatTab.jsx` | Add task panel, task-aware system prompt, hint system |
| `src/components/VocabTab.jsx` | Replace passive flip with multiple-choice (A1/A2) or type (B1) |
| `src/components/AlphabetTab.jsx` | Add quiz mode alongside existing browse grid |
| `src/api/chat.js` | No change — already handles grading prompts |

---

## 6. Out of Scope (this iteration)

- Progress persistence across sessions (correct/incorrect history saved to localStorage) — future
- User accounts or cloud sync — future
- Audio recording / speech recognition scoring — future (mic already wired in Chat)
- Spaced repetition algorithm for Vocab — future
