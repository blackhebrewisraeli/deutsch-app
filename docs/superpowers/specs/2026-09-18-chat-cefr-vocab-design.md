# Chat adapted to classified CEFR + learned vocabulary (Phase 3)

**Status:** implemented
**Date:** 2026-09-18
**Depends on:**
[Phase 1 placement classification](./2026-09-18-placement-classification-design.md),
[Phase 2 practice level gating](./2026-09-18-practice-level-gating-design.md)

Phase 1 writes a CEFR code through `setUserLevel` / `deutsch-level`. Phase 2
makes that code the source of truth for **which kinds of practice may run**.
Phase 3 applies the same source of truth to **Chat**: tutor pedagogy, scenario
tasks, and the vocabulary the model is allowed to use.

Interest-topic packs (Phase 4) and a multi-model provider wrapper / user model
picker (Phase 5) stay later. `src/lib/ai-routing/` is left alone.

## Contract

### Source of truth

Chat reads the classified CEFR code (`getUserLevel()` / `deutsch-level`) via
`classifiedLevel()` in `src/lib/levelGate.js`. It does not offer a parallel
A1/A2/B1 picker. A `level="b1"` prop on an A1 learner still mounts A1 pedagogy
and A1 tasks.

Changing classification for a learner remains **Retake placement** (Settings
and StatusChip) or the collapsed **Advanced — override classification**
disclosure from Phase 2. After that, Chat follows the new code.

### Pedagogy and tasks

`chatSystemPrompt` still injects `prompts.levels[level]` (pack-owned CEFR
pedagogy). The `level` argument is the classified code, never a free choice.

Tasks stay `content.chatTasks[scenario][classifiedLevel]`. An A1 learner sees
A1 tasks only — not the B1 “discuss whether big cities are better” prompt
sitting behind the same scenario. Scenarios with no tasks at the classified
band are hidden. The four German scenarios all have A1/A2/B1 lists today, so
nothing is hidden; the filter is the future-proof.

The scenario list is **labelled** with the classified code (`Scenario · A1`)
so the band is visible and there is no control that looks like a difficulty
switcher.

### Learned-vocab allowlist

Chat builds a stable list of target-language terms the learner already knows
and puts it in the system prompt.

1. **Union** card ids from `learnedByDeck` and legacy `learnedWords`
   (`learnedIdsOf` in `src/lib/learnedWords.js`).
2. **Resolve** each id to a surface form. The engine never reads `card.de`
   (AGENTS.md language-blind rule). The Chat tab passes `termOf: (card) => card.de`,
   which is the recorded pack-field exception already used by chat rendering
   and vocab. An id with no matching pack card is used as-is — custom-deck
   keys and the German pack’s `cardId = card => card.de` both work.
3. **Sparse fallback.** If the union has fewer than `SPARSE_THRESHOLD` (8)
   terms, mix in a small starter set from pack curated decks
   (`starterTermsFromDecks`, first `STARTER_LIMIT` = 12 unique terms in deck
   order). New learners get greetings-scale words, not a hard failure and not
   the entire `cefr-a1` auto deck.
4. **Cap and sort.** Unique, case-insensitive; `localeCompare` for a
   deterministic prompt; at most `MAX_ALLOWLIST` (80) terms.

Empty maps + empty catalog → empty allowlist. The prompt still sends: the
engine emits a “new learner, stay simple” constraint instead of throwing.

### Prompt split (engine vs pack)

Unchanged from Phase 1.3: pack owns persona, target language, and
`prompts.levels` pedagogy. Engine owns the JSON contract and framing prose.

Phase 3 adds engine-owned **vocab constraint** copy in `src/lib/prompts.js`
(`chatVocabConstraint`, `chatServerConstraint`). It names no language and no
German examples. Function words are described generically (articles, pronouns,
auxiliaries) so a second pack would not inherit “sein/haben”.

### Client request

`callClaude` for `endpoint: 'chat'` posts the composed system prompt **and**
the classified `level` plus the sanitized `vocab` array. Grade and deck
routes do not send those fields. The Anthropic key stays server-side.

### Server validation

`POST /api/v1/ai/chat` (and the legacy `/api/chat` alias) runs the shared
`validateAiBody` chain, then `applyChatConstraints`:

| Field | Bad type | Junk value | Forwarded to Anthropic? |
| ----- | -------- | ---------- | ----------------------- |
| `level` | 400 | clamp to `a1` | no — folded into a system-prompt appendix |
| `vocab` | 400 | drop non-strings, trim, cap length/count, dedupe | no — same appendix |

Missing extras are fine (older clients). Empty vocab after sanitize is omitted
from the appendix; a valid `level` still pins the CEFR band. Grade and deck
handlers do not run this hook, so a leaked `vocab` on those routes is still
stripped as an unknown field.

The appendix is language-blind. It repeats the classified band and the
allowlist the server actually accepted, so a client that composes a B1
pedagogy string while sending `level: "a1"` still gets an authoritative
“do not raise complexity above a1” instruction.

### Out of scope

- Interest-topic vocabulary packs (Phase 4)
- Multi-model provider wrapper / user model picker (Phase 5)
- Placement scoring and Translate gating from Phase 2
- Supabase migrations / production MCP writes
- Renaming `deutsch-level` or `card.de`
