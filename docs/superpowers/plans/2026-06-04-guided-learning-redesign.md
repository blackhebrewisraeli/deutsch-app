# Guided Learning Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform all four tabs from passive/input-waiting tools into guided, exercise-driven learning experiences with three difficulty modes (A1/A2/B1).

**Architecture:** Every tab reads the global `level` prop ('a1' | 'a2' | 'b1') and renders its exercise mode accordingly. A built-in sentence/task bank in `content.js` drives exercises; Claude AI generates more when the bank is exhausted. The shared exercise loop is: Prompt → Respond → Feedback → Next.

**Tech Stack:** React 18, Vite, Claude Haiku via `/api/chat`, Web Speech API (`speech.js`)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/components/SplashScreen.jsx` | Modify | Add A2 (Elementary) third button |
| `src/App.jsx` | Modify | Pass `level` prop to all four tabs |
| `src/data/content.js` | Modify | Add `TRANSLATE_SENTENCES_A1/A2/B1`, `CHAT_TASKS`, `ALPHABET_QUIZ_GROUPS` |
| `src/components/TranslateTab.jsx` | Rewrite | Exercise mode: tiles (A1) / blanks (A2) / typing+AI (B1) |
| `src/components/ChatTab.jsx` | Modify | Add task panel + hints, update system prompt |
| `src/components/VocabTab.jsx` | Modify | Replace passive flip with multiple-choice (A1/A2) or type (B1) |
| `src/components/AlphabetTab.jsx` | Modify | Add quiz mode alongside existing browse grid |
| `src/lib/utils.js` | Create | `shuffle()`, `levenshtein()` pure utilities |

---

## Task 1 — Utilities + Level System Foundation

**Files:**
- Create: `src/lib/utils.js`
- Modify: `src/components/SplashScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/lib/utils.js`**

```js
// Pure utility functions shared across exercise components.

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Levenshtein edit distance between two strings (case-insensitive).
 * Used by VocabTab B1 to allow near-correct answers.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  const s = a.toLowerCase(), t = b.toLowerCase();
  const m = s.length, n = t.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        s[i - 1] === t[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
```

- [ ] **Step 2: Update `SplashScreen.jsx` — add A2 level button**

Read the current file, then replace the two-button row with three buttons. The current buttons render inside the red stripe section. Replace the button block:

```jsx
// Find the existing two buttons and replace with:
<div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
  <button
    onClick={() => handleSelect('a1')}
    style={btnStyle}
  >
    🌱 Beginner (A1)
  </button>
  <button
    onClick={() => handleSelect('a2')}
    style={btnStyle}
  >
    📚 Elementary (A2)
  </button>
  <button
    onClick={() => handleSelect('b1')}
    style={btnStyle}
  >
    🎓 Intermediate (B1)
  </button>
</div>
```

The `handleSelect` function already calls `onComplete(level)` and sets localStorage. The only change is adding the middle button and renaming values from `'beginner'`/`'intermediate'` to `'a1'`/`'b1'`.

Full rewrite of `SplashScreen.jsx`:

```jsx
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING } from '../lib/theme';

export default function SplashScreen({ onComplete }) {
  const handleSelect = (level) => {
    localStorage.setItem('deutsch-level', level);
    localStorage.setItem('deutsch-onboarded', '1');
    onComplete(level);
  };

  const btnStyle = {
    padding: '14px 28px',
    background: 'transparent',
    color: COLORS.paper,
    border: `2px solid ${COLORS.paper}`,
    fontFamily: FONTS.mono,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.lg,
    letterSpacing: LETTER_SPACING.wider,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: 200,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: FONTS.display }}>
      {/* Black stripe */}
      <div style={{ flex: 1, background: COLORS.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 72, fontWeight: FONT_WEIGHT.black, color: COLORS.paper, letterSpacing: LETTER_SPACING.tight, lineHeight: 1 }}>
          Deutsch<span style={{ color: COLORS.red }}>.</span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginTop: 12, textTransform: 'uppercase' }}>
          Sprachschule
        </div>
      </div>

      {/* Red stripe — level picker */}
      <div style={{ flex: 1, background: COLORS.red, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '0 24px' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.paper, textTransform: 'uppercase' }}>
          What's your level?
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => handleSelect('a1')} style={btnStyle}>🌱 Beginner (A1)</button>
          <button onClick={() => handleSelect('a2')} style={btnStyle}>📚 Elementary (A2)</button>
          <button onClick={() => handleSelect('b1')} style={btnStyle}>🎓 Intermediate (B1)</button>
        </div>
      </div>

      {/* Gold stripe */}
      <div style={{ flex: 1, background: COLORS.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.ink, textTransform: 'uppercase' }}>
          Lernen · Sprechen · Verstehen
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `App.jsx` — pass `level` to all tabs**

Find the tab rendering block and add `level={level}` to the three tabs that don't yet receive it:

```jsx
{tab === 'chat'      && <ChatTab level={level} />}
{tab === 'alphabet'  && <AlphabetTab level={level} />}
{tab === 'vocab'     && <VocabTab learnedWords={learnedWords} markLearned={markLearned} level={level} />}
{tab === 'translate' && <TranslateTab level={level} />}
```

Also update the `useState` default for level to fall back to `'a1'` if nothing is stored (old users may have `'beginner'` stored — map that too):

```jsx
const [level, setLevel] = useState(() => {
  const stored = localStorage.getItem('deutsch-level');
  if (stored === 'beginner' || stored === 'a1') return 'a1';
  if (stored === 'a2') return 'a2';
  if (stored === 'intermediate' || stored === 'b1') return 'b1';
  return 'a1';
});
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: `✓ built in` — zero errors. The app should still render; SplashScreen now shows three buttons.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.js src/components/SplashScreen.jsx src/App.jsx
git commit -m "feat: add A2 level, utils module, pass level prop to all tabs"
```

---

## Task 2 — Sentence Bank & Exercise Data

**Files:**
- Modify: `src/data/content.js`

- [ ] **Step 1: Append exercise data to `src/data/content.js`**

Add the following exports at the bottom of the file (after the existing `SCENARIOS` export):

