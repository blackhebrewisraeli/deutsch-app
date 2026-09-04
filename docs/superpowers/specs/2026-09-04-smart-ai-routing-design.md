# Smart AI routing — pick a model from task context, nothing else

- **Date:** 2026-09-04
- **Status:** drafted at owner request and implemented on `feat/smart-ai-routing`.
  Architecture ownership stays with Claude Code per `AGENTS.md`; this file is the
  tracked home of the decision.
- **Umbrella:** Lane 1 of `2026-06-10-backend-architecture-design.md` (the
  versioned `/api/v1/ai/*` service). This spec does not reopen that lane, the
  three-endpoint split, or the allow-list in `api/_lib/validate.js`.
- **Out of scope for this change:** wiring `callClaude`, expanding
  `ALLOWED_MODELS`, rate limits, billing, UI, storage, or any network call.

---

## 1 · What this is

A **pure** function that, given a request context, returns the model
configuration the AI lane *would* use. Capability, speed, and cost are scored in
one catalog; the router is a deterministic pick over that catalog. No fetch, no
`localStorage`, no React, no Anthropic client.

Today every client call hardcodes `claude-haiku-4-5-20251001` in
`src/lib/claude.js`, and the server allow-list is that same single model. That
is the right default for a cheap, latency-sensitive PWA, and it stays the
default after this lands. The router exists so the *next* change — actually
sending a different model — has a decision to call, rather than a new
`if (endpoint === 'chat')` in the client.

**This spec is the decision engine only.** `callClaude` and `validateAiBody`
keep their current contract until a follow-up expands the allow-list and
threads `routeAiRequest` into the request body.

---

## 2 · Ground truth (verified 2026-09-04 against the repo)

1. **Three AI tasks already exist**, split for quotas rather than for models:
   `POST /api/v1/ai/chat` (Anna), `grade` (answer grading *and* sentence
   generation), `deck` (custom decks). See `docs/api/ai.md`.
2. **One model is allowed.** `ALLOWED_MODELS` is
   `['claude-haiku-4-5-20251001']`. A router that returned Opus today would
   400 at the edge. That is why this module does not call the API.
3. **There is no Pro plan.** Auth is anonymous-first (`guest`) vs signed-in
   (`free`). `userTier: 'pro'` is a reserved ceiling for a future paid tier;
   the router must already know what it would do, or the first Pro user ships
   without a cost cap.
4. **`src/lib/*` is language-blind.** Task names are capability labels
   (`translation_check`, `grammar_generation`), not German-specific branches.

---

## 3 · Module structure

```
src/lib/ai-routing/
  catalog.js       policy data: models, tasks, tiers, the complexity bump
  router.js        routeAiRequest(context) → { model, maxTokens, profile }
  catalog.test.js  the catalog cannot silently invert cost vs capability
  router.test.js   table-driven scenarios over the public function
```

`catalog.js` is the one file a reviewer tunes. `router.js` has no model ids of
its own — it only ranks what the catalog lists. Tests import `routeAiRequest`
from `router.js` and model ids from `catalog.js`, so renaming a pin is one
catalog edit.

No barrel `index.js`. Callers import the function they want, same as
`src/lib/sync/`.

---

## 4 · Context in, config out

```js
routeAiRequest({
  taskType,          // required: one of TASKS
  userTier,          // optional: 'guest' | 'free' | 'pro'; default 'guest'
  complexityScore,   // optional: 0–1; default 0; clamped
  expectedLatency,   // optional: ms budget; default = the task's own budget
})
→ {
  model,       // catalog id string
  maxTokens,   // from the task, not the model
  profile,     // 'fast' | 'balanced' | 'capable' — the chosen model's band
}
```

Unknown `taskType` or a missing context object is a programmer error and
throws `TypeError`. Unknown `userTier` degrades to `guest` (fail cheap).
Non-finite / out-of-range numbers are clamped or ignored, never `NaN`.

---

## 5 · Catalog

### Models

Three bands. Haiku's id is the production pin already in `claude.js`. Sonnet
and Opus are family ids, not dated pins — they are not on the allow-list yet,
and inventing a date here would pretend they are.

| Key | `id` | capability | cost | latencyMs | profile |
|---|---|---|---|---|---|
| haiku | `claude-haiku-4-5-20251001` | 1 | 1 | 400 | fast |
| sonnet | `claude-sonnet-4-5` | 2 | 2 | 1200 | balanced |
| opus | `claude-opus-4-1` | 3 | 3 | 2800 | capable |

Latency figures are **relative ranks**, not SLAs. They only exist so a budget
can exclude a slower band when a faster eligible band exists.

### Tasks

Named for the job, not the HTTP path. `grade` today mixes a cheap check with
sentence generation; the router splits them so the follow-up can pick
per-call rather than per-endpoint.

| `taskType` | minCapability | defaultLatencyMs | maxTokens | Today's caller |
|---|---|---|---|---|
| `translation_check` | 1 | 800 | 512 | `TypingExercise` via `grade` |
| `chat` | 2 | 2500 | 1000 | `ChatTab` via `chat` |
| `grammar_generation` | 2 | 4000 | 1024 | `generateSentences` via `grade` |
| `deck_generation` | 2 | 8000 | 1024 | `VocabTab` via `deck` |

### Tiers

The tier is a **ceiling**, not a floor. Guest cannot spend past Haiku. Free
cannot spend past Sonnet. Pro may use Opus. Simple work still picks the
cheapest model that meets the task floor — a Pro translation check is still
Haiku.

| `userTier` | maxCost |
|---|---|
| `guest` (default) | 1 |
| `free` | 2 |
| `pro` | 3 |

### Complexity bump

`complexityScore >= 0.7` raises the required capability by 1, capped at 3.
That is how a Pro chat becomes Opus, and how a Free translation check becomes
Sonnet, without a second if-ladder. Guest still cannot follow the bump past
Haiku — the ceiling always wins.

---

## 6 · Pick rule (the whole algorithm)

1. Required capability = task floor, plus one if complexity is at the bump,
   capped at 3.
2. Eligible = models whose `cost` is within the tier ceiling.
3. Capable = eligible models whose `capability` meets the requirement.
4. **If capable is non-empty:** among those that fit the latency budget (or
   the whole capable set if none do), pick the **cheapest**, then most
   capable, then fastest. Latency never upgrades, and never drops below the
   floor when a capable model exists.
5. **If capable is empty:** the ceiling won — we still return a model rather
   than throwing or billing past the tier. Pick the **most capable** eligible
   model (then fastest). A Free chat that asked for Opus therefore stays on
   Sonnet; it does not collapse to Haiku. A Guest chat, whose ceiling *is*
   Haiku, stays on Haiku.

Consequences, which the tests pin:

- A large latency budget does not upgrade Haiku to Sonnet.
- A tight budget does not downgrade Chat from Sonnet to Haiku when Sonnet is
  allowed.
- Guest + high complexity stays Haiku.
- Free never receives Opus.
- Pro + simple `translation_check` stays Haiku.

---

## 7 · Explicitly not in this change

- Expanding `ALLOWED_MODELS` or changing `callClaude`'s hardcoded model.
- A `temperature` field (the v1 body does not send one).
- Reading auth / trial / XP to infer `userTier` — the caller passes it.
- German-specific branches, new storage keys, UI chrome, or docs in
  `docs/api/ai.md` (that page describes the live contract, which is unchanged).
