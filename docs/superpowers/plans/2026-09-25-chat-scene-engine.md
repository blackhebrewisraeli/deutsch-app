# Chat Scene Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat opens every scene with an AI-written, in-character line scaled to the learner's CEFR level and the routed model, and composes each learner turn through an adaptive four-stage scaffold (word blocks → dropdown blank → typed blank → free text).

**Architecture:** Pack scenarios gain a `role`; `chatSystemPrompt` casts the AI as that role with the pack persona as an out-of-character coach, a concrete level spec, and an improv register keyed on the routed profile. Every AI reply carries a `next` suggestion that the pure `chatInputModes.js` validates (`parseScaffold`) and a stage machine (`advance`) consumes; `Composer` renders the stage. A hidden kickoff turn lets the AI speak first and keeps its opener in history.

**Tech Stack:** React 18, Vite 5, Vitest + RTL (`globals: false`), inline styles with `src/lib/theme.js` tokens.

**Spec:** `docs/superpowers/specs/2026-09-24-chat-scene-engine-design.md`

## Global Constraints

- Branch `feat/chat-scene-engine`; `.husky/pre-commit` runs lint-staged **and** the full suite — never `--no-verify`. Every commit must be green on its own.
- Tests import `{ describe, it, expect, vi, ... }` from `'vitest'`; co-located `*.test.js(x)`.
- Inline styles only, tokens from `src/lib/theme.js`; never hardcode colors, radii, shadows.
- `src/lib/*` and `src/components/*` stay language-blind: no German strings or grammar in engine logic. German content lives in `src/packs/de/`.
- `src/lib/prompts.js` must keep **zero imports** (the API lane imports it under native Node ESM).
- Chat JSON keys stay `de` / `ipa` / `en` (recorded AGENTS.md exception).
- Untouched: `/api/**`, storage keys, the routing catalog, quotas, `App.jsx`.
- Stage ladder, in order: `word_bank`, `choice_blank`, `typed_blank`, `free_text`. Start: a1 → `word_bank`, a2 → `choice_blank`, b1 → `typed_blank`, unknown → `word_bank`. Move after **2** consecutive clean / corrected graded turns.
- Stage labels: Build the sentence / Choose the word / Type the word / Free writing. Move notes: up → `Nice — next step: {label}`; down → `Let's add some help: {label}`.
- Gap controls must render at `FONT_SIZE.lg` (16px) so iOS does not zoom on focus.
- Verification before "done": `npm test`, `npm run lint`, `npm run format:check`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/packs/de/scenarios.js` | Scene data: `role { name, brief }`; the canned `greeting` is deleted (Task 7). |
| `src/packs/de/index.js` | Level specs with concrete length caps; drops the word-bank mock export (Task 7). |
| `src/packs/validate.js` | Requires `role`; stops requiring `greeting` (Task 7). |
| `src/lib/prompts.js` | `chatSystemPrompt` (role, coach, level, register, `next` contract), `CHAT_IMPROV`, `chatKickoffMessage`. |
| `src/lib/chatInputModes.js` | `INPUT_MODES`, `STAGES`, `startingStage`, `advance`, `parseScaffold`, `gapParts`. |
| `src/components/chat/ScaffoldActions.jsx` | **New** — shared "Type instead" + send row. |
| `src/components/chat/FillBlank.jsx` | **New** — sentence with a select (`choice`) or input (`typed`) in the gap. |
| `src/components/chat/WordBank.jsx` | Uses `ScaffoldActions`; otherwise unchanged. |
| `src/components/chat/Composer.jsx` | **New** — stage → input component, step label, live move note, "Say:" line. |
| `src/components/chat/MessageList.jsx`, `MessageBubble.jsx` | `speaker` prop; skip `hidden` messages. |
| `src/components/ChatTab.jsx` | Opener lifecycle, progression + scaffold state, full history, Try again. |

---

### Task 1: Scene roles and level specs in the pack

**Files:**
- Modify: `src/packs/de/scenarios.js`, `src/packs/de/index.js:103-109`, `src/packs/validate.js:34-44`
- Test: `src/packs/de/scenarios.test.js`, `src/packs/validate.test.js`, `src/packs/packs.test.js`, `src/components/ChatTab.test.jsx:127`

**Interfaces:**
- Produces: every `SCENARIOS[i].role` is `{ name: string, brief: string }`; `activePack.prompts.levels[a1|a2|b1]` each contain `learner line to N words`.

- [ ] **Step 1: Write the failing tests**

`src/packs/de/scenarios.test.js` — append:

```js
describe('scenario roles', () => {
  it('gives every scenario a role with a name and a brief', () => {
    for (const s of SCENARIOS) {
      expect(s.role, `${s.id} has no role`).toBeTruthy();
      for (const field of ['name', 'brief']) {
        expect(typeof s.role[field], `${s.id}.role.${field}`).toBe('string');
        expect(s.role[field].trim().length, `${s.id}.role.${field} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('casts Order Coffee as a barista, not the tutor', () => {
    const coffee = SCENARIOS.find((s) => s.id === 'coffee');
    expect(coffee.role.name).toBe('Barista');
    expect(coffee.role.brief).toMatch(/barista/i);
  });
});
```

`src/packs/validate.test.js` — add `role: { name: 'Ana', brief: 'a friendly local.' }` to the `validPack` scenario fixture, then add:

```js
  it('throws when a scenario has no role', () => {
    const roleless = { ...validPack.content.scenarios[0], role: undefined };
    const bad = { ...validPack, content: { ...validPack.content, scenarios: [roleless] } };
    expect(() => validateLanguagePack(bad)).toThrow(/scenarios\[0\]\.role/);
  });

  it('throws when a role is missing its brief', () => {
    const scenario = { ...validPack.content.scenarios[0], role: { name: 'Ana' } };
    const bad = { ...validPack, content: { ...validPack.content, scenarios: [scenario] } };
    expect(() => validateLanguagePack(bad)).toThrow(/role\.brief/);
  });
```

`src/packs/packs.test.js` — add (import `activePack` if not already):

```js
describe('chat level specs', () => {
  const cap = (lvl) =>
    Number(activePack.prompts.levels[lvl].match(/learner line to (\d+) words/)?.[1]);

  it('caps the suggested learner line more tightly at lower levels', () => {
    expect(cap('a1')).toBeLessThan(cap('a2'));
    expect(cap('a2')).toBeLessThan(cap('b1'));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/packs`
Expected: FAIL — `has no role`, the validator does not throw, `cap('a1')` is `NaN`.

- [ ] **Step 3: Implement**

`src/packs/de/scenarios.js` — add a `role` to each scenario (keep `greeting` until Task 7):

```js
free:    role: { name: 'Anna', brief: 'Anna, a friendly, curious local who enjoys chatting with language learners about everyday life.' },
coffee:  role: { name: 'Barista', brief: 'a friendly barista at a busy Berlin café. You greet customers, take their order and handle payment.' },
meet:    role: { name: 'Anna', brief: 'Anna, a friendly person the learner has just met at a party in Berlin. You make small talk and get to know them.' },
airport: role: { name: 'Check-in', brief: 'a helpful check-in agent at Frankfurt Airport. You check passengers in, handle luggage and give directions to gates.' },
```

`src/packs/de/index.js` — replace `levels`:

```js
    levels: {
      a1: 'The learner is A1 (beginner). Reply in ONE short sentence of about 8 words at most, present tense only, using the most common everyday words. Keep the suggested learner line to 6 words at most.',
      a2: 'The learner is A2 (elementary). Reply in 1–2 sentences of about 12 words each. Present tense and Perfekt are fine; use simple connectors (und, aber, weil). Keep the suggested learner line to 10 words at most.',
      b1: 'The learner is B1 (intermediate). Reply in 2–3 natural sentences. Any common tense and subordinate clauses are fine; use idiomatic but not rare vocabulary. Keep the suggested learner line to 15 words at most.',
    },
```

`src/packs/validate.js` — after the greeting loop add:

```js
  // Every scenario names who the AI plays. Without it the prompt would cast
  // the model as "undefined", far from the data omission that caused it.
  c.scenarios.forEach((s, i) => {
    const r = s.role;
    if (!r || typeof r !== 'object') fail(`content.scenarios[${i}].role must be an object`);
    for (const k of ['name', 'brief']) {
      if (typeof r[k] !== 'string' || r[k].trim().length === 0) {
        fail(`content.scenarios[${i}].role.${k} must be a non-empty string`);
      }
    }
  });
```

`src/components/ChatTab.test.jsx:127` — the old negative assertion goes vacuous with the new wording; replace
`expect(system).not.toContain('A1 BEGINNER');` with
`expect(system).not.toContain(activePack.prompts.levels.a1);`

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/packs src/components/ChatTab.test.jsx src/lib/prompts.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packs/de/scenarios.js src/packs/de/scenarios.test.js src/packs/de/index.js src/packs/validate.js src/packs/validate.test.js src/packs/packs.test.js src/components/ChatTab.test.jsx
git commit -m "feat(pack): scene roles and level specs with concrete length caps"
```

---

### Task 2: Prompt engine — scene role, coach, register, `next` contract, kickoff

**Files:**
- Modify: `src/lib/prompts.js:95-140`
- Test: `src/lib/prompts.test.js`

**Interfaces:**
- Consumes: scenario `role { name, brief }` (Task 1); routed `profile` from `routeAiRequest` (`'fast' | 'balanced' | 'capable'`).
- Produces: `chatSystemPrompt({ prompts, scenarioDesc, role, profile, task, level, vocab, sparse, interestHints }) → string`; `CHAT_IMPROV: Record<'fast'|'balanced'|'capable', string>`; `chatKickoffMessage() → string`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/prompts.test.js` import `CHAT_IMPROV, chatKickoffMessage`; set
`const role = { name: 'Barista', brief: 'a friendly barista at a busy Berlin café.' };`
and `const base = { prompts, scenarioDesc: 'at a Berlin café', role, level: 'a1' };`.
Replace the "names the pack persona" and "scenario description" tests; update the contract test; add:

```js
  it('casts the AI as the scene role, not a tutor', () => {
    const out = chatSystemPrompt(base);
    expect(out).toContain('You are a friendly barista at a busy Berlin café.');
    expect(out).not.toContain('tutor named');
  });

  it('keeps the pack persona as the out-of-character coach', () => {
    expect(chatSystemPrompt(base)).toContain(
      "you are also Anna, the learner's warm and encouraging coach"
    );
  });

  it('falls back to the persona as a conversation partner without a role', () => {
    const out = chatSystemPrompt({ ...base, role: undefined });
    expect(out).toContain('You are Anna, a friendly conversation partner.');
    expect(out).not.toContain('undefined');
  });

  it('names the scene and the target language', () => {
    expect(chatSystemPrompt(base)).toContain(
      'This is a German conversation-practice scene: at a Berlin café.'
    );
  });

  it('forbids scripted replies', () => {
    expect(chatSystemPrompt(base)).toContain('never use stock phrases or follow a script');
  });

  it.each(['fast', 'balanced', 'capable'])('carries only the %s improv register', (profile) => {
    const out = chatSystemPrompt({ ...base, profile });
    expect(out).toContain(CHAT_IMPROV[profile]);
    for (const other of Object.keys(CHAT_IMPROV).filter((p) => p !== profile)) {
      expect(out).not.toContain(CHAT_IMPROV[other]);
    }
  });

  it('uses the balanced register for a missing or unknown profile', () => {
    expect(chatSystemPrompt(base)).toContain(CHAT_IMPROV.balanced);
    expect(chatSystemPrompt({ ...base, profile: 'turbo' })).toContain(CHAT_IMPROV.balanced);
  });

  it('carries the engine JSON contract including the next suggestion', () => {
    const out = chatSystemPrompt(base);
    expect(out).toContain('You MUST always respond with strict JSON only');
    for (const key of ['"de"', '"ipa"', '"en"', '"correction"', '"taskComplete"', '"next"', '"blank"', '"distractors"']) {
      expect(out).toContain(key);
    }
  });

  it('never grades the opening line', () => {
    expect(chatSystemPrompt(base)).toContain('always null for your opening line');
  });

describe('chatKickoffMessage', () => {
  it('is bracketed stage direction the model is told not to correct', () => {
    const kickoff = chatKickoffMessage();
    expect(kickoff.startsWith('[')).toBe(true);
    expect(kickoff).toContain('Open the scene in character');
    expect(kickoff).toContain('do not correct it');
  });
});
```

The level tests keep working: the fixture still has `The learner is A1 BEGINNER…` strings.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/prompts.test.js`
Expected: FAIL — `CHAT_IMPROV` / `chatKickoffMessage` undefined, role text absent.

- [ ] **Step 3: Implement** — replace the `chatSystemPrompt` block in `src/lib/prompts.js`:

```js
/**
 * How freely the scene character improvises, keyed on the routed model
 * profile (src/lib/ai-routing/catalog.js). Engine-owned and language-blind:
 * a cheap model gets a tight brief, a capable one room to let the scene move.
 */
export const CHAT_IMPROV = Object.freeze({
  fast: 'Keep each reply short and focused on the task: one idea per turn.',
  balanced:
    'React to the specific things the learner says, and add small realistic touches to the scene.',
  capable:
    'Let the scene develop the way it would in real life: an item might be sold out, you might ask a follow-up question or add a small complication. Remember details the learner mentioned earlier and bring them back.',
});

/**
 * The hidden first user turn that lets the AI open the scene. The Messages API
 * needs a user message first; this one is stage direction, not learner speech.
 * @returns {string}
 */
export function chatKickoffMessage() {
  return '[The learner has just arrived. Open the scene in character with your first line. This bracketed note is stage direction, not something the learner said — do not correct it.]';
}

/**
 * The scene prompt. The AI plays the scenario's `role` in the reply line and,
 * separately, is the pack persona coaching out of character. `task` is
 * optional — when absent the sentence is omitted rather than left empty.
 * Unknown `level` keys fall back to a1; unknown `profile` to balanced.
 *
 * @param {{ prompts: Prompts, scenarioDesc: string, role?: { name: string, brief: string }, profile?: string, task?: string, level: string, vocab?: string[], sparse?: boolean, interestHints?: string[] }} args
 * @returns {string}
 */
export function chatSystemPrompt({
  prompts,
  scenarioDesc,
  role,
  profile,
  task,
  level,
  vocab,
  sparse,
  interestHints,
} = {}) {
  const { persona, targetLanguage, levels } = prompts ?? {};

  // Pack scenarios always carry a role (validate.js); the fallback keeps a
  // caller without one on a sensible partner instead of "You are undefined".
  const character = role?.brief || `${persona}, a friendly conversation partner.`;

  const taskLine = task
    ? `The learner's current task is: "${task}". Stay in this scenario and guide them toward completing this task. When the task is naturally complete, include "taskComplete": true in your JSON response; otherwise omit it or set it to false.`
    : '';

  const pedagogy = levels?.[level] || levels?.a1 || '';
  const improv = CHAT_IMPROV[profile] ?? CHAT_IMPROV.balanced;
  const vocabBlock = chatVocabConstraint({ vocab, sparse });
  const interestBlock = chatInterestBias({ hints: interestHints });

  return `You are ${character} This is a ${targetLanguage} conversation-practice scene: ${scenarioDesc}. Stay in character in the "de" line and carry the scene the way this character really would. Respond to what the learner actually says — never use stock phrases or follow a script.

Separately, you are also ${persona}, the learner's warm and encouraging coach. Coaching goes only in "correction" and "next" — never break character in "de". ${taskLine}

${pedagogy}

${improv}

${vocabBlock}
${interestBlock ? `\n${interestBlock}\n` : ''}
You MUST always respond with strict JSON only (no markdown, no extra text):
{
  "de": "your in-character reply in ${targetLanguage}",
  "ipa": "IPA pronunciation of the ${targetLanguage}",
  "en": "English translation",
  "correction": null OR { "original": "what they said", "fixed": "corrected ${targetLanguage}", "explain": "brief friendly explanation in English" },
  "taskComplete": false,
  "next": {
    "de": "a short, natural line the learner could say next in ${targetLanguage}, at their level, moving toward the task",
    "en": "its English meaning",
    "blank": "exactly one word copied from next.de that is worth practising (not a name)",
    "distractors": ["two plausible wrong alternatives for blank, same word class"]
  }
}

Only provide "correction" if the learner made a real grammar/vocabulary mistake; it is always null for your opening line.`;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/prompts.test.js src/components/ChatTab.test.jsx api/`
Expected: PASS (ChatTab still calls without `role`/`profile` → persona fallback + balanced).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.js src/lib/prompts.test.js
git commit -m "feat(chat): scene-role prompt with coach layer, level spec, model register and next contract"
```

---

### Task 3: Stage machine and scaffold parsing

**Files:**
- Modify: `src/lib/chatInputModes.js`
- Test: `src/lib/chatInputModes.test.js`

**Interfaces:**
- Produces:
  - `INPUT_MODES = { WORD_BANK:'word_bank', CHOICE_BLANK:'choice_blank', TYPED_BLANK:'typed_blank', FREE_TEXT:'free_text' }`, `STAGES` (that order).
  - `startingStage(level) → stage`
  - `advance({ stage, streak }, corrected: boolean) → { stage, streak, moved: 'up'|'down'|null }`
  - `parseScaffold(next) → null | { en: string, tokens: string[], blankIndex: number, answer: string, distractors: string[] }`
  - `gapParts({ tokens, blankIndex }) → { before: string, after: string }`
  - `defaultInputMode` stays until Task 7 deletes it.

- [ ] **Step 1: Write the failing tests** — `src/lib/chatInputModes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  INPUT_MODES,
  STAGES,
  defaultInputMode,
  startingStage,
  advance,
  parseScaffold,
  gapParts,
} from './chatInputModes';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

const next = {
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
};

describe('defaultInputMode (mock)', () => {
  it.each([
    ['A1', WORD_BANK],
    ['B1', FREE_TEXT],
  ])('%s starts in %s', (level, mode) => {
    expect(defaultInputMode(level)).toBe(mode);
  });
});

describe('STAGES', () => {
  it('orders the ladder from most to least support', () => {
    expect(STAGES).toEqual([WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT]);
  });
});

describe('startingStage', () => {
  it.each([
    ['a1', WORD_BANK],
    ['A1', WORD_BANK],
    ['a2', CHOICE_BLANK],
    ['b1', TYPED_BLANK],
    ['B1', TYPED_BLANK],
    [undefined, WORD_BANK],
    ['c2', WORD_BANK],
  ])('%s starts at %s', (level, stage) => {
    expect(startingStage(level)).toBe(stage);
  });
});

describe('advance', () => {
  const at = (stage, streak = 0) => ({ stage, streak });

  it('counts a first clean turn without moving', () => {
    expect(advance(at(WORD_BANK), false)).toEqual({ stage: WORD_BANK, streak: 1, moved: null });
  });

  it('moves up one stage after two clean turns in a row', () => {
    expect(advance(at(WORD_BANK, 1), false)).toEqual({ stage: CHOICE_BLANK, streak: 0, moved: 'up' });
  });

  it('moves down one stage after two corrected turns in a row', () => {
    expect(advance(at(TYPED_BLANK, -1), true)).toEqual({ stage: CHOICE_BLANK, streak: 0, moved: 'down' });
  });

  it('restarts the streak when the direction flips', () => {
    expect(advance(at(CHOICE_BLANK, 1), true)).toEqual({ stage: CHOICE_BLANK, streak: -1, moved: null });
    expect(advance(at(CHOICE_BLANK, -1), false)).toEqual({ stage: CHOICE_BLANK, streak: 1, moved: null });
  });

  it('stays at the ends of the ladder', () => {
    expect(advance(at(FREE_TEXT, 1), false)).toEqual({ stage: FREE_TEXT, streak: 0, moved: null });
    expect(advance(at(WORD_BANK, -1), true)).toEqual({ stage: WORD_BANK, streak: 0, moved: null });
  });
});

describe('parseScaffold', () => {
  it('splits the line into tokens and finds the blank through punctuation', () => {
    expect(parseScaffold(next)).toEqual({
      en: "I'd like a coffee, please.",
      tokens: ['Ich', 'möchte', 'einen', 'Kaffee,', 'bitte.'],
      blankIndex: 3,
      answer: 'Kaffee',
      distractors: ['Tee', 'Wasser'],
    });
  });

  it('matches the blank case-insensitively and keeps the sentence casing', () => {
    const s = parseScaffold({ ...next, blank: 'ich' });
    expect(s.blankIndex).toBe(0);
    expect(s.answer).toBe('Ich');
  });

  it('de-duplicates and trims distractors', () => {
    expect(parseScaffold({ ...next, distractors: [' Tee', 'Tee', 'Wasser'] }).distractors).toEqual(['Tee', 'Wasser']);
  });

  it('tolerates a missing English line', () => {
    expect(parseScaffold({ ...next, en: undefined }).en).toBe('');
  });

  it.each([
    ['no suggestion', undefined],
    ['a string', 'Ich möchte'],
    ['an empty line', { ...next, de: '  ' }],
    ['an empty blank', { ...next, blank: '' }],
    ['a blank not in the line', { ...next, blank: 'Milch' }],
    ['a multi-word blank', { ...next, blank: 'einen Kaffee' }],
    ['no distractors', { ...next, distractors: [] }],
    ['distractors that are not an array', { ...next, distractors: 'Tee' }],
    ['a non-string distractor', { ...next, distractors: ['Tee', 3] }],
    ['a distractor equal to the answer', { ...next, distractors: ['kaffee', 'Tee'] }],
  ])('rejects %s', (_, input) => {
    expect(parseScaffold(input)).toBeNull();
  });
});

describe('gapParts', () => {
  it('splits the sentence around the gap, keeping punctuation outside it', () => {
    expect(gapParts(parseScaffold(next))).toEqual({ before: 'Ich möchte einen ', after: ', bitte.' });
  });

  it('handles a gap at the start and at the end', () => {
    expect(gapParts(parseScaffold({ ...next, blank: 'Ich' }))).toEqual({
      before: '',
      after: ' möchte einen Kaffee, bitte.',
    });
    expect(gapParts(parseScaffold({ ...next, de: 'Einen Kaffee, bitte.', blank: 'bitte' }))).toEqual({
      before: 'Einen Kaffee, ',
      after: '.',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/chatInputModes.test.js`
Expected: FAIL — `STAGES`, `startingStage`, `advance`, `parseScaffold`, `gapParts` not exported.

- [ ] **Step 3: Implement** — `src/lib/chatInputModes.js`:

```js
/**
 * How the learner composes a Chat turn, and the ladder between the modes.
 * Scaffolding runs from most supported (arrange given words) to least (type
 * freely). Everything here is pure and language-blind: tokens are split on
 * whitespace and punctuation is Unicode `\p{P}`.
 */
export const INPUT_MODES = Object.freeze({
  WORD_BANK: 'word_bank',
  CHOICE_BLANK: 'choice_blank',
  TYPED_BLANK: 'typed_blank',
  FREE_TEXT: 'free_text',
});

/** The scaffold ladder, most support first. */
export const STAGES = Object.freeze([
  INPUT_MODES.WORD_BANK,
  INPUT_MODES.CHOICE_BLANK,
  INPUT_MODES.TYPED_BLANK,
  INPUT_MODES.FREE_TEXT,
]);

/** Consecutive clean (or corrected) graded turns that move one stage. */
export const STEP_AFTER = 2;

const START_BY_BAND = Object.freeze({
  a1: INPUT_MODES.WORD_BANK,
  a2: INPUT_MODES.CHOICE_BLANK,
  b1: INPUT_MODES.TYPED_BLANK,
});

/** MOCK: kept until ChatTab moves to startingStage (removed in the same PR). */
export function defaultInputMode(level) {
  const band = String(level ?? '').toLowerCase();
  return band === 'a1' || band === 'a2' ? INPUT_MODES.WORD_BANK : INPUT_MODES.FREE_TEXT;
}

/** Where a learner at this CEFR band starts a conversation. */
export function startingStage(level) {
  return START_BY_BAND[String(level ?? '').toLowerCase()] ?? INPUT_MODES.WORD_BANK;
}

/**
 * One graded turn's effect on progression. `streak` counts consecutive clean
 * turns (positive) or corrected ones (negative); a flip in direction restarts
 * it, and so does any stage change — including one clamped at either end.
 *
 * @param {{ stage: string, streak: number }} progression
 * @param {boolean} corrected
 * @returns {{ stage: string, streak: number, moved: 'up' | 'down' | null }}
 */
export function advance({ stage, streak }, corrected) {
  const count = corrected ? Math.min(streak, 0) - 1 : Math.max(streak, 0) + 1;
  if (Math.abs(count) < STEP_AFTER) return { stage, streak: count, moved: null };
  const idx = STAGES.indexOf(stage);
  const target = idx === -1 ? undefined : STAGES[idx + (corrected ? -1 : 1)];
  if (!target) return { stage, streak: 0, moved: null };
  return { stage: target, streak: 0, moved: corrected ? 'down' : 'up' };
}

const EDGE_PUNCT = /^\p{P}+|\p{P}+$/gu;
const core = (token) => token.replace(EDGE_PUNCT, '');
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validates the AI's `next` suggestion into what the scaffolded composers
 * render. Anything unusable returns null, and that turn falls back to free
 * text rather than rendering a broken exercise.
 *
 * @param {unknown} next
 * @returns {{ en: string, tokens: string[], blankIndex: number, answer: string, distractors: string[] } | null}
 */
export function parseScaffold(next) {
  if (!next || typeof next !== 'object') return null;
  const { de, en, blank, distractors } = next;
  if (!nonEmpty(de) || !nonEmpty(blank) || !Array.isArray(distractors)) return null;
  if (distractors.length === 0 || !distractors.every(nonEmpty)) return null;
  const key = blank.trim().toLowerCase();
  if (distractors.some((d) => d.trim().toLowerCase() === key)) return null;

  const tokens = de.trim().split(/\s+/);
  const blankIndex = tokens.findIndex((t) => core(t).toLowerCase() === key);
  if (blankIndex === -1) return null;

  return {
    en: nonEmpty(en) ? en.trim() : '',
    tokens,
    blankIndex,
    answer: core(tokens[blankIndex]),
    distractors: [...new Set(distractors.map((d) => d.trim()))],
  };
}

/**
 * The sentence either side of the gap. Punctuation glued to the blank token
 * stays outside the gap, so "Kaffee," becomes gap + ",".
 *
 * @param {{ tokens: string[], blankIndex: number }} scaffold
 * @returns {{ before: string, after: string }}
 */
export function gapParts({ tokens, blankIndex }) {
  const token = tokens[blankIndex];
  const word = core(token);
  const at = token.indexOf(word);
  const head = tokens.slice(0, blankIndex).join(' ');
  const tail = tokens.slice(blankIndex + 1).join(' ');
  return {
    before: (head ? `${head} ` : '') + token.slice(0, at),
    after: token.slice(at + word.length) + (tail ? ` ${tail}` : ''),
  };
}
```

Note: `FILL_IN_THE_BLANK` is gone; `grep -rn FILL_IN_THE_BLANK src` must return nothing.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/chatInputModes.test.js src/components/ChatTab.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chatInputModes.js src/lib/chatInputModes.test.js
git commit -m "feat(chat): adaptive scaffold stage machine and next-suggestion parsing"
```

---

### Task 4: FillBlank and the shared scaffold action row

**Files:**
- Create: `src/components/chat/ScaffoldActions.jsx`, `src/components/chat/FillBlank.jsx`, `src/components/chat/FillBlank.test.jsx`
- Modify: `src/components/chat/WordBank.jsx` (footer → `ScaffoldActions`)

**Interfaces:**
- Consumes: `parseScaffold`, `gapParts` (Task 3); `shuffle` from `src/lib/utils.js`.
- Produces: `<ScaffoldActions canSend onSend onSwitchToTyping />`; `<FillBlank mode="choice"|"typed" scaffold thinking onSend onSwitchToTyping />` — calls `onSend(fullSentence)`.

- [ ] **Step 1: Write the failing test** — `src/components/chat/FillBlank.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FillBlank from './FillBlank';
import { parseScaffold } from '../../lib/chatInputModes';

const scaffold = parseScaffold({
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
});

function renderGap(props) {
  const handlers = { onSend: vi.fn(), onSwitchToTyping: vi.fn() };
  render(<FillBlank scaffold={scaffold} thinking={false} {...handlers} {...props} />);
  return handlers;
}

describe('FillBlank — choice', () => {
  it('offers the answer and distractors in the gap and sends the whole sentence', async () => {
    const { onSend } = renderGap({ mode: 'choice' });
    const gap = screen.getByRole('combobox', { name: 'Missing word' });
    const offered = within(gap)
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((t) => t !== '…')
      .sort();
    expect(offered).toEqual(['Kaffee', 'Tee', 'Wasser']);
    expect(screen.getByRole('group', { name: 'Your sentence' })).toHaveTextContent(
      /^Ich möchte einen .*, bitte\.$/
    );

    const send = screen.getByRole('button', { name: 'Send chat message' });
    expect(send).toBeDisabled();
    await userEvent.selectOptions(gap, 'Tee');
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith('Ich möchte einen Tee, bitte.');
  });
});

describe('FillBlank — typed', () => {
  it('sends the typed word inside the sentence on Enter and clears the gap', async () => {
    const { onSend } = renderGap({ mode: 'typed' });
    const gap = screen.getByRole('textbox', { name: 'Missing word' });
    await userEvent.type(gap, 'Kaffee{Enter}');
    expect(onSend).toHaveBeenCalledWith('Ich möchte einen Kaffee, bitte.');
    expect(gap).toHaveValue('');
  });

  it('keeps send disabled while the tutor is thinking', async () => {
    const { onSend } = renderGap({ mode: 'typed', thinking: true });
    await userEvent.type(screen.getByRole('textbox', { name: 'Missing word' }), 'Kaffee{Enter}');
    expect(screen.getByRole('button', { name: 'Send chat message' })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('offers the escape hatch to free typing', async () => {
    const { onSwitchToTyping } = renderGap({ mode: 'typed' });
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(onSwitchToTyping).toHaveBeenCalled();
  });

  it('renders the gap at 16px so iOS does not zoom on focus', () => {
    renderGap({ mode: 'typed' });
    expect(screen.getByRole('textbox', { name: 'Missing word' })).toHaveStyle({ fontSize: '16px' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/chat/FillBlank.test.jsx`
Expected: FAIL — cannot resolve `./FillBlank`.

- [ ] **Step 3: Implement**

`src/components/chat/ScaffoldActions.jsx` — move WordBank's footer here verbatim:

```jsx
import { ArrowRight, Keyboard } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../../lib/theme';

/**
 * The action row every scaffolded composer shares: the escape hatch to free
 * typing, and send. One component so WordBank and FillBlank cannot drift.
 */
export default function ScaffoldActions({ canSend, onSend, onSwitchToTyping }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE[2] }}>
      <button
        type="button"
        data-ui="button"
        onClick={onSwitchToTyping}
        aria-label="Type instead"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
          background: 'none',
          border: 'none',
          color: COLORS.inkSoft,
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.sm,
          cursor: 'pointer',
        }}
      >
        <Keyboard size={FONT_SIZE.lg} aria-hidden="true" /> Type instead
      </button>
      <button
        type="button"
        data-ui="button"
        data-focus-on-dark=""
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send chat message"
        style={{
          width: 40,
          height: 40,
          padding: 0,
          background: canSend ? COLORS.green : COLORS.mute,
          color: COLORS.paper,
          border: 'none',
          borderRadius: RADIUS.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
```

`src/components/chat/WordBank.jsx` — drop the `ArrowRight, Keyboard` import and replace the footer `<div>` with
`<ScaffoldActions canSend={canSend} onSend={send} onSwitchToTyping={onSwitchToTyping} />`.

`src/components/chat/FillBlank.jsx`:

```jsx
import { useState } from 'react';
import { BORDER, COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../../lib/theme';
import { gapParts } from '../../lib/chatInputModes';
import { shuffle } from '../../lib/utils';
import ScaffoldActions from './ScaffoldActions';

// 16px, not md: iOS zooms the page when a focused field is under 16px.
const gapStyle = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZE.lg,
  color: COLORS.ink,
  background: COLORS.surface,
  border: BORDER.panel,
  borderRadius: RADIUS.md,
  padding: `${SPACE[1]}px ${SPACE[2]}px`,
  margin: `0 ${SPACE[1]}px`,
};

/**
 * Fill-in-the-blank composer for the two middle scaffold stages: the AI's
 * suggested line with one word missing. `choice` offers the word and its
 * distractors in a native select; `typed` asks for it. Either way the whole
 * sentence goes through the shared onSend and the AI grades it like any turn.
 */
export default function FillBlank({ mode, scaffold, thinking, onSend, onSwitchToTyping }) {
  const [options] = useState(() => shuffle([scaffold.answer, ...scaffold.distractors]));
  const [word, setWord] = useState('');
  const { before, after } = gapParts(scaffold);
  const canSend = word.trim().length > 0 && !thinking;

  const send = () => {
    if (!canSend) return;
    onSend(`${before}${word.trim()}${after}`);
    setWord('');
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${COLORS.border}`,
        padding: SPACE[3],
        background: COLORS.paperDeep,
        display: 'grid',
        gap: SPACE[3],
        minWidth: 0,
      }}
    >
      <div
        role="group"
        aria-label="Your sentence"
        style={{
          fontFamily: FONTS.body,
          fontSize: FONT_SIZE.lg,
          color: COLORS.ink,
          lineHeight: 2.2,
          overflowWrap: 'anywhere',
        }}
      >
        {before}
        {mode === 'choice' ? (
          <select
            aria-label="Missing word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            style={gapStyle}
          >
            <option value="" disabled>
              …
            </option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Missing word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ ...gapStyle, width: '7em' }}
          />
        )}
        {after}
      </div>
      <ScaffoldActions canSend={canSend} onSend={send} onSwitchToTyping={onSwitchToTyping} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/chat src/components/ChatTab.test.jsx`
Expected: PASS (WordBank behaviour unchanged, covered by ChatTab's word-bank test).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ScaffoldActions.jsx src/components/chat/FillBlank.jsx src/components/chat/FillBlank.test.jsx src/components/chat/WordBank.jsx
git commit -m "feat(chat): fill-in-the-blank composer with dropdown and typed gaps"
```

---

### Task 5: Composer — stage switch, step label, move note

**Files:**
- Create: `src/components/chat/Composer.jsx`, `src/components/chat/Composer.test.jsx`

**Interfaces:**
- Consumes: `INPUT_MODES`, `STAGES`, `parseScaffold` (Task 3); `WordBank`, `FillBlank` (Task 4); `ChatInput`.
- Produces: `<Composer stage moved scaffold turnKey thinking onSend onChooseStage freeText />` where `freeText = { input, setInput, listening, onStartListening, onStopListening }`; exports `STAGE_LABELS`.

- [ ] **Step 1: Write the failing test** — `src/components/chat/Composer.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Composer from './Composer';
import { INPUT_MODES, parseScaffold } from '../../lib/chatInputModes';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

const scaffold = parseScaffold({
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
});

const freeText = {
  input: '',
  setInput: vi.fn(),
  listening: false,
  onStartListening: vi.fn(),
  onStopListening: vi.fn(),
};

function renderComposer(props) {
  const onChooseStage = vi.fn();
  render(
    <Composer
      stage={WORD_BANK}
      moved={null}
      scaffold={scaffold}
      turnKey={1}
      thinking={false}
      onSend={vi.fn()}
      onChooseStage={onChooseStage}
      freeText={freeText}
      {...props}
    />
  );
  return { onChooseStage };
}

describe('Composer', () => {
  it('word blocks: tiles are the tokens plus the distractors, with the Say line', () => {
    renderComposer();
    const tiles = within(screen.getByRole('group', { name: 'Word bank' }))
      .getAllByRole('button')
      .map((b) => b.textContent)
      .sort();
    expect(tiles).toEqual(['Ich', 'Kaffee,', 'Tee', 'Wasser', 'bitte.', 'einen', 'möchte'].sort());
    expect(screen.getByText("Say: I'd like a coffee, please.")).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4 · Build the sentence')).toBeInTheDocument();
  });

  it.each([
    [CHOICE_BLANK, 'combobox', 'Step 2 of 4 · Choose the word'],
    [TYPED_BLANK, 'textbox', 'Step 3 of 4 · Type the word'],
  ])('%s renders the gap and its step', (stage, role, label) => {
    renderComposer({ stage });
    expect(screen.getByRole(role, { name: 'Missing word' })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('free writing: the typing composer, no Say line, and a way back to word blocks', async () => {
    const { onChooseStage } = renderComposer({ stage: FREE_TEXT });
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    expect(screen.queryByText(/^Say:/)).not.toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4 · Free writing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use word bank' }));
    expect(onChooseStage).toHaveBeenCalledWith(WORD_BANK);
  });

  it('falls back to free text without a usable scaffold, hiding the step and the hatch', () => {
    renderComposer({ scaffold: null });
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    expect(screen.queryByText(/^Step /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use word bank' })).not.toBeInTheDocument();
  });

  it('"Type instead" chooses free writing', async () => {
    const { onChooseStage } = renderComposer({ stage: CHOICE_BLANK });
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(onChooseStage).toHaveBeenCalledWith(FREE_TEXT);
  });

  it.each([
    ['up', CHOICE_BLANK, 'Nice — next step: Choose the word'],
    ['down', WORD_BANK, "Let's add some help: Build the sentence"],
  ])('announces a move %s', (moved, stage, note) => {
    renderComposer({ stage, moved });
    expect(screen.getByRole('status')).toHaveTextContent(note);
  });

  it('keeps the live region mounted but silent when nothing moved', () => {
    renderComposer();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/chat/Composer.test.jsx`
Expected: FAIL — cannot resolve `./Composer`.

- [ ] **Step 3: Implement** — `src/components/chat/Composer.jsx`:

```jsx
import { COLORS, FONTS, FONT_SIZE, SPACE, TEXT } from '../../lib/theme';
import { INPUT_MODES, STAGES } from '../../lib/chatInputModes';
import ChatInput from './ChatInput';
import FillBlank from './FillBlank';
import WordBank from './WordBank';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

export const STAGE_LABELS = Object.freeze({
  [WORD_BANK]: 'Build the sentence',
  [CHOICE_BLANK]: 'Choose the word',
  [TYPED_BLANK]: 'Type the word',
  [FREE_TEXT]: 'Free writing',
});

const MOVE_NOTE = {
  up: (label) => `Nice — next step: ${label}`,
  down: (label) => `Let's add some help: ${label}`,
};

/**
 * Chat's input, chosen by the learner's scaffold stage. Every scaffolded stage
 * renders the AI's latest `next` suggestion. Without a usable one (malformed,
 * or the opener failed) the turn is free text and the stage is left alone, so
 * the next good suggestion brings the scaffold straight back.
 *
 * The status region stays mounted so a stage change is announced.
 */
export default function Composer({
  stage,
  moved,
  scaffold,
  turnKey,
  thinking,
  onSend,
  onChooseStage,
  freeText,
}) {
  const shown = scaffold ? stage : FREE_TEXT;
  const label = STAGE_LABELS[stage];
  const typeInstead = () => onChooseStage(FREE_TEXT);

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'grid',
          gap: SPACE[1],
          padding: scaffold || moved ? `${SPACE[2]}px ${SPACE[3]}px` : 0,
          background: COLORS.paperDeep,
        }}
      >
        {scaffold && (
          <span style={TEXT.label}>
            {`Step ${STAGES.indexOf(stage) + 1} of ${STAGES.length} · ${label}`}
          </span>
        )}
        <div
          role="status"
          style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, color: COLORS.inkSoft }}
        >
          {moved ? MOVE_NOTE[moved](label) : ''}
        </div>
        {shown !== FREE_TEXT && scaffold.en && (
          <p style={{ margin: 0, fontFamily: FONTS.body, fontSize: FONT_SIZE.md, color: COLORS.ink }}>
            {`Say: ${scaffold.en}`}
          </p>
        )}
      </div>

      {shown === WORD_BANK && (
        <WordBank
          key={`bank-${turnKey}`}
          words={[...scaffold.tokens, ...scaffold.distractors]}
          thinking={thinking}
          onSend={onSend}
          onSwitchToTyping={typeInstead}
        />
      )}
      {(shown === CHOICE_BLANK || shown === TYPED_BLANK) && (
        <FillBlank
          key={`gap-${turnKey}-${shown}`}
          mode={shown === CHOICE_BLANK ? 'choice' : 'typed'}
          scaffold={scaffold}
          thinking={thinking}
          onSend={onSend}
          onSwitchToTyping={typeInstead}
        />
      )}
      {shown === FREE_TEXT && (
        <ChatInput
          {...freeText}
          thinking={thinking}
          onSend={onSend}
          onSwitchToWordBank={scaffold ? () => onChooseStage(WORD_BANK) : undefined}
        />
      )}
    </div>
  );
}
```

Note: the empty status `div` must render no whitespace child, or `toBeEmptyDOMElement` fails — `''` renders nothing.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/chat/Composer.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/Composer.jsx src/components/chat/Composer.test.jsx
git commit -m "feat(chat): stage-driven composer with step label and announced moves"
```

---

### Task 6: Speaker names the scene character; hidden turns stay hidden

**Files:**
- Modify: `src/components/chat/MessageList.jsx`, `src/components/chat/MessageBubble.jsx`
- Test: `src/components/chat/MessageList.test.jsx`, `src/components/chat/MessageBubble.test.jsx`

**Interfaces:**
- Produces: `<MessageList speaker? … />` (default `activePack.prompts.persona`) skips `msg.hidden`; `<MessageBubble msg speaker? />`.

- [ ] **Step 1: Write the failing tests**

`MessageList.test.jsx`:

```jsx
  it('never renders a hidden message', () => {
    const hidden = { role: 'user', de: '[stage direction]', hidden: true };
    render(<MessageList messages={[hidden, ...messages]} thinking={false} endRef={createRef()} />);
    expect(screen.queryByText('[stage direction]')).not.toBeInTheDocument();
    expect(screen.getByText('Mir geht es gut.')).toBeInTheDocument();
  });

  it('names the scene speaker in the typing indicator and the bubbles', () => {
    render(<MessageList messages={messages} thinking speaker="Barista" endRef={createRef()} />);
    expect(screen.getByText('Barista tippt')).toBeInTheDocument();
    expect(screen.getByText('— BARISTA')).toBeInTheDocument();
  });
```

`MessageBubble.test.jsx`:

```jsx
  it('labels the bubble and its audio with the given speaker', () => {
    render(<MessageBubble msg={annaMsg} speaker="Barista" />);
    expect(screen.getByText('— BARISTA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Barista response audio' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/chat/MessageList.test.jsx src/components/chat/MessageBubble.test.jsx`
Expected: FAIL — the hidden text renders; "Anna tippt" instead of "Barista tippt".

- [ ] **Step 3: Implement**

`MessageList.jsx`: signature `({ messages, thinking, endRef, compact = false, speaker = activePack.prompts.persona })`; map as
`messages.map((m, i) => (m.hidden ? null : <MessageBubble key={i} msg={m} speaker={speaker} />))`; indicator `<span>{speaker} tippt</span>`. Keep the KNOWN GAP comment, reworded to "the speaker name is pack-owned".

`MessageBubble.jsx`: signature `({ msg, speaker = activePack.prompts.persona })`; label `` `— ${speaker.toUpperCase()}` ``; audio `aria-label={`Play ${speaker} response audio`}`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/components/chat src/components/ChatTab.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageList.jsx src/components/chat/MessageList.test.jsx src/components/chat/MessageBubble.jsx src/components/chat/MessageBubble.test.jsx
git commit -m "feat(chat): name the scene character as speaker and keep hidden turns out of the thread"
```

---

### Task 7: ChatTab scene engine; delete canned greetings and the word-bank mock

**Files:**
- Modify: `src/components/ChatTab.jsx`, `src/packs/de/scenarios.js`, `src/packs/de/index.js`, `src/packs/de/chatTasks.js`, `src/packs/validate.js`, `src/lib/chatInputModes.js`, `docs/MAINTENANCE_CHECKLIST.md:125`
- Test: `src/components/ChatTab.test.jsx` (rewrite), `src/packs/de/scenarios.test.js`, `src/packs/validate.test.js`, `src/lib/chatInputModes.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–6; `routeAiRequest(ctx).profile`.

- [ ] **Step 1: Rewrite `src/components/ChatTab.test.jsx`** around the opener. Shared scaffolding:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatTab from './ChatTab';
import { callClaude } from '../lib/claude';
import { speak } from '../lib/speech';
import { setUserLevel } from '../lib/levelPref';
import { chatKickoffMessage, CHAT_IMPROV } from '../lib/prompts';
import { activePack } from '../packs';

vi.mock('../lib/claude', () => ({ callClaude: vi.fn() }));
vi.mock('../lib/speech', () => ({ speak: vi.fn() }));

const OPENER_DE = 'Guten Tag! Was darf es sein?';
const NEXT = {
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
};
const FIX = { original: 'x', fixed: 'y', explain: 'z' };
const opener = (next) =>
  JSON.stringify({ de: OPENER_DE, ipa: '[ˈɡuːtn̩ taːk]', en: 'Good day! What can I get you?', next });
const reply = JSON.stringify({ de: 'Hallo!', ipa: '[haˈloː]', en: 'Hello!' });
const turn = ({ correction = null, next = NEXT } = {}) =>
  JSON.stringify({ de: 'Gern!', ipa: '[ɡɛʁn]', en: 'Sure!', correction, next });

const lastCall = () => callClaude.mock.calls.at(-1);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Every mount opens a scene; the first call is always the opener.
async function renderChat(ui = <ChatTab />) {
  const view = render(ui);
  await screen.findByText(OPENER_DE);
  return view;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  callClaude.mockResolvedValueOnce(opener()).mockResolvedValue(reply);
});
```

Keep `expectNoAutoSpeech`, `typeInstead`, `sendHallo`, `chatLayoutGrid` as they are. Port every existing test, with these mechanical changes:
- `render(...)` → `await renderChat(...)`.
- `callClaude.mock.calls[0]` → `lastCall()` (the opener is now call 0).
- Any test that mounts a second time (the vocab test after `callClaude.mockClear()`, the speech remount test after `vi.clearAllMocks()`) queues another opener first: `callClaude.mockResolvedValueOnce(opener());`.
- Speech: "mounts" tests assert on `OPENER_DE`; "picks a different scenario" waits `await waitFor(() => expect(callClaude).toHaveBeenCalledTimes(2))`; the play test expects `speak` called with `OPENER_DE`.
- Disclosure tests use the opener (`'Good day! What can I get you?'` hidden); the scenario-switch collapse test waits `await screen.findByText('Hallo!')` after picking Order Coffee.
- Delete the `ChatTab — input modes (mocked scaffolding)` block; it is replaced below.

Add:

```jsx
describe('ChatTab scene opener', () => {
  it('opens with a hidden kickoff turn and shows the AI opener', async () => {
    await renderChat();
    expect(callClaude.mock.calls[0][1]).toBe(chatKickoffMessage());
    expect(callClaude.mock.calls[0][2]).toEqual([]);
    expect(screen.queryByText(chatKickoffMessage())).not.toBeInTheDocument();
  });

  it('casts the AI as the selected scene role', async () => {
    await renderChat();
    await userEvent.click(screen.getByRole('radio', { name: 'Order Coffee scenario' }));
    await waitFor(() => expect(callClaude).toHaveBeenCalledTimes(2));
    const coffee = activePack.content.scenarios.find((s) => s.id === 'coffee');
    expect(lastCall()[0]).toContain(`You are ${coffee.role.brief}`);
    expect(lastCall()[0]).not.toContain('tutor named');
  });

  it('names the scene character while it types', async () => {
    const pending = deferred();
    await renderChat();
    callClaude.mockReturnValueOnce(pending.promise);
    await userEvent.click(screen.getByRole('radio', { name: 'Order Coffee scenario' }));
    expect(await screen.findByText('Barista tippt')).toBeInTheDocument();
    pending.resolve(reply);
    await waitFor(() => expect(screen.queryByText('Barista tippt')).not.toBeInTheDocument());
  });

  it('sends the opener back as history on the next turn', async () => {
    await renderChat();
    await sendHallo();
    expect(lastCall()[2]).toEqual([
      { role: 'user', content: chatKickoffMessage() },
      { role: 'assistant', content: expect.stringContaining(OPENER_DE) },
    ]);
  });

  it('offers Try again when the opener fails, and recovers', async () => {
    callClaude.mockReset();
    callClaude.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(opener());
    render(<ChatTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(OPENER_DE)).toBeInTheDocument();
    expect(screen.queryByText('Entschuldigung, ein Fehler.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('ignores an opener that lands after the learner switched scenario', async () => {
    const stale = deferred();
    callClaude.mockReset();
    callClaude.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(opener());
    render(<ChatTab />);
    await userEvent.click(screen.getByRole('radio', { name: 'Order Coffee scenario' }));
    await screen.findByText(OPENER_DE);
    stale.resolve(JSON.stringify({ de: 'Veraltet!', en: 'Stale' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Veraltet!')).not.toBeInTheDocument();
    expect(screen.getByText(OPENER_DE)).toBeInTheDocument();
  });

  it.each([
    ['a guest on Auto', {}, 'fast'],
    ['a guest whose saved pick exceeds the plan', { preferredModel: 'capable' }, 'fast'],
    ['a signed-in learner on Balanced', { user: { id: 'u1' }, preferredModel: 'balanced' }, 'balanced'],
  ])('uses the register of the model that will answer: %s', async (_, props, profile) => {
    await renderChat(<ChatTab {...props} />);
    expect(callClaude.mock.calls[0][0]).toContain(CHAT_IMPROV[profile]);
  });
});

describe('ChatTab scaffolded composer', () => {
  const bank = () => screen.getByRole('group', { name: 'Word bank' });

  async function sendFirstTile(replies) {
    await userEvent.click(within(bank()).getAllByRole('button')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => expect(screen.getAllByText('Gern!')).toHaveLength(replies));
  }

  async function sendChoice(replies) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Missing word' }), 'Tee');
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => expect(screen.getAllByText('Gern!')).toHaveLength(replies));
  }

  function script(...replies) {
    callClaude.mockReset();
    callClaude.mockResolvedValueOnce(opener(NEXT));
    for (const r of replies) callClaude.mockResolvedValueOnce(r);
  }

  it('starts an A1 learner on word blocks built from the AI suggestion', async () => {
    script(turn());
    setUserLevel('a1');
    await renderChat();
    const tiles = within(bank()).getAllByRole('button').map((b) => b.textContent).sort();
    expect(tiles).toEqual(['Ich', 'Kaffee,', 'Tee', 'Wasser', 'bitte.', 'einen', 'möchte'].sort());
    expect(screen.getByText("Say: I'd like a coffee, please.")).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4 · Build the sentence')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Chat message in German' })).not.toBeInTheDocument();

    await userEvent.click(within(bank()).getByRole('button', { name: 'Ich' }));
    await userEvent.click(within(bank()).getByRole('button', { name: 'möchte' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => expect(callClaude).toHaveBeenCalledTimes(2));
    expect(lastCall()[1]).toBe('Ich möchte');
  });

  it('moves an A1 learner up to the dropdown after two clean turns', async () => {
    script(turn(), turn());
    setUserLevel('a1');
    await renderChat();
    await sendFirstTile(1);
    expect(screen.getByText('Step 1 of 4 · Build the sentence')).toBeInTheDocument();
    await sendFirstTile(2);
    expect(screen.getByRole('combobox', { name: 'Missing word' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nice — next step: Choose the word');
  });

  it('steps an A2 learner down to word blocks after two corrected turns', async () => {
    script(turn({ correction: FIX }), turn({ correction: FIX }));
    setUserLevel('a2');
    await renderChat();
    await sendChoice(1);
    expect(lastCall()[1]).toBe('Ich möchte einen Tee, bitte.');
    await sendChoice(2);
    expect(bank()).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Let's add some help: Build the sentence");
  });

  it('starts a B1 learner on the typed blank', async () => {
    script(turn());
    setUserLevel('b1');
    await renderChat();
    expect(screen.getByText('Step 3 of 4 · Type the word')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Missing word' }), 'Kaffee{Enter}');
    await waitFor(() => expect(callClaude).toHaveBeenCalledTimes(2));
    expect(lastCall()[1]).toBe('Ich möchte einen Kaffee, bitte.');
  });

  it('falls back to free text when the suggestion is unusable', async () => {
    callClaude.mockReset();
    callClaude.mockResolvedValueOnce(opener({ ...NEXT, blank: 'Milch' }));
    setUserLevel('a1');
    await renderChat();
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    expect(screen.queryByText(/^Step /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use word bank' })).not.toBeInTheDocument();
  });

  it('lets the learner leave the scaffold and come back', async () => {
    script();
    setUserLevel('a1');
    await renderChat();
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use word bank' }));
    expect(bank()).toBeInTheDocument();
  });
});
```

Pack and lib test edits in the same step:
- `scenarios.test.js`: delete the `scenario greetings` block; add
  `it('carries no canned opener', () => { for (const s of SCENARIOS) expect(s).not.toHaveProperty('greeting'); });`
- `validate.test.js`: delete the two greeting tests; remove `greeting` from the fixture.
- `chatInputModes.test.js`: delete the `defaultInputMode (mock)` block and its import.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/ChatTab.test.jsx src/packs src/lib/chatInputModes.test.js`
Expected: FAIL — no opener call, greetings still present, `Try again` absent, word bank shows the mock.

- [ ] **Step 3: Implement**

Pack: delete every `greeting` block from `scenarios.js` and reword its header comment ("`role` is who the AI plays; the opener is not stored — the AI writes it in character, see `chatKickoffMessage`"). Delete `CHAT_WORD_BANK_MOCK` from `chatTasks.js` and its import/`chatWordBankMock` entry from `index.js`. Delete the greeting loop from `validate.js`. Delete `defaultInputMode` from `chatInputModes.js`.

`docs/MAINTENANCE_CHECKLIST.md:125` → `| Chat → change scenario | The scene character opens in role (e.g. a barista for Order Coffee), at the classified level; the task resets. |`

`src/components/ChatTab.jsx` — the changed parts:

```jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { COLORS, FONT_BODY, FONT_SIZE, SPACE, RADIUS } from '../lib/theme';
import { callClaude } from '../lib/claude';
import { chatSystemPrompt, chatKickoffMessage } from '../lib/prompts';
import { classifiedLevel } from '../lib/levelGate';
import { getUserLevel } from '../lib/levelPref';
import { buildChatAllowlist, scenariosForLevel } from '../lib/chatVocab';
import { interestPromptHints } from '../lib/interests';
import { sanitizePreferredModel, userTierOf } from '../lib/ai-routing/preference.js';
import { routeAiRequest } from '../lib/ai-routing/router.js';
import { advance, parseScaffold, startingStage } from '../lib/chatInputModes';
import ModelPopover from './ModelPopover';
import Button from './ui/Button';
// …activePack destructure, recordEvent, WelcomeBanner, ScenarioPicker, TaskPanel, MessageList…
import Composer from './chat/Composer';

// The reply as the JSON object the prompt contracts for, fenced or not.
const parseReply = (raw) => JSON.parse(raw.replace(/```json|```/g, '').trim());

const errorReply = (err) => ({
  role: 'assistant',
  de: 'Entschuldigung, ein Fehler.',
  ipa: '[ɛntˈʃʊldɪɡʊŋ aɪ̯n ˈfeːlɐ]',
  en: 'Sorry — ' + err.message,
});

const assistantTurn = (parsed) => ({
  role: 'assistant',
  de: parsed.de,
  ipa: parsed.ipa,
  en: parsed.en,
  next: parsed.next,
});

// What the model sees of a turn. Its own replies go back as the JSON it wrote,
// `next` included, so every example in its context keeps the full contract
// and it does not learn to drop the suggestion.
const toHistory = (m) => ({
  role: m.role,
  content:
    m.role === 'user' ? m.de : JSON.stringify({ de: m.de, ipa: m.ipa, en: m.en, next: m.next }),
});
```

Inside the component: delete `inputMode` state and the greeting effect; add

```jsx
  const [progression, setProgression] = useState(() => ({
    stage: startingStage(chatLevel),
    streak: 0,
    moved: null,
  }));
  const [scaffold, setScaffold] = useState(null);
  const [openerFailed, setOpenerFailed] = useState(false);
  // Bumped whenever a scene (re)opens. A reply that comes back carrying an
  // older value belongs to a scene the learner already left, and is dropped.
  const sceneRef = useRef(0);

  const scene = SCENARIOS.find((s) => s.id === scenario);
  const routingContext = {
    taskType: 'chat',
    userTier: userTierOf(user),
    preferredModel: sanitizePreferredModel(preferredModel),
  };
  // The profile of the model that will actually answer — a saved pick above
  // the plan falls back — so the improv register matches it.
  const { profile } = routeAiRequest(routingContext);
  const callOptions = { routingContext, level: chatLevel, vocab };

  const systemPromptFor = (task) =>
    chatSystemPrompt({
      prompts: activePack.prompts,
      scenarioDesc: scene?.desc || 'open conversation',
      role: scene?.role,
      profile,
      task: task?.task,
      level: chatLevel,
      vocab,
      sparse,
      interestHints,
    });

  // The AI speaks first, in character. The hidden kickoff gives it a user turn
  // to answer and stays in history, so the model always sees its own opener.
  const openScene = async () => {
    const id = ++sceneRef.current;
    const kickoff = { role: 'user', de: chatKickoffMessage(), hidden: true };
    setMessages([kickoff]);
    setScaffold(null);
    setProgression({ stage: startingStage(chatLevel), streak: 0, moved: null });
    setOpenerFailed(false);
    setThinking(true);
    try {
      // tasks[0]: a scene opens on its first task. taskIdx can still hold the
      // previous scenario's index until the reset effect's update lands.
      const raw = await callClaude(systemPromptFor(tasks[0]), kickoff.de, [], callOptions);
      if (id !== sceneRef.current) return;
      const parsed = parseReply(raw);
      setMessages([kickoff, assistantTurn(parsed)]);
      setScaffold(parseScaffold(parsed.next));
    } catch (err) {
      if (id !== sceneRef.current) return;
      setMessages([kickoff, errorReply(err)]);
      setOpenerFailed(true);
    } finally {
      if (id === sceneRef.current) setThinking(false);
    }
  };

  useEffect(() => {
    openScene();
    // Only a new scene (scenario or level) re-opens. Vocab, model and task
    // changes apply from the next turn; re-opening would wipe the thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, chatLevel]);
```

`sendMessage` becomes:

```jsx
  const sendMessage = async (overrideText) => {
    const text = overrideText ?? input;
    if (!text.trim() || thinking) return;
    const id = sceneRef.current;
    const history = messages.map(toHistory);
    setMessages((m) => [...m, { role: 'user', de: text }]);
    setInput('');
    setOpenerFailed(false);
    setThinking(true);

    try {
      const raw = await callClaude(systemPromptFor(currentTask), text, history, callOptions);
      if (id !== sceneRef.current) return;
      const parsed = parseReply(raw);
      setMessages((m) => {
        const thread = [...m];
        for (let i = thread.length - 1; i >= 0; i--) {
          if (thread[i].role === 'user') {
            thread[i] = { ...thread[i], graded: true, correction: parsed.correction || null };
            break;
          }
        }
        thread.push(assistantTurn(parsed));
        return thread;
      });
      setScaffold(parseScaffold(parsed.next));
      setProgression((p) => advance(p, Boolean(parsed.correction)));
      recordEvent('chat', chatLevel, parsed.correction ? 'wrong' : 'correct');
      if (parsed.taskComplete) {
        const nextIdx = (taskIdx + 1) % Math.max(tasks.length, 1);
        if (nextIdx === 0) setTasksCompleted(true);
        setTaskIdx(nextIdx);
        setHintVisible(false);
      }
    } catch (err) {
      if (id !== sceneRef.current) return;
      setMessages((m) => [...m, errorReply(err)]);
    } finally {
      if (id === sceneRef.current) setThinking(false);
    }
  };
```

JSX: `MessageList` gets `speaker={scene?.role?.name}`; the `inputMode` ternary is replaced by

```jsx
          {openerFailed && !thinking && (
            <div style={{ padding: `0 ${SPACE[4]}px ${SPACE[3]}px`, background: COLORS.surface }}>
              <Button variant="secondary" size="sm" onClick={openScene}>
                Try again
              </Button>
            </div>
          )}
          <Composer
            stage={progression.stage}
            moved={progression.moved}
            scaffold={scaffold}
            turnKey={messages.length}
            thinking={thinking}
            onSend={sendMessage}
            onChooseStage={(stage) => setProgression({ stage, streak: 0, moved: null })}
            freeText={{
              input,
              setInput,
              listening,
              onStartListening: startListening,
              onStopListening: stopListening,
            }}
          />
```

Remove the now-unused `WordBank`, `ChatInput`, `INPUT_MODES`, `defaultInputMode` imports.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/ChatTab.test.jsx src/components/chat src/packs src/lib && grep -rn "greeting\b\|chatWordBankMock\|defaultInputMode\|FILL_IN_THE_BLANK" src/packs/de/scenarios.js src/packs/validate.js src/components src/lib | grep -v test`
Expected: PASS; grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatTab.jsx src/components/ChatTab.test.jsx src/packs/de/scenarios.js src/packs/de/scenarios.test.js src/packs/de/index.js src/packs/de/chatTasks.js src/packs/validate.js src/packs/validate.test.js src/lib/chatInputModes.js src/lib/chatInputModes.test.js docs/MAINTENANCE_CHECKLIST.md
git commit -m "feat(chat): AI-opened scenes with adaptive scaffolded input; drop canned greetings"
```

---

### Task 8: Verify and open the PR

- [ ] **Step 1:** `npm run lint && npm run format:check && npm test` — all pass, no new lint warnings in touched files.
- [ ] **Step 2: Browser check** (`npm run dev` has no `/api`): in the preview, stub `window.fetch` for `/api/v1/ai/chat` with scripted JSON replies (opener with `next`, then clean turns), reload, and confirm at **375px and 320px**: scene opener, word blocks → dropdown after two clean turns, typed blank, "Type instead" / "Use word bank", no horizontal overflow (`scrollWidth - clientWidth === 0`). With the stub removed, the opener shows the error bubble and **Try again**. Screenshot each stage.
- [ ] **Step 3:** Update the spec's **Status** to `implemented`, push `feat/chat-scene-engine`, open a PR against `main` whose body lists the premise corrections, the owner decisions, the new JSON `next` field, and the browser evidence.