```js
// ─── Translate Exercise — Sentence Banks ─────────────────────────────────────

/**
 * A1 sentences — full word tile assembly.
 * words: the correct German tokens in order (used as tiles + correct answer check)
 * distractors: extra wrong tiles added to the bank to prevent guessing by elimination
 */
export const TRANSLATE_SENTENCES_A1 = [
  { en: 'I drink water.', de: 'Ich trinke Wasser.', words: ['Ich', 'trinke', 'Wasser.'], distractors: ['esse', 'laufe'], note: 'Subject–Verb–Object word order' },
  { en: 'The cat is big.', de: 'Die Katze ist groß.', words: ['Die', 'Katze', 'ist', 'groß.'], distractors: ['klein', 'der'], note: 'Nominative: die Katze (feminine)' },
  { en: 'He eats bread.', de: 'Er isst Brot.', words: ['Er', 'isst', 'Brot.'], distractors: ['trinkt', 'Wasser'], note: 'isst = 3rd person singular of essen' },
  { en: 'We go home.', de: 'Wir gehen nach Hause.', words: ['Wir', 'gehen', 'nach', 'Hause.'], distractors: ['fahren', 'in'], note: 'nach Hause = direction; zu Hause = location' },
  { en: 'She reads a book.', de: 'Sie liest ein Buch.', words: ['Sie', 'liest', 'ein', 'Buch.'], distractors: ['schreibt', 'das'], note: 'ein Buch — neuter accusative, no change from nominative' },
  { en: 'The dog is small.', de: 'Der Hund ist klein.', words: ['Der', 'Hund', 'ist', 'klein.'], distractors: ['groß', 'die'], note: 'Nominative: der Hund (masculine)' },
  { en: 'I am tired.', de: 'Ich bin müde.', words: ['Ich', 'bin', 'müde.'], distractors: ['hungrig', 'habe'], note: 'sein (to be): ich bin' },
  { en: 'The house is red.', de: 'Das Haus ist rot.', words: ['Das', 'Haus', 'ist', 'rot.'], distractors: ['blau', 'der'], note: 'das Haus — neuter noun' },
  { en: 'They drink coffee.', de: 'Sie trinken Kaffee.', words: ['Sie', 'trinken', 'Kaffee.'], distractors: ['essen', 'Tee'], note: 'trinken = 3rd person plural; same form as infinitive' },
  { en: 'I have a cat.', de: 'Ich habe eine Katze.', words: ['Ich', 'habe', 'eine', 'Katze.'], distractors: ['einen', 'Hund'], note: 'eine — feminine accusative (no change from nominative)' },
];

/**
 * A2 sentences — fill-in-the-blanks.
 * template: string with ___ markers for each blank (in order)
 * blanks: [{ word: correct answer, distractors: [wrong options] }]
 */
export const TRANSLATE_SENTENCES_A2 = [
  {
    en: 'I have a big dog.',
    de: 'Ich habe einen großen Hund.',
    template: 'Ich habe ___ ___ Hund.',
    blanks: [
      { word: 'einen', distractors: ['ein', 'eine'] },
      { word: 'großen', distractors: ['große', 'großes'] },
    ],
    note: 'Accusative masculine: einen + weak adjective ending -en',
  },
  {
    en: 'She goes to school.',
    de: 'Sie geht in die Schule.',
    template: 'Sie geht ___ ___ Schule.',
    blanks: [
      { word: 'in', distractors: ['zu', 'nach'] },
      { word: 'die', distractors: ['der', 'das'] },
    ],
    note: 'in + accusative (movement into); die Schule is feminine',
  },
  {
    en: 'I am drinking a coffee.',
    de: 'Ich trinke einen Kaffee.',
    template: 'Ich trinke ___ Kaffee.',
    blanks: [{ word: 'einen', distractors: ['ein', 'eine'] }],
    note: 'Accusative masculine indefinite article: einen',
  },
  {
    en: 'The child plays with the ball.',
    de: 'Das Kind spielt mit dem Ball.',
    template: 'Das Kind spielt mit ___ Ball.',
    blanks: [{ word: 'dem', distractors: ['der', 'den'] }],
    note: 'mit + dative; der Ball → dem Ball',
  },
  {
    en: 'He works in a hospital.',
    de: 'Er arbeitet in einem Krankenhaus.',
    template: 'Er arbeitet in ___ Krankenhaus.',
    blanks: [{ word: 'einem', distractors: ['einen', 'ein'] }],
    note: 'in + dative (location); das Krankenhaus → einem Krankenhaus',
  },
  {
    en: 'We are going to the cinema.',
    de: 'Wir gehen ins Kino.',
    template: 'Wir gehen ___ Kino.',
    blanks: [{ word: 'ins', distractors: ['in das', 'im'] }],
    note: 'ins = in + das (contraction for neuter accusative)',
  },
  {
    en: 'She gives the book to her friend.',
    de: 'Sie gibt ihrem Freund das Buch.',
    template: 'Sie gibt ___ Freund das Buch.',
    blanks: [{ word: 'ihrem', distractors: ['ihren', 'ihrer'] }],
    note: 'Dative masculine possessive: ihrem',
  },
  {
    en: 'The red car is fast.',
    de: 'Das rote Auto ist schnell.',
    template: 'Das ___ Auto ist schnell.',
    blanks: [{ word: 'rote', distractors: ['roten', 'roter'] }],
    note: 'After definite article das (neuter): adjective ending -e',
  },
  {
    en: 'I am going to my friend.',
    de: 'Ich gehe zu meinem Freund.',
    template: 'Ich gehe zu ___ Freund.',
    blanks: [{ word: 'meinem', distractors: ['meinen', 'mein'] }],
    note: 'zu + dative masculine: meinem',
  },
  {
    en: 'They are eating at the restaurant.',
    de: 'Sie essen im Restaurant.',
    template: 'Sie essen ___ Restaurant.',
    blanks: [{ word: 'im', distractors: ['in das', 'ins'] }],
    note: 'im = in + dem (dative, location not movement)',
  },
];

/**
 * B1 sentences — free typing, AI-graded.
 * de: the expected correct translation (shown in feedback)
 * note: grammar concept to highlight in feedback
 */
export const TRANSLATE_SENTENCES_B1 = [
  { en: 'Yesterday I went to the market and bought vegetables.', de: 'Gestern bin ich zum Markt gegangen und habe Gemüse gekauft.', note: 'Perfekt with sein (movement) and haben' },
  { en: 'If I had more time, I would learn more German.', de: 'Wenn ich mehr Zeit hätte, würde ich mehr Deutsch lernen.', note: 'Konjunktiv II: hätte / würde + infinitive' },
  { en: 'The woman whose bag was stolen is at the police station.', de: 'Die Frau, deren Tasche gestohlen wurde, ist auf der Polizeistation.', note: 'Relative clause with genitive: deren' },
  { en: 'She told me that she would come tomorrow.', de: 'Sie sagte mir, dass sie morgen kommen würde.', note: 'Indirect speech with Konjunktiv I/II; dass pushes verb to end' },
  { en: 'He has been living in Berlin for three years.', de: 'Er wohnt seit drei Jahren in Berlin.', note: 'German uses present tense + seit for ongoing actions' },
  { en: 'I need to finish this report before the meeting.', de: 'Ich muss diesen Bericht vor dem Meeting fertigstellen.', note: 'Modal verb müssen + infinitive at end; vor + dative' },
  { en: 'The children who are playing outside are very loud.', de: 'Die Kinder, die draußen spielen, sind sehr laut.', note: 'Relative clause: die (nominative plural)' },
  { en: 'Despite the rain, we enjoyed the walk.', de: 'Trotz des Regens haben wir den Spaziergang genossen.', note: 'trotz + genitive; Perfekt with haben' },
  { en: 'Could you please tell me where the nearest pharmacy is?', de: 'Könnten Sie mir bitte sagen, wo die nächste Apotheke ist?', note: 'Polite Konjunktiv II: könnten; indirect question with verb-final' },
  { en: 'I would have called you if I had known your number.', de: 'Ich hätte dich angerufen, wenn ich deine Nummer gewusst hätte.', note: 'Conditional perfect: hätte + past participle' },
];

// ─── Chat Tab — Guided Tasks ──────────────────────────────────────────────────

export const CHAT_TASKS = {
  free: {
    a1: [
      { task: 'Say hello and tell Anna your name.', hint: 'Hallo! Ich heiße [dein Name].' },
      { task: 'Ask Anna how she is.', hint: 'Wie geht es dir?' },
      { task: 'Tell Anna what you like to eat.', hint: 'Ich esse gerne [food].' },
    ],
    a2: [
      { task: 'Ask Anna what she does for work and where she lives.', hint: 'Was machst du beruflich? Wo wohnst du?' },
      { task: 'Tell Anna about your daily routine.', hint: 'Ich stehe um ... Uhr auf und dann ...' },
      { task: 'Describe your family to Anna.', hint: 'Ich habe [einen Bruder / zwei Schwestern / ...].' },
    ],
    b1: [
      { task: 'Tell Anna about an interesting place you visited recently and why you liked it.', hint: null },
      { task: 'Discuss with Anna whether big cities are better to live in than small towns.', hint: null },
      { task: 'Explain to Anna a problem you had recently and how you solved it.', hint: null },
    ],
  },
  coffee: {
    a1: [
      { task: 'Order a coffee.', hint: 'Einen Kaffee, bitte.' },
      { task: 'Ask for the bill.', hint: 'Die Rechnung, bitte.' },
    ],
    a2: [
      { task: 'Order a large coffee and ask how much it costs.', hint: 'Einen großen Kaffee, bitte. Was kostet das?' },
      { task: 'Ask if they have decaf and order a piece of cake too.', hint: 'Haben Sie entkoffeinierten Kaffee? Ich nehme auch ein Stück Kuchen.' },
    ],
    b1: [
      { task: 'Make a reservation for four people this evening and ask about the menu.', hint: null },
      { task: 'Complain politely that your order is wrong and ask for the correct item.', hint: null },
    ],
  },
  meet: {
    a1: [
      { task: 'Introduce yourself — give your name and say where you are from.', hint: 'Ich heiße ... und komme aus ...' },
      { task: 'Ask Anna her name and where she is from.', hint: 'Wie heißt du? Woher kommst du?' },
    ],
    a2: [
      { task: 'Ask Anna about her hobbies and tell her yours.', hint: 'Was machst du in deiner Freizeit? Ich ... gerne.' },
      { task: 'Invite Anna to do something together this weekend.', hint: 'Hast du am Wochenende Zeit? Wir könnten ...' },
    ],
    b1: [
      { task: 'Have a natural small-talk conversation — ask Anna about her week and share something interesting about yours.', hint: null },
    ],
  },
  airport: {
    a1: [
      { task: 'Ask where the check-in desk is.', hint: 'Entschuldigung, wo ist der Check-in?' },
      { task: 'Ask how much the ticket costs.', hint: 'Was kostet das Ticket?' },
    ],
    a2: [
      { task: 'Ask a staff member where gate B12 is and how long the walk takes.', hint: 'Entschuldigung, wo ist Gate B12? Wie lange dauert der Weg?' },
      { task: 'Tell the check-in agent you have one suitcase to check and ask about hand luggage rules.', hint: 'Ich habe einen Koffer aufzugeben. Was sind die Handgepäckregeln?' },
    ],
    b1: [
      { task: 'Explain to staff that your flight was cancelled and ask what your options are.', hint: null },
    ],
  },
};

// ─── Alphabet Quiz — Confusable Letter Groups ─────────────────────────────────

/**
 * Each group is four letters that sound similar or are visually confusable.
 * AlphabetTab plays one letter and asks the learner to identify it from these four.
 */
export const ALPHABET_QUIZ_GROUPS = [
  { letters: ['U', 'Ü', 'O', 'Ö'] },
  { letters: ['A', 'Ä', 'E', 'I'] },
  { letters: ['S', 'ß', 'Z', 'W'] },
  { letters: ['B', 'P', 'D', 'T'] },
  { letters: ['V', 'W', 'F', 'B'] },
  { letters: ['G', 'K', 'J', 'Y'] },
  { letters: ['Ch', 'Sch', 'St', 'Sp'] },
  { letters: ['Ei', 'Ie', 'Eu', 'Äu'] },
];
```

