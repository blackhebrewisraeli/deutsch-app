# Chat scene engine — scene personas, level-scaled prompts, scaffolded input

**Status:** implemented (`feat/chat-scene-engine`)
**Date:** 2026-09-24
**Branch:** `feat/chat-scene-engine`
**Builds on:**
[Chat CEFR + learned vocab](./2026-09-18-chat-cefr-vocab-design.md),
[Chat UX redesign](./2026-09-18-chat-ux-redesign.md),
[Multi-model wrapper](./2026-09-18-multi-model-wrapper-design.md),
and the word-bank scaffolding mock from #332.

## 1 · Why

The owner brief asked for (1) scenario-driven AI personas and prompts instead of
static introductions, scaled to CEFR level and to the chosen model, and (2) a
structured input progression so lower levels do not start on free text.

What the code actually does today (checked, not assumed):

| Brief claim | Reality |
| --- | --- |
| Static intro regardless of scenario | Each scenario **has** its own opener (`scenarios.js`), e.g. Coffee opens *"Willkommen im Café! Was möchten Sie bestellen?"*. "Ich bin Anna" is only the Meet Someone line. The real defects: openers are canned and identical at A1 and B1; `chatSystemPrompt` always casts the AI as *"a friendly German tutor named Anna"*, so in Coffee a tutor is visiting a café rather than a barista serving you; and `ChatTab` sends `messages.slice(1)` as history, so the model never sees its own opener and drifts off-scene. |
| AI asks about a recent trip | That is the B1 **Free Chat** task verbatim (*"Tell Anna about an interesting place you visited recently"*). Either the learner was in Free Chat, or the drift above. |
| UI lacks structured steps | `INPUT_MODES` exists with `WORD_BANK` / `FILL_IN_THE_BLANK` / `FREE_TEXT`, but only the word bank has UI, and its words are a **mock**: one fixed coffee sentence shown in every scenario, including Airport. |

## 2 · Decisions (owner, 2026-09-24)

| Question | Decision |
| --- | --- |
| How does a learner move between stages? | **Adaptive**, reset per conversation. Start stage from CEFR; +1 stage after 2 clean turns in a row, −1 after 2 corrected turns in a row. Manual hatches stay. |
| Who is the AI in a scene? | **Scene character + Anna coach.** The AI plays the scene role in the German line; corrections are an out-of-character coach layer that keeps the "Anna corrects as you go" brand. |
| What does "leverage the chosen model" mean? | **Per-model improv register**, keyed on the model actually routed (not the saved pick). No temperature, no API-lane change. |
| Opener fails (offline, quota, no backend)? | **Error bubble + Retry.** Static greetings are deleted outright; no canned fallback. |
| Where does per-turn scaffold content come from? | **Piggyback `next`** on every AI reply (one call per turn). Rejected: a separate scaffold call (2× latency/quota), pack-authored scaffolds (scripted, blind to what the character said). |

## 3 · Prompt engine and the AI turn contract

### Pack schema — scenario roles replace greetings

`src/packs/de/scenarios.js`: drop `greeting`, add `role`:

```js
{
  id: 'coffee',
  name: 'Order Coffee',
  icon: '☕',
  desc: 'at a Berlin café',
  role: {
    name: 'Barista',
    brief: 'a friendly barista at a busy Berlin café. You greet customers and take their order.',
  },
}
```

Free Chat and Meet Someone use `role.name: 'Anna'`; Airport uses a check-in
agent. `src/packs/validate.js` requires `role.name` and `role.brief` as
non-empty strings where it required `greeting` today.

`role.name` replaces `prompts.persona` in the two places that name **who is
speaking**: the typing indicator (`MessageList`, "Barista tippt") and the tutor
bubble label (`MessageBubble`, "— BARISTA") plus its play-button label.
`prompts.persona` keeps naming **the coach**: the "Anna corrects as you go"
helper line and the WelcomeBanner.

### `chatSystemPrompt` composition

