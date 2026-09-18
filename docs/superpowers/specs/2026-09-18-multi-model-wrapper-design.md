# Multi-model AI wrapper with learner-facing choice (Phase 5)

**Status:** implemented
**Date:** 2026-09-18
**Depends on:**
[Smart AI routing](./2026-09-04-smart-ai-routing-design.md),
[Phase 3 chat CEFR + learned vocab](./2026-09-18-chat-cefr-vocab-design.md),
[Phase 4 interest topics](./2026-09-18-interest-topics-design.md)

Phases 1–4 made classified CEFR the source of truth for placement, practice,
and Chat, then added opt-in topical vocabulary. Phase 5 makes the app a
**wrapper over AI models**: the learner can pick which band Chat uses, while
secrets stay server-side and Phase 3 constraints (CEFR + learned vocab +
interest bias) stay in the prompt.

The existing router in `src/lib/ai-routing/` remains the default when the
preference is unset. A thin provider adapter sits in front of Anthropic so a
second vendor can plug in later without rewriting Chat.

## Contract

### Source of truth

The learner's pick lives as an additive field on the existing
`deutsch-app-state-v1` blob:

```js
preferredModel: 'auto' // 'auto' | 'fast' | 'balanced' | 'capable'
```

The storage key is not renamed. An older client that does not name the field
is treated as `'auto'` (today's router). Ids are **profiles**, not vendor pins
— Fast/Balanced/Capable can map to a different provider's cheap/mid/strong
model later without a migration.

`sanitizePreferredModel` drops unknown / non-string values to `'auto'`.

### Picker options (MVP)

| id         | UI label  | Detail  | Catalog model (Anthropic today)   |
| ---------- | --------- | ------- | --------------------------------- |
| `auto`     | Auto      | Router  | `routeAiRequest` (unchanged)      |
| `fast`     | Fast      | Haiku   | `claude-haiku-4-5-20251001`       |
| `balanced` | Balanced  | Sonnet  | `claude-sonnet-4-5`               |
| `capable`  | Capable   | Opus    | `claude-opus-4-1`                 |

Human labels live in `src/lib/ai-routing/preference.js` (engine chrome, not
German pack content). Settings uses the German section title **KI-Modell**,
matching Interessen; Chat uses **Modell**.

### Routing override

`routeAiRequest` gains an optional `preferredModel`. Algorithm:

1. Compute the auto pick exactly as Phase-routing already does (task floor,
   complexity bump, tier ceiling, latency).
2. If `preferredModel` is missing, junk, or `'auto'`, return that pick.
3. If the preferred profile maps to a catalog model whose `cost` is within the
   tier ceiling, return that model (same `maxTokens` as the task). The learner
   may go **cheaper** than auto — Fast on a signed-in chat is Haiku, not
   Sonnet.
4. If the preferred model exceeds the ceiling, **fall back to step 1**. A guest
   who saved Balanced still stores Balanced; Chat keeps using Haiku until the
   tier allows it.

Tier mapping is unchanged: no user → `guest` (Haiku ceiling); signed-in →
`free` (Sonnet ceiling); `pro` stays reserved. Chat previously hardcoded
`userTier: 'guest'` even for accounts; it now calls `userTierOf(user)` so a
signed-in Balanced pick can actually land on Sonnet. Grade and deck callers
are unchanged (still auto / guest) — preference is Chat-scoped in this MVP.

`callClaude` does not read storage. Chat passes `preferredModel` on
`routingContext`. The wire body still sends a **catalog model id**; the
preference id never leaves the client. `api/_lib/validate.js` already
allow-lists every catalog id.

### Provider adapter

Every catalog row names `provider: 'anthropic'`.

```
src/lib/ai-routing/providers.js   providerForModelId(id) → 'anthropic'
api/_lib/forward.js               ADAPTERS.anthropic → forwardToAnthropic
api/_lib/anthropic.js             unchanged Messages call
```

`createAiHandler` asks `isAnyProviderConfigured()` (today: `ANTHROPIC_API_KEY`)
and dispatches through `forwardToProvider`. Rate limits, origin checks, and
the validate allow-list are unchanged. The browser never sees a vendor key.

**How a second provider would plug in** (not live; no OpenAI/Google key
required to ship):

1. Add catalog rows with `provider: 'openai'` (or `'google'`) and unique ids.
2. Implement `forwardToOpenAI(safeBody, apiKey)` beside `forwardToAnthropic`.
3. Register it on `ADAPTERS` in `api/_lib/forward.js` with `envKey:
   'OPENAI_API_KEY'`.
4. Set that key in Vercel (never a `VITE_` prefix).
5. Point a preference profile at the new row, or add a picker id.

Until those rows exist they are not on `ALLOWED_MODELS`, so production cannot
accidentally route to a missing vendor.

### Persistence and sync

Same LWW clock as goal / sound / Interessen: writes stamp `settingsUpdatedAt`.
`settingsToRow` / `settingsFromRow` carry `preferredModel` on the settings
jsonb blob. Whole-row LWW applies — last device to change the pick wins.
There is no merge of Auto-vs-Fast: an explicit Auto must be able to stick.

### UI

- **Settings → Lernen:** KI-Modell group, 2×2 `aria-pressed` picker
  (Auto / Fast / Balanced / Capable). Caption explains Auto vs a named band,
  and that a pick above the current plan falls back.
- **Chat aside:** the same picker, labelled Modell, so the learner can switch
  without leaving the conversation. The next send uses the new preference;
  in-flight turns are not cancelled.

When the saved pick exceeds the current tier, a muted line names the band
Chat will actually use (the auto route). The saved pick is not rewritten.

### Safety

- Keys stay in serverless env. Client sends catalog ids already on the
  allow-list, never preference-to-vendor mapping that would require a secret.
- Guest/free/pro cost caps stay as they are. No billing UI. A tiny fallback
  caption is the only plan hint.
- Crafted clients can still POST any allow-listed model (AI endpoints are
  origin + quota, not auth). That is pre-existing; quotas still apply. The
  honest client honours the ceiling.

### Out of scope

- Interest pack content expansion
- Placement / Translate gating rewrites
- Applying the preference to grade / deck callers
- Live OpenAI / Google calls
- Billing for model tiers
- Supabase migrations / production MCP writes
- Renaming `deutsch-app-state-v1` or `card.de`