- [ ] **Step 2: Build to verify no syntax errors**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/content.js
git commit -m "feat: add exercise sentence banks and task/quiz data to content.js"
```

---

## Task 3 — TranslateTab Rewrite

**Files:**
- Rewrite: `src/components/TranslateTab.jsx`

This component renders three distinct exercise modes based on `level`. The shared wrapper manages: current exercise index, exercise counter (N/10), shuffle-on-mount, feedback state, and AI generation fallback.

- [ ] **Step 1: Rewrite `src/components/TranslateTab.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Sparkles, SkipForward } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, BORDER, BUTTON } from '../lib/theme';
import { callClaude } from '../lib/claude';
import { TRANSLATE_SENTENCES_A1, TRANSLATE_SENTENCES_A2, TRANSLATE_SENTENCES_B1 } from '../data/content';
import { shuffle } from '../lib/utils';
import { Hero, SectionLabel } from './UI';

// ─── Shared sub-components ────────────────────────────────────────────────────

function ExerciseHeader({ level, idx, total }) {
  const labels = { a1: 'A1 — WORD TILES', a2: 'A2 — FILL THE BLANKS', b1: 'B1 — FREE TRANSLATION' };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE[4] }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.red, textTransform: 'uppercase' }}>
        {labels[level]}
      </span>
      <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.wider, color: COLORS.mute }}>
        Exercise {idx + 1} / {total}
      </span>
    </div>
  );
}