`src/lib/prompts.js`, still the only place in `src/` that holds prompt text.
New arguments: `role` (the scenario's `{ name, brief }`) and `profile`
(`'fast' | 'balanced' | 'capable'`). `scenarioDesc` is kept for the scene line.

1. **Character.** "You are {role.brief} This is a {targetLanguage} conversation
   practice scene: {scenarioDesc}. Stay in character in the `de` line. Open and
   carry the scene the way this character really would."
2. **Coach layer.** "Separately, you are {persona}, the learner's coach. Coach
   feedback goes only in `correction` — never break character in `de`."
3. **Level spec.** Pack `prompts.levels[level]` (fallback a1), rewritten with
   concrete limits. Target wording:
   - a1 — reply in ONE short sentence (about 8 words max), present tense,
     the most common everyday words. The suggested learner line is 6 words max.
   - a2 — 1–2 sentences, about 12 words each; present and Perfekt; simple
     connectors (und, aber, weil). Suggested learner line 10 words max.
   - b1 — 2–3 natural sentences; any common tense, subordinate clauses fine;
     idiomatic but not rare vocabulary. Suggested learner line 15 words max.
4. **Improv register.** Engine-owned, language-blind, keyed on the routed
   profile; unknown profile → balanced:
   - fast — keep replies short and focused on the task; one idea per turn.
   - balanced — react to specifics the learner said; add small realistic
     touches to the scene.
   - capable — let the scene develop naturally (an item is sold out, a
     follow-up question, a small complication) and remember details the
     learner mentioned earlier.
5. **Task, vocab, interests.** Unchanged blocks (`taskLine`,
   `chatVocabConstraint`, `chatInterestBias`), plus: "Respond to what the
   learner actually said. Never use stock phrases or a script."
6. **JSON contract** — today's fields plus `next`:

```json
{
  "de": "...", "ipa": "...", "en": "...",
  "correction": null,
  "taskComplete": false,
  "next": {
    "de": "a short, natural line the learner could say next at their level, moving toward the task",
    "en": "its English meaning",
    "blank": "exactly one word copied from next.de that is worth practising (not a name)",
    "distractors": ["two plausible wrong alternatives for blank, same word class"]
  }
}
```

The JSON key names stay `de`/`ipa`/`en` — the recorded AGENTS.md exception.

### Opener — a hidden kickoff turn

`chatKickoffMessage()` (in `prompts.js`) returns an out-of-character user
message, roughly *"[The learner has just arrived. Open the scene in character
with your first line.]"*. The Messages API needs a user turn first, and this
gives the model one without inventing learner speech.

The kickoff is stored in the thread as `{ role: 'user', de: kickoff, hidden: true }`.
`MessageList` never renders hidden messages. History sent on every later turn
is **all** messages — kickoff, opener, then the real exchange — so the model
always sees its own opener. This retires `messages.slice(1)`.

The profile comes from `routeAiRequest(routingContext).profile` in `ChatTab`
(the router already returns it; `callClaude` computes the same route again,
deterministically).

**Unchanged:** `api/_lib/chatConstraint.js`, `api/_lib/validate.js`, routing,
quotas, and storage keys. The opener is an ordinary chat call — one per scene
open against the existing 20-per-5-min chat quota.

## 4 · Stage state machine

Pure functions in `src/lib/chatInputModes.js` (extended in place; no new lib file).

```js
export const STAGES = Object.freeze(['word_bank', 'choice_blank', 'typed_blank', 'free_text']);
```

`INPUT_MODES` gains `CHOICE_BLANK` / `TYPED_BLANK` in place of the placeholder
`FILL_IN_THE_BLANK`.

- `startingStage(level)` — a1 → `word_bank`, a2 → `choice_blank`,
  b1 → `typed_blank`, unknown → `word_bank`. (Replaces `defaultInputMode`.)
- `advance({ stage, streak }, corrected)` → `{ stage, streak, moved }`
  where `moved` is `'up' | 'down' | null`:
  - clean turn: `streak = max(streak, 0) + 1`; at `+2` → stage up, `streak = 0`.
  - corrected turn: `streak = min(streak, 0) − 1`; at `−2` → stage down, `streak = 0`.
  - clamped at both ends (a clamped move reports `moved: null`, streak resets).
  - only graded replies count; failed calls never reach `advance`.
- `parseScaffold(next)` → `null` or
  `{ en, tokens, blankIndex, answer, distractors }`:
  - `tokens` = `next.de` split on whitespace.
  - `blankIndex` = first token whose core (leading/trailing Unicode
    punctuation `\p{P}` trimmed) equals `next.blank`, case-insensitively.
    The gap keeps the token's punctuation: `Kaffee,` → gap + `,`.
  - `answer` = the blank token's core in the sentence's casing; `distractors`
    trimmed and de-duplicated. The dropdown offers `answer` + `distractors`.
- `gapParts(scaffold)` → `{ before, after }`: the sentence either side of the
  gap, so a composer renders `before [gap] after` and sends
  `before + word + after`.
  - `null` when: `next` not an object, `de`/`blank` not non-empty strings,
    blank not found, distractors not an array of non-empty strings, fewer
    than 1 distractor, or a distractor equal to the blank (case-insensitive).
  - Language-blind: whitespace + Unicode punctuation only.

## 5 · Composer UI

New `src/components/chat/Composer.jsx` picks the input by stage; every stage
reads the scaffold from the **latest** AI reply.

| Stage | UI |
| --- | --- |
| `word_bank` | Prompt line *"Say: {en}"*. `WordBank` tiles = tokens + distractors, shuffled; keyed per turn so it resets. The pack mock `CHAT_WORD_BANK_MOCK` is deleted. |
| `choice_blank` | New `FillBlank` `mode="choice"`: the sentence with a native `<select>` in the gap (options shuffled), plus the *"Say:"* line. |
| `typed_blank` | `FillBlank` `mode="typed"`: the same sentence with an `<input>` in the gap. |
| `free_text` | Existing `ChatInput`, unchanged behaviour. |

- **No valid scaffold** (null, or the opener failed): render `free_text` for
  that turn; the stage itself is unchanged.
