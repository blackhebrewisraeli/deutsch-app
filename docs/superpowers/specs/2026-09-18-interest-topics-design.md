# Interest-topic vocabulary packs (Phase 4)

**Status:** implemented
**Date:** 2026-09-18
**Depends on:**
[Phase 1 placement classification](./2026-09-18-placement-classification-design.md),
[Phase 2 practice level gating](./2026-09-18-practice-level-gating-design.md),
[Phase 3 chat CEFR + learned vocab](./2026-09-18-chat-cefr-vocab-design.md)

Phases 1–3 made classified CEFR the source of truth for placement, which
practice may run, and how Chat talks. Phase 4 adds **opt-in topical
vocabulary** on top of that: Sport, Tech/IT, and Musik. Enabling a topic
exposes a curated deck in Vocab. Words learned there join the Phase 3 chat
allowlist the same way greetings do.

This is additive. It does not replace placement, base curated decks, or the
lexicon-tag **Topics** auto-decks (`tag-sports`, `tag-tech`, …). Those stay
as Wiktionary DOMAIN dumps. Interest decks are small, authored, and offline.

A multi-model provider wrapper / user model picker stays Phase 5.
`src/lib/ai-routing/` is left alone. German stays the only language pack.

## Contract

### Source of truth

The learner's enabled topic ids live as an additive field on the existing
`deutsch-app-state-v1` blob:

```js
enabledInterests: ['sport', 'tech'] // catalog ids, catalog order
```

The storage key is not renamed. An older client that does not name the field
simply omits it (empty = nothing enabled).

The catalog is pack-owned (`src/packs/de/interests.js`). The engine
(`src/lib/interests.js`) only sanitizes ids: drop unknown, unique, restore
catalog order. It never branches on German.

### Topics (MVP)

| id     | UI label (pack) | Deck id          | Prompt hint (English, pack)      |
| ------ | --------------- | ---------------- | -------------------------------- |
| sport  | Sport           | interest-sport   | sports and athletic activities   |
| tech   | Tech / IT       | interest-tech    | computing and technical German   |
| musik  | Musik           | interest-musik   | music and performance            |

Each deck is ten authored cards (`de` / `en` / `ipa`) in a pack lexicon
slice, resolved the same way greetings/food are. No live AI is required.
Custom-deck generation remains an unrelated supplement.

Decks are **unleveled**. Phase 2 already allows unleveled decks at every
classification (greetings, frequency, custom). An A1 learner who cares about
football can still open Sport. Cards themselves carry `cefr: 'A1'` for
metadata; the deck has no `auto.level`, so `isDeckAllowedForLevel` does not
hide it.

### Settings

Settings → Lernen grows an **Interessen** group of `aria-pressed` toggles.
Toggling writes `enabledInterests` and stamps `settingsUpdatedAt` (same LWW
clock as goal / sound). Sync carries the array through `settingsToRow` /
`settingsFromRow` on the settings jsonb blob. Whole-row LWW applies — last
device to change the set wins. There is no union-merge: disabling a topic
must be able to stick.

### Practice

Vocab Practice and Browse list enabled interest decks under an **Interests**
group in the existing cascade / grouped `<select>`. Hidden while none are
enabled, so a fresh account is unchanged. Selecting a deck runs the normal
MC / typed / SRS path; `markLearned` writes `learnedByDeck[deckId]`.

Disabling a topic while that deck is selected falls back to Greetings, the
same as a deleted custom deck.

### Chat

Phase 3 `buildChatAllowlist` already unions every `learnedByDeck` map. Interest
card ids are German surface forms (`der Fußball`), so a learned interest term
joins the allowlist even if the topic is later turned off (id fallback).

Chat still indexes pack curated decks plus the interest catalog so `termOf`
resolves display forms. The sparse starter walks curated decks first; with
`STARTER_LIMIT = 12` it never reaches interest cards.

Optional light bias: when at least one topic is enabled, `chatInterestBias`
appends one engine-owned sentence naming the pack's English `promptHint`
values. No new scenario system. The model may prefer related known vocab
when it fits; it must not force a topic.

### Out of scope

- Multi-model provider wrapper / user model picker (Phase 5)
- Second language packs
- Supabase migrations / production MCP writes
- Reworking placement or Translate gating
- Replacing the Wiktionary **Topics** auto-decks
- Renaming `deutsch-level` or `card.de`