function PromptCard({ text }) {
  return (
    <div style={{ border: BORDER.standard, background: COLORS.paper, padding: `${SPACE[5]}px ${SPACE[6]}px`, marginBottom: SPACE[4] }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        TRANSLATE TO GERMAN
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.semibold, lineHeight: 1.3 }}>
        {text}
      </div>
    </div>
  );
}

function FeedbackPanel({ correct, correctText, note, onNext }) {
  return (
    <div style={{
      border: BORDER.standard,
      background: correct ? COLORS.gold : COLORS.red,
      color: correct ? COLORS.ink : COLORS.paper,
      padding: SPACE[5],
      marginTop: SPACE[4],
    }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, marginBottom: SPACE[2] }}>
        {correct ? '✓ CORRECT' : '✗ NOT QUITE'}
      </div>
      {!correct && (
        <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACE[2] }}>
          {correctText}
        </div>
      )}
      {note && (
        <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: FONT_SIZE.base, opacity: 0.85, marginBottom: SPACE[4] }}>
          {note}
        </div>
      )}
      <button onClick={onNext} style={{ ...BUTTON.primary, background: correct ? COLORS.ink : COLORS.paper, color: correct ? COLORS.paper : COLORS.ink }}>
        NEXT EXERCISE <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── A1 — Word Tile Exercise ──────────────────────────────────────────────────

function TileExercise({ exercise, onCorrect, onSkip }) {
  const [bank, setBank] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'

  useEffect(() => {
    const tiles = [...exercise.words, ...exercise.distractors].map((w, i) => ({ id: i, word: w }));
    setBank(shuffle(tiles));
    setPlaced([]);
    setFeedback(null);
  }, [exercise]);

  const addTile = (tile) => {
    setBank(b => b.filter(t => t.id !== tile.id));
    setPlaced(p => [...p, tile]);
  };

  const removeTile = (tile) => {
    setPlaced(p => p.filter(t => t.id !== tile.id));
    setBank(b => [...b, tile]);
  };

  const check = () => {
    const answer = placed.map(t => t.word).join(' ');
    const correct = exercise.words.join(' ');
    setFeedback(answer === correct ? 'correct' : 'wrong');
    if (answer === correct) onCorrect();
  };

  const tileStyle = (active) => ({
    padding: `${SPACE[1] + 2}px ${SPACE[3]}px`,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.md,
    border: BORDER.standard,
    background: active ? COLORS.ink : COLORS.paper,
    color: active ? COLORS.paper : COLORS.ink,
    cursor: 'pointer',
    transition: 'all 0.1s',
  });

  if (feedback) {
    return (
      <FeedbackPanel
        correct={feedback === 'correct'}
        correctText={exercise.words.join(' ')}
        note={exercise.note}
        onNext={onSkip}
      />
    );
  }

  return (
    <div>
      {/* Answer area */}
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        YOUR ANSWER — click tiles in order
      </div>
      <div style={{ minHeight: 52, border: `2px dashed ${COLORS.ink}40`, background: COLORS.card, padding: SPACE[3], display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[4] }}>
        {placed.map(tile => (
          <button key={tile.id} onClick={() => removeTile(tile)} style={tileStyle(true)}>{tile.word}</button>
        ))}
      </div>

      {/* Word bank */}
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        WORD BANK
      </div>
      <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[5] }}>
        {bank.map(tile => (
          <button key={tile.id} onClick={() => addTile(tile)} style={tileStyle(false)}>{tile.word}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: SPACE[3] }}>
        <button onClick={check} disabled={placed.length === 0} style={{ ...BUTTON.danger, flex: 1, opacity: placed.length === 0 ? 0.4 : 1 }}>
          CHECK →
        </button>
        <button onClick={onSkip} style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}>
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── A2 — Fill-the-Blanks Exercise ───────────────────────────────────────────

function BlankExercise({ exercise, onCorrect, onSkip }) {
  const [tileBank, setTileBank] = useState([]);
  const [filled, setFilled] = useState([]); // array of words, one per blank (null = empty)
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const allTiles = exercise.blanks.flatMap(b => [b.word, ...b.distractors]);
    setTileBank(shuffle([...new Set(allTiles)].map((w, i) => ({ id: i, word: w }))));
    setFilled(Array(exercise.blanks.length).fill(null));
    setFeedback(null);
  }, [exercise]);

  const fillNext = (tile) => {
    const idx = filled.indexOf(null);
    if (idx === -1) return;
    const next = [...filled];
    next[idx] = tile;
    setFilled(next);
    setTileBank(b => b.filter(t => t.id !== tile.id));
  };

  const clearBlank = (idx) => {
    const tile = filled[idx];
    if (!tile) return;
    const next = [...filled];
    next[idx] = null;
    setFilled(next);
    setTileBank(b => [...b, tile]);
  };

  const check = () => {
    const correct = filled.every((t, i) => t && t.word === exercise.blanks[i].word);
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) onCorrect();
  };

  const parts = exercise.template.split('___');

  if (feedback) {
    return (
      <FeedbackPanel
        correct={feedback === 'correct'}
        correctText={exercise.de}
        note={exercise.note}
        onNext={onSkip}
      />
    );
  }

  return (
    <div>
      {/* Template with inline blank slots */}
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        COMPLETE THE SENTENCE
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['2xl'], lineHeight: 2, marginBottom: SPACE[4], border: BORDER.standard, padding: SPACE[4], background: COLORS.card }}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span
                onClick={() => clearBlank(i)}
                style={{
                  display: 'inline-block',
                  minWidth: 80,
                  borderBottom: `2px solid ${filled[i] ? COLORS.ink : COLORS.red}`,
                  marginInline: SPACE[1],
                  textAlign: 'center',
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.md,
                  color: filled[i] ? COLORS.ink : COLORS.red,
                  cursor: filled[i] ? 'pointer' : 'default',
                  paddingInline: SPACE[2],
                }}
              >
                {filled[i] ? filled[i].word : '___'}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Tile bank */}
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        CHOOSE A WORD
      </div>
      <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[5] }}>
        {tileBank.map(tile => (
          <button
            key={tile.id}
            onClick={() => fillNext(tile)}
            style={{ padding: `${SPACE[1] + 2}px ${SPACE[3]}px`, fontFamily: FONTS.mono, fontSize: FONT_SIZE.md, border: BORDER.standard, background: COLORS.paper, color: COLORS.ink, cursor: 'pointer' }}
          >
            {tile.word}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: SPACE[3] }}>
        <button onClick={check} disabled={filled.includes(null)} style={{ ...BUTTON.danger, flex: 1, opacity: filled.includes(null) ? 0.4 : 1 }}>
          CHECK →
        </button>
        <button onClick={onSkip} style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}>
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── B1 — Free Typing + AI Feedback ──────────────────────────────────────────