- **Manual hatches:** "Type instead" (every scaffolded stage) → `free_text`;
  `ChatInput`'s existing "Use word bank" button → `word_bank` (most help,
  matching its label), shown only when a valid scaffold exists. Adaptive
  stepping continues from wherever the learner lands; the streak resets.
- **Visible progression:** a mono label above the composer,
  *"Step 2 of 4 · Choose the word"*. Stage labels: Build the sentence /
  Choose the word / Type the word / Free writing. A stage change is announced
  via an `aria-live="polite"` note: up → "Nice — next step: {label}";
  down → "Let's add some help: {label}".
- **Grading stays with the AI.** The assembled sentence is sent as a normal
  turn; "clean" = the reply had no `correction`. No local exact-match check —
  German allows valid alternative word orders the AI accepts.
- **Accessibility:** the `<select>` and `<input>` carry an accessible name
  ("Missing word"); the sentence is readable as text around the gap; send is
  disabled until the gap is filled; existing WordBank a11y is kept.

## 6 · Data flow and error handling

`ChatTab` orchestrates:

1. **Scene opens** (mount; scenario or level change): reset the thread to
   `[hidden kickoff]`, `progression = { stage: startingStage(level), streak: 0 }`,
   `scaffold = null`, then `callClaude(system, kickoff, [])`. A request-id ref
   makes a superseded response (the learner switched scenario mid-flight) a
   no-op.
2. **Learner sends:** history = every message (kickoff and opener included).
3. **Reply:** attach `correction` to the graded user turn (as today); push the
   reply; `scaffold = parseScaffold(parsed.next)`;
   `progression = advance(progression, !!parsed.correction)`; `recordEvent`
   unchanged; `taskComplete` handling unchanged.
4. **Opener fails** (network, quota, JSON parse): the existing in-thread error
   bubble plus a **Retry** button that re-runs step 1's call. Composer is free
   text (no scaffold).
5. **Turn fails:** existing error bubble; scaffold and stage stay, so the
   learner can resend.

## 7 · Testing

TDD; stage the red so each test fails for its own reason.

- `src/lib/chatInputModes.test.js` — `startingStage` per level + unknown;
  `advance` up at +2, down at −2, direction flip resets streak, clamp at both
  ends; `parseScaffold` happy path, trailing punctuation, case, blank absent,
  distractor equals blank, junk inputs → null.
- `src/lib/prompts.test.js` — role brief present; old "tutor named" framing
  absent; level spec present with a1 fallback; register differs per profile,
  unknown → balanced; `next` in the contract; `chatKickoffMessage` non-empty.
- `src/packs/validate.test.js`, `src/packs/de/scenarios.test.js` — `role`
  required; `greeting` gone.
- `src/components/chat/FillBlank.test.jsx` — choice and typed modes compose
  the full sentence (punctuation kept); send disabled until filled; hatch.
- `src/components/chat/WordBank.test.jsx` — distractor tiles render.
- `src/components/chat/Composer.test.jsx` — stage → component; null scaffold → free text.
- `src/components/ChatTab.test.jsx` — rewritten around the opener: opener
  fires with the kickoff and the kickoff is never rendered; A1 renders the
  AI's tiles, not a mock; 2 clean turns advance a stage; 2 corrected turns
  step down; malformed `next` → free text; failed opener → Retry recovers;
  superseded opener is ignored (assert a late resolution, not a console
  warning); history includes the opener; the role name shows in the typing
  indicator.

## 8 · Files

| File | Change |
| --- | --- |
| `src/lib/prompts.js` (+test) | Role/coach/level/register/`next` composition; `chatKickoffMessage`. |
| `src/lib/chatInputModes.js` (+test) | `STAGES`, `startingStage`, `advance`, `parseScaffold`. |
| `src/components/ChatTab.jsx` (+test) | Opener lifecycle, progression + scaffold state, full history, Retry. |
| `src/components/chat/Composer.jsx` (+test) | **New** — stage switch, step label, live note. |
| `src/components/chat/FillBlank.jsx` (+test) | **New** — choice/typed gap. |
| `src/components/chat/ScaffoldActions.jsx` | **New** — the "Type instead" + send row WordBank and FillBlank share (keeps Sonar's duplication gate quiet). |
| `src/components/chat/WordBank.jsx` | Unchanged API (`words`); Composer feeds it tokens + distractors; footer moves to `ScaffoldActions`. |
| `src/components/chat/MessageList.jsx`, `MessageBubble.jsx` (+tests) | Skip hidden messages; speaker = role name. |
| `src/packs/de/scenarios.js` (+test) | `greeting` → `role`. |
| `src/packs/de/index.js` | Level specs with concrete limits. |
| `src/packs/de/chatTasks.js` | Delete `CHAT_WORD_BANK_MOCK` (and its pack export). |
| `src/packs/validate.js` (+test) | Require `role`. |

Untouched: `/api/**`, storage keys, routing catalog, quotas, `App.jsx`.

## 9 · Out of scope

Persisting the reached stage across sessions; a separate conversation per
scenario; sampling temperature; local (non-AI) answer checking; the
`ChatExercise` stub.
