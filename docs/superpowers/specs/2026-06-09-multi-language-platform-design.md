# Multi-Language Platform — Architecture Design Note

**Date:** 2026-06-09
**Status:** Design note / direction. **Not yet implemented.** Captured for a future
full design session (spec → plan → implementation).
**Scope decision (this note):** target **Latin-script languages** (German, Spanish,
French, Italian, …). Left-to-right, standard Latin keyboard input + diacritics.

---

## Vision

Evolve the German app from a single-language product into a **language-agnostic
learning platform**. German becomes the reference "finished product" that proves
the engine works end to end. Adding a new language should mean:

1. Drop in a new **content pack** (vocabulary, phrases, scenarios, grammar rules).
2. Apply a **theme** (colors, fonts, imagery).
3. Minor per-language adaptations (grammar specifics, cultural nuance).

…with **no rewrite of the core engine**. The games, SRS, validation framework,
progress, and gamification stay the same regardless of which language is loaded.

---

## Non-goals (for now — deferred, not precluded)

- **Non-Latin scripts** (Hebrew, Arabic, Cyrillic, CJK) and **right-to-left (RTL)**
  layouts. These add input methods, font stacks, and layout mirroring. We will
  **isolate** script/direction assumptions so the door stays open, but we will
  **not build** for them until there is a real need. (YAGNI.)
- A second language pack itself — this note defines the *shape*; building the
  second pack is the future work that *proves* the shape.

---

## Architecture: three swappable layers

1. **Engine / method (language-agnostic)** — the real IP.
   SRS scheduling, the games/exercises, the answer-validation *framework*,
   progress & gamification, storage. Knows nothing about any specific language.

2. **Content packs (one per language)** — pure data + per-language config behind a
   single well-defined interface (the "content-pack contract" below).

3. **Themes (per language or brand)** — design tokens only (colors, fonts,
   imagery). Layout and components are shared across all languages.

**Governing rule:** *the engine assumes nothing about the language; each pack
declares its own capabilities.* The engine never hardcodes German grammar or
German answer-matching — it calls into what the pack provides.

---

## The content-pack contract (the key abstraction)

Every language pack must satisfy the same interface so the engine can consume any
pack identically. Illustrative sketch (final field names TBD in the full spec):

```js
LanguagePack {
  meta: {
    id,            // 'de', 'es', 'fr'
    name,          // 'German'
    nativeName,    // 'Deutsch'
    locale,        // 'de-DE'
    direction,     // 'ltr' (only LTR in current scope)
    flag,          // asset / emoji
    themeId,       // which theme this pack uses
  },
  vocabulary: VocabItem[],     // { id, term, translation, partOfSpeech, tags, example, ... }
  phrases:    Phrase[],
  scenarios:  Scenario[],      // the chat/role-play prompts
  grammar: {                   // pack-declared, engine-neutral
    genders?,                  // e.g. der/die/das vs el/la
    conjugation?,              // verb patterns
    cases?,                    // if applicable
    notes?,                    // cultural / usage nuance
  },
  validation: {
    normalize(answer) -> string,        // case, diacritics, whitespace handling
    accepts(expected, given) -> bool,   // per-language answer matching
  },
}
```

The engine calls `pack.validation.accepts(...)`, reads `pack.vocabulary`, etc.
Swapping the pack swaps the language — nothing in the engine changes.

---

## Why "Latin-script only" simplifies things (given the decision)

- **One input method, LTR, shared font stack** — no RTL mirroring, no IME.
- Language variation is contained to a small, **data-expressible** set:
  - diacritics / accents (é, ñ, ü, ß) → handled in `validation.normalize`
  - gender systems → `grammar.genders`
  - verb conjugation / articles → `grammar.conjugation`
- These become **pack data/config**, not `if (language === 'de')` branches in the
  engine.

---

## Mapping to the current codebase (no rewrite required)

> To be confirmed during the implementation design session, but the skeleton is
> already right:

- `src/lib/*` (srs, gamification, stats, storage, utils) ≈ **the engine**. Keep.
- `src/data/content.js` (today's German content) → becomes the **first content
  pack** (e.g. `src/packs/de/`), loaded through the `LanguagePack` interface.
- Answer-checking currently embedded in components/lib → **extract** into a
  pack-provided `validation` module, with the German rules as the first
  implementation.
- Theme values (colors/fonts) → **extract** into a theme-tokens file.
- **Progress storage must be namespaced per language** (e.g. key prefix by
  `pack.meta.id`) so German SRS state never mixes with Spanish.

---

## Incremental path (future work — do NOT start now)

Ordered so the German app stays fully working at every step:

- **Phase 0 — Introduce the interface (highest value, lowest risk).**
  Define the `LanguagePack` type and load the existing German content *through*
  it. German remains the only pack; the app behaves identically. This single step
  unlocks everything else.
- **Phase 1 — Extract validation + grammar** specifics into the German pack.
- **Phase 2 — Extract theme tokens** from components into a theme file.
- **Phase 3 — Add a second pack (e.g. Spanish)** to validate the abstraction.
  *The second language is the real test — the design isn't "done" until a second
  pack drops in cleanly.*
- **Phase 4 — Language picker UI** + per-language progress namespacing + theme
  binding.

---

## Open questions for the full design session

- **Content authoring:** hand-written JSON vs. AI-generated vs. community-contributed?
- **Progress model:** confirm per-language SRS/stats namespacing strategy.
- **Scenarios:** shared across languages or authored per pack?
- **Theme ↔ pack binding:** fixed 1:1, or user-selectable themes per language?
- **Pack distribution:** bundled in the build, or loaded on demand?

---

## Principles / guardrails

- **YAGNI:** don't build RTL/non-Latin/second-language until needed — just don't
  hardcode assumptions that would block them.
- **"Finished product" invariant:** the German app must stay fully working and
  shippable at every step of the refactor.
- **Second language is the proof:** the abstraction is only validated when a
  second pack plugs in with no engine changes.
- **Engine is language-blind:** any `if (language === …)` in engine code is a smell
  — push it into the pack.
```

This note records direction only. The full **spec → implementation plan** is a
separate, more credit-intensive session (run the brainstorming → writing-plans
flow) for when the budget allows.