function TypingExercise({ exercise, onCorrect, onSkip }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { correct, message, corrected }

  useEffect(() => {
    setInput('');
    setFeedback(null);
  }, [exercise]);

  const check = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const system = `You are a German language grader. The learner was asked to translate an English sentence into German. 
Evaluate their answer strictly but fairly. Respond ONLY with valid JSON, no markdown:
{
  "correct": true or false,
  "corrected": "the ideal German translation",
  "message": "one sentence of feedback in English explaining the main error or praising them"
}
Set "correct": true only if the translation is grammatically correct and conveys the full meaning, even if phrasing differs from the ideal.`;
      const user = `English sentence: "${exercise.en}"\nIdeal German: "${exercise.de}"\nLearner's answer: "${input}"`;
      const raw = await callClaude(system, user);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setFeedback(parsed);
      if (parsed.correct) onCorrect();
    } catch {
      setFeedback({ correct: false, corrected: exercise.de, message: 'Could not grade — check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  if (feedback) {
    return (
      <FeedbackPanel
        correct={feedback.correct}
        correctText={feedback.corrected}
        note={feedback.message}
        onNext={onSkip}
      />
    );
  }

  return (
    <div>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[2] }}>
        YOUR GERMAN TRANSLATION
      </div>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && check()}
        placeholder="Type your translation here… (Cmd/Ctrl+Enter to submit)"
        style={{
          width: '100%', boxSizing: 'border-box',
          minHeight: 120, padding: SPACE[4],
          border: BORDER.standard, background: COLORS.card,
          fontFamily: FONTS.display, fontSize: FONT_SIZE.xl,
          resize: 'vertical', outline: 'none', color: COLORS.ink,
          lineHeight: 1.5, marginBottom: SPACE[4],
        }}
      />
      <div style={{ display: 'flex', gap: SPACE[3] }}>
        <button onClick={check} disabled={!input.trim() || loading} style={{ ...BUTTON.danger, flex: 1, opacity: !input.trim() || loading ? 0.4 : 1 }}>
          {loading ? 'GRADING...' : <>CHECK <ArrowRight size={14} /></>}
        </button>
        <button onClick={onSkip} style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}>
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── AI Sentence Generation ───────────────────────────────────────────────────

async function generateMoreSentences(level) {
  const levelDesc = { a1: 'A1 beginner (very simple sentences)', a2: 'A2 elementary (focus on articles and prepositions)', b1: 'B1 intermediate (complex grammar)' }[level];
  const system = `You generate German translation exercises for ${levelDesc} learners. Respond ONLY with valid JSON array, no markdown.`;
  const user = level === 'b1'
    ? `Generate 5 English sentences for translation into German at B1 level. Return: [{"en":"...","de":"...","note":"grammar concept"}]`
    : level === 'a2'
    ? `Generate 5 English sentences for fill-in-the-blank German exercises at A2 level. Each must have 1-2 blanks targeting articles or prepositions. Return: [{"en":"...","de":"...","template":"German with ___ for blanks","blanks":[{"word":"correct","distractors":["wrong1","wrong2"]}],"note":"..."}]`
    : `Generate 5 simple English sentences for word-tile German translation at A1 level. Return: [{"en":"...","de":"...","words":["German","tokens","in","order"],"distractors":["wrong1","wrong2"],"note":"..."}]`;
  const raw = await callClaude(system, user);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TranslateTab({ level = 'a1' }) {
  const bankMap = { a1: TRANSLATE_SENTENCES_A1, a2: TRANSLATE_SENTENCES_A2, b1: TRANSLATE_SENTENCES_B1 };
  const [exercises, setExercises] = useState(() => shuffle(bankMap[level]));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Reset when level changes
  useEffect(() => {
    setExercises(shuffle(bankMap[level]));
    setIdx(0);
    setScore(0);
  }, [level]);

  const exercise = exercises[idx];

  const handleCorrect = () => setScore(s => s + 1);

  const handleNext = useCallback(async () => {
    const next = idx + 1;
    if (next >= exercises.length) {
      // Bank exhausted — generate more
      setGenerating(true);
      try {
        const more = await generateMoreSentences(level);
        setExercises(prev => [...prev, ...more]);
      } catch {
        // If generation fails, loop back to start
        setExercises(shuffle(bankMap[level]));
        setIdx(0);
        setGenerating(false);
        return;
      }
      setGenerating(false);
    }
    setIdx(next);
  }, [idx, exercises.length, level]);

  const handleSkip = () => handleNext();

  if (generating) {
    return (
      <div style={{ padding: SPACE[8], textAlign: 'center', fontFamily: FONTS.mono, fontSize: FONT_SIZE.base, letterSpacing: LETTER_SPACING.widest, color: COLORS.mute }}>
        <Sparkles size={24} style={{ marginBottom: SPACE[4], color: COLORS.gold }} />
        <div>GENERATING NEW EXERCISES...</div>
      </div>
    );
  }

  const SET_SIZE = 10;
  const setIdx_ = idx % SET_SIZE;

  return (
    <div>
      <Hero kicker="Section 04" title="Übersetzen" sub="The app gives you a sentence. You translate it. Three modes depending on your level." />
      <div style={{ marginTop: SPACE[8], maxWidth: 760 }}>
        <ExerciseHeader level={level} idx={setIdx_} total={SET_SIZE} />

        {/* Score bar */}
        <div style={{ height: 4, background: COLORS.paperDeep, border: BORDER.standard, marginBottom: SPACE[5] }}>
          <div style={{ height: '100%', background: COLORS.gold, width: `${(score / SET_SIZE) * 100}%`, transition: 'width 0.4s ease' }} />
        </div>

        <PromptCard text={exercise.en} />

        {level === 'a1' && <TileExercise key={idx} exercise={exercise} onCorrect={handleCorrect} onSkip={handleSkip} />}
        {level === 'a2' && <BlankExercise key={idx} exercise={exercise} onCorrect={handleCorrect} onSkip={handleSkip} />}
        {level === 'b1' && <TypingExercise key={idx} exercise={exercise} onCorrect={handleCorrect} onSkip={handleSkip} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Run dev server and manually test all three modes**

```bash
npm run dev
```

Open `http://localhost:5173`. Clear localStorage in DevTools > Application > Local Storage (delete all), reload.
- Select **Beginner (A1)** → go to Translate tab → word tiles should appear, clicking a tile moves it to the answer area, CHECK button grades
- Go back to splash (clear localStorage), select **Elementary (A2)** → fill-the-blanks sentence shown, clicking a tile fills next blank
- Go back to splash, select **Intermediate (B1)** → textarea, type a translation, CHECK calls AI and shows feedback

- [ ] **Step 4: Commit**

```bash
git add src/components/TranslateTab.jsx
git commit -m "feat: rewrite TranslateTab as exercise mode (tiles/blanks/typing by level)"
```

---

## Task 4 — ChatTab: Task Panel + Guided Conversation

**Files:**
- Modify: `src/components/ChatTab.jsx`

Add a `YOUR TASK` box below the scenario selector. Anna's system prompt is updated to be task-aware. A collapsible hint shows the model answer.

- [ ] **Step 1: Modify `src/components/ChatTab.jsx`**

Add these imports at the top:

```jsx
import { CHAT_TASKS } from '../data/content';
```

Add task state after existing state declarations:

```jsx
const [taskIdx, setTaskIdx] = useState(0);
const [hintVisible, setHintVisible] = useState(false);
```

Add a helper to get the current task:

```jsx
const currentTask = CHAT_TASKS[scenario]?.[level]?.[taskIdx % (CHAT_TASKS[scenario]?.[level]?.length || 1)] || null;
```

Replace the `systemPrompt` constant inside `sendMessage` with a task-aware version:

```jsx
const taskLine = currentTask
  ? `The learner's current task is: "${currentTask.task}". Stay in this scenario and guide them toward completing this task. When the task is naturally complete, include "taskComplete": true in your JSON response; otherwise omit it or set it to false.`
  : '';

const levelInstructions = level === 'a1'
  ? `The learner is A1 BEGINNER. Use very simple German, short sentences, common vocabulary only. Always provide English translation. Use lots of encouragement.`
  : level === 'a2'
  ? `The learner is A2 ELEMENTARY. Use natural but simple German. Provide English translation. Gently push them.`
  : `The learner is B1 INTERMEDIATE. Use natural German, moderate complexity. Provide English translation but challenge them.`;

const systemPrompt = `You are a friendly German tutor named Anna. Scenario: ${scenarioDesc}. ${taskLine}

${levelInstructions}

Respond ONLY with strict JSON (no markdown):
{
  "de": "your reply in German (1-2 sentences)",
  "ipa": "IPA pronunciation",
  "en": "English translation",
  "correction": null OR { "original": "...", "fixed": "...", "explain": "..." },
  "taskComplete": false
}`;
```

Handle `taskComplete` in the response parsing (inside the `try` block, after `setMessages`):

```jsx
if (parsed.taskComplete) {
  setTaskIdx(i => i + 1);
  setHintVisible(false);
}
```

Add the task panel to the JSX — insert it in the `<aside>` after the scenario list and before the Tip box:

```jsx
{currentTask && (
  <div style={{ marginTop: SPACE[4] }}>
    <SectionLabel num="B" text="Your Task" />
    <div style={{ border: BORDER.standard, background: COLORS.red, color: COLORS.paper, padding: SPACE[4] }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, opacity: 0.8, marginBottom: SPACE[2] }}>
        TASK {taskIdx + 1}
      </div>
      <div style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.base, lineHeight: 1.6, fontStyle: 'italic', marginBottom: SPACE[3] }}>
        {currentTask.task}
      </div>
      {currentTask.hint && (
        <>
          <button
            onClick={() => setHintVisible(v => !v)}
            style={{ background: 'transparent', border: `1px solid ${COLORS.paper}60`, color: COLORS.paper, fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.wider, padding: `${SPACE[1]}px ${SPACE[3]}px`, cursor: 'pointer' }}
          >
            {hintVisible ? 'HIDE HINT' : 'SHOW HINT'}
          </button>
          {hintVisible && (
            <div style={{ marginTop: SPACE[3], borderTop: `1px dashed ${COLORS.paper}50`, paddingTop: SPACE[3], fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, opacity: 0.9 }}>
              {currentTask.hint}
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}
```

Also add imports at the top of ChatTab:

```jsx
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, BORDER } from '../lib/theme';
```

(Replace the existing destructured import from `'../lib/theme'` which uses the old FONT_DISPLAY/FONT_MONO/FONT_BODY names — keep backward compat by also keeping those or switching fully to FONTS.display etc. Easiest: add the new names alongside the old ones in the import.)

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

- Open app as A1 level → Chat tab → left sidebar should show a red "YOUR TASK" box below scenario list
- Type something → Anna should respond and the task panel should reflect the scenario
- Click "SHOW HINT" → hint text appears
- Switch scenario → task resets to task 0 for that scenario

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatTab.jsx
git commit -m "feat: add task panel and guided conversation mode to ChatTab"
```

---

## Task 5 — VocabTab: Active Recall

**Files:**
- Modify: `src/components/VocabTab.jsx`

Replace the passive flip mechanic. A1/A2 get four-option multiple choice; B1 gets a type-the-meaning input. Cards answered incorrectly return to the end of the deck.

- [ ] **Step 1: Rewrite the card interaction section of `VocabTab.jsx`**

Add import:
```jsx
import { levenshtein } from '../lib/utils';
import { shuffle } from '../lib/utils';
```

Replace existing per-card state and the flashcard JSX. The deck management (deckId, customCards, generating) stays unchanged. Replace only the card interaction state and the right-column card area.

New card state (replace `flipped`, `deckComplete`):

```jsx
const [answered, setAnswered] = useState(false);   // true after user submits
const [result, setResult] = useState(null);         // 'correct' | 'almost' | 'wrong'
const [typedAnswer, setTypedAnswer] = useState('');
const [queue, setQueue] = useState([]);             // working copy of deck indices

// Reset queue when deck changes
useEffect(() => {
  setQueue(activeDeck.map((_, i) => i));
  setAnswered(false);
  setResult(null);
  setTypedAnswer('');
  setDeckComplete(false);
}, [deckId, customCards]);

const currentIdx = queue[0] ?? null;
const card = currentIdx !== null ? activeDeck[currentIdx] : null;
```

Generate four multiple-choice options for A1/A2:

```jsx
function getChoices(deck, cardIdx) {
  const correct = deck[cardIdx].en;
  const others = deck
    .filter((_, i) => i !== cardIdx)
    .map(c => c.en);
  const shuffledOthers = shuffle(others).slice(0, 3);
  return shuffle([correct, ...shuffledOthers]);
}
```

Replace the card area JSX (right column) with:

```jsx
{card && (
  <div>
    {/* Progress bar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACE[4] }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute }}>
        {queue.length} remaining
      </div>
      <div style={{ display: 'flex', gap: SPACE[1] }}>
        {activeDeck.map((_, i) => (
          <div key={i} style={{ width: 24, height: 4, background: learnedWords[activeDeck[i].de] ? COLORS.ink : COLORS.paperDeep, border: `1px solid ${COLORS.ink}30` }} />
        ))}
      </div>
    </div>

    {/* Card face — always shows German */}
    <div style={{ border: BORDER.standard, background: COLORS.card, minHeight: 200, padding: SPACE[12], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginBottom: SPACE[4] }}>
      <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['6xl'], fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.tight, marginBottom: SPACE[4] }}>
        {card.de}
      </div>
      {card.ipa && (
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>{card.ipa}</div>
      )}
    </div>

    {/* A1/A2 — multiple choice */}
    {(level === 'a1' || level === 'a2') && !answered && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE[3] }}>
        {getChoices(activeDeck, currentIdx).map(choice => (
          <button
            key={choice}
            onClick={() => {
              const correct = choice === card.en;
              setAnswered(true);
              setResult(correct ? 'correct' : 'wrong');
              if (correct) {
                markLearned(card.de);
                setTimeout(() => advanceQueue(correct), 1000);
              } else {
                // Wrong — card goes back to end of queue after showing feedback
              }
            }}
            style={{ padding: SPACE[4], border: BORDER.standard, background: COLORS.paper, color: COLORS.ink, fontFamily: FONTS.body, fontSize: FONT_SIZE.lg, fontStyle: 'italic', cursor: 'pointer' }}
          >
            {choice}
          </button>
        ))}
      </div>
    )}

    {/* B1 — type the meaning */}
    {level === 'b1' && !answered && (
      <div>
        <input
          value={typedAnswer}
          onChange={e => setTypedAnswer(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitTyped();
          }}
          placeholder="Type the English meaning…"
          style={{ width: '100%', boxSizing: 'border-box', padding: SPACE[4], border: BORDER.standard, fontFamily: FONTS.display, fontSize: FONT_SIZE.xl, background: COLORS.card, outline: 'none', marginBottom: SPACE[3] }}
        />
        <button onClick={submitTyped} disabled={!typedAnswer.trim()} style={{ ...BUTTON.danger, width: '100%', opacity: typedAnswer.trim() ? 1 : 0.4 }}>
          CHECK →
        </button>
      </div>
    )}

    {/* Feedback after answering */}
    {answered && (
      <div style={{ border: BORDER.standard, background: result === 'correct' ? COLORS.gold : result === 'almost' ? COLORS.paperDeep : COLORS.red, color: result === 'correct' ? COLORS.ink : result === 'almost' ? COLORS.ink : COLORS.paper, padding: SPACE[4], marginTop: SPACE[3] }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, marginBottom: SPACE[2] }}>
          {result === 'correct' ? '✓ CORRECT' : result === 'almost' ? '≈ CLOSE — CHECK SPELLING' : '✗ NOT QUITE'}
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACE[3] }}>
          {card.en}
        </div>
        <button onClick={() => advanceQueue(result === 'correct')} style={{ ...BUTTON.primary, background: result === 'correct' ? COLORS.ink : COLORS.paper, color: result === 'correct' ? COLORS.paper : COLORS.ink }}>
          NEXT CARD →
        </button>
      </div>
    )}
  </div>
)}
```

Add these helper functions inside the component (before the return):

```jsx
const submitTyped = () => {
  if (!typedAnswer.trim() || !card) return;
  const dist = levenshtein(typedAnswer.trim(), card.en);
  const res = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';
  setAnswered(true);
  setResult(res);
  if (res === 'correct') {
    markLearned(card.de);
    setTimeout(() => advanceQueue(true), 1000);
  }
};

const advanceQueue = (wasCorrect) => {
  setAnswered(false);
  setResult(null);
  setTypedAnswer('');
  setQueue(prev => {
    const [, ...rest] = prev;
    if (!wasCorrect) return [...rest, prev[0]]; // wrong: send to back
    if (rest.length === 0) setDeckComplete(true);
    return rest;
  });
};
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

- A1 level → Vocab tab → card shows German word, four English options appear, clicking correct option flashes gold and advances, clicking wrong shows red feedback and card returns to end
- B1 level → text input appears instead of choices, type answer, Enter submits
- Deck complete banner shows when all cards answered correctly at least once

- [ ] **Step 4: Commit**

```bash
git add src/components/VocabTab.jsx
git commit -m "feat: replace passive vocab flip with active recall (multiple choice + typing)"
```

---

## Task 6 — AlphabetTab: Audio Quiz Mode

**Files:**
- Modify: `src/components/AlphabetTab.jsx`

Add a quiz mode. A toggle at the top switches between Browse (existing grid) and Quiz (listen & identify). The quiz plays a letter via Web Speech and shows four confusable options.

- [ ] **Step 1: Modify `src/components/AlphabetTab.jsx`**

Add imports:
```jsx
import { ALPHABET_QUIZ_GROUPS } from '../data/content';
import { speak } from '../lib/speech';
import { shuffle } from '../lib/utils';
```

Add quiz state at the top of the component (after existing `selected` state):

```jsx
const [mode, setMode] = useState('quiz');           // 'quiz' | 'browse'
const [quizRound, setQuizRound] = useState(0);
const [quizGroup, setQuizGroup] = useState(null);   // { letters: [...] }
const [quizTarget, setQuizTarget] = useState(null); // the letter to identify
const [quizResult, setQuizResult] = useState(null); // null | 'correct' | 'wrong'
const [score, setScore] = useState({ correct: 0, total: 0 });
```

Add a function to start/advance quiz rounds:

```jsx
const startRound = (round) => {
  const group = ALPHABET_QUIZ_GROUPS[round % ALPHABET_QUIZ_GROUPS.length];
  const target = group.letters[Math.floor(Math.random() * group.letters.length)];
  setQuizGroup(group);
  setQuizTarget(target);
  setQuizResult(null);
  // Play the letter after a short delay
  setTimeout(() => speak(target), 300);
};

useEffect(() => {
  if (mode === 'quiz') startRound(quizRound);
}, [mode, quizRound]);
```

Replace the full return JSX with:

```jsx
return (
  <div>
    <Hero kicker="Section 02" title="Das Alphabet" sub="Browse all letters or test your ear — can you identify what you heard?" />

    {/* Mode toggle */}
    <div style={{ display: 'flex', border: BORDER.standard, width: 'fit-content', marginTop: SPACE[6], marginBottom: SPACE[6] }}>
      {['quiz', 'browse'].map(m => (
        <button
          key={m}
          onClick={() => setMode(m)}
          style={{ padding: `${SPACE[3]}px ${SPACE[6]}px`, background: mode === m ? COLORS.ink : 'transparent', color: mode === m ? COLORS.paper : COLORS.ink, border: 'none', fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.widest, cursor: 'pointer', textTransform: 'uppercase' }}
        >
          {m === 'quiz' ? '🎧 Quiz' : '📋 Browse'}
        </button>
      ))}
    </div>

    {/* ── QUIZ MODE ── */}
    {mode === 'quiz' && quizGroup && (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginBottom: SPACE[4] }}>
          ROUND {quizRound + 1} · SCORE {score.correct}/{score.total} · WHICH LETTER DID YOU HEAR?
        </div>

        {/* Play button */}
        <button
          onClick={() => speak(quizTarget)}
          style={{ width: 100, height: 100, borderRadius: '50%', background: COLORS.gold, border: BORDER.standard, fontSize: 40, cursor: 'pointer', marginBottom: SPACE[6], display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
        >
          🔊
        </button>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, letterSpacing: LETTER_SPACING.widest, color: COLORS.mute, marginBottom: SPACE[6], marginTop: SPACE[3] }}>
          TAP TO HEAR AGAIN
        </div>

        {/* Four letter options */}
        {!quizResult && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE[3] }}>
            {quizGroup.letters.map(letter => (
              <button
                key={letter}
                onClick={() => {
                  const correct = letter === quizTarget;
                  setQuizResult(correct ? 'correct' : 'wrong');
                  setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
                }}
                style={{ padding: SPACE[5], border: BORDER.standard, background: COLORS.paper, color: COLORS.ink, fontFamily: FONTS.display, fontSize: FONT_SIZE['5xl'], fontWeight: FONT_WEIGHT.bold, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        {/* Feedback */}
        {quizResult && (
          <div style={{ border: BORDER.standard, background: quizResult === 'correct' ? COLORS.gold : COLORS.red, color: quizResult === 'correct' ? COLORS.ink : COLORS.paper, padding: SPACE[5], marginTop: SPACE[4] }}>
            <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.bold, marginBottom: SPACE[2] }}>
              {quizResult === 'correct' ? `✓ ${quizTarget}` : `✗ It was: ${quizTarget}`}
            </div>
            {quizResult === 'wrong' && (
              <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: FONT_SIZE.base, opacity: 0.9, marginBottom: SPACE[4] }}>
                Example word: {ALPHABET.find(a => a.l === quizTarget)?.w || quizTarget}
              </div>
            )}
            <button
              onClick={() => setQuizRound(r => r + 1)}
              style={{ ...BUTTON.primary, background: quizResult === 'correct' ? COLORS.ink : COLORS.paper, color: quizResult === 'correct' ? COLORS.paper : COLORS.ink }}
            >
              NEXT ROUND →
            </button>
          </div>
        )}
      </div>
    )}

    {/* ── BROWSE MODE ── */}
    {mode === 'browse' && (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, border: BORDER.standard }}>
          {ALPHABET.map((letter, i) => {
            const isActive = selected?.l === letter.l;
            const isSpecial = ['Ä', 'Ö', 'Ü', 'ß'].includes(letter.l);
            return (
              <button
                key={letter.l}
                onClick={() => { setSelected(letter); speak(letter.l + '. ' + letter.w); }}
                style={{
                  aspectRatio: '1',
                  background: isActive ? COLORS.red : (isSpecial ? COLORS.paperDeep : COLORS.paper),
                  color: isActive ? COLORS.paper : COLORS.ink,
                  border: 'none',
                  borderRight: (i + 1) % 6 === 0 ? 'none' : BORDER.standard,
                  borderBottom: i >= ALPHABET.length - (ALPHABET.length % 6 || 6) ? 'none' : BORDER.standard,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', transition: 'all 0.15s', cursor: 'pointer',
                }}
              >
                <span style={{ position: 'absolute', top: 8, left: 10, fontFamily: FONTS.mono, fontSize: FONT_SIZE.label, opacity: 0.5 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['6xl'], fontWeight: FONT_WEIGHT.bold, lineHeight: 1, letterSpacing: LETTER_SPACING.tight }}>{letter.l}</span>
                <span style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, fontStyle: 'italic', marginTop: SPACE[1], opacity: 0.8 }}>{letter.w}</span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div style={{ marginTop: SPACE[8], padding: SPACE[8], background: COLORS.ink, color: COLORS.paper, display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: SPACE[8], alignItems: 'center' }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 180, fontWeight: FONT_WEIGHT.black, lineHeight: 0.8, letterSpacing: '-0.06em', color: COLORS.red }}>{selected.l}</div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, opacity: 0.6, marginBottom: SPACE[2] }}>EXAMPLE WORD</div>
              <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['5xl'], fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.tight, marginBottom: SPACE[2] }}>{selected.w}</div>
              <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: FONT_SIZE.xl, opacity: 0.7 }}>&quot;{selected.e}&quot;</div>
            </div>
            <button onClick={() => speak(selected.w)} style={{ width: 80, height: 80, background: COLORS.red, border: 'none', color: COLORS.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Volume2 size={32} />
            </button>
          </div>
        )}
      </>
    )}
  </div>
);
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

- Open Alphabet tab → defaults to Quiz mode → should hear a letter immediately, four options shown
- Click correct → gold feedback, NEXT ROUND advances
- Click wrong → red feedback with correct answer shown
- Score counter updates each round
- Switch to Browse → existing letter grid shown as before, clicking a letter plays audio and shows detail panel

- [ ] **Step 4: Final build + commit all**

```bash
npm run build
git add src/components/AlphabetTab.jsx
git commit -m "feat: add audio quiz mode to AlphabetTab (listen & identify)"
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| 3-level splash screen (A1/A2/B1) | Task 1 |
| Hybrid sentence bank (built-in + AI generation) | Task 2 + Task 3 (generateMoreSentences) |
| Exercise counter N/10, streak on completion | Task 3 (score bar tracks progress) |
| Translate A1 word tiles | Task 3 (TileExercise) |
| Translate A2 fill-blanks | Task 3 (BlankExercise) |
| Translate B1 free typing + AI grade | Task 3 (TypingExercise) |
| Skip button (no streak penalty) | Task 3 (SkipForward button in all modes) |
| Chat task panel + hints | Task 4 |
| Chat taskComplete detection | Task 4 (taskComplete in JSON response) |
| Vocab A1/A2 multiple choice | Task 5 |
| Vocab B1 type the meaning | Task 5 |
| Wrong cards back to end of deck | Task 5 (advanceQueue) |
| Levenshtein near-match tolerance | Task 5 (levenshtein ≤ 2 = "almost") |
| Alphabet audio quiz | Task 6 |
| Confusable letter groups | Task 2 (ALPHABET_QUIZ_GROUPS) + Task 6 |
| Browse mode preserved | Task 6 (mode toggle) |

All spec requirements covered. ✓
