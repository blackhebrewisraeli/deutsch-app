# German Coupling Audit

**Date:** 2026-06-09  
**Branch:** `cursor/german-coupling-audit`  
**Scope:** Read-only inventory of German-specific assumptions across the codebase, to inform the multi-language platform refactor described in `docs/superpowers/specs/2026-06-09-multi-language-platform-design.md`.

---

## Executive summary

The app is **functionally a German-only product** today. There are **no** `if (language === 'de')` branches in engine code — coupling is structural rather than conditional:

| Layer | Coupling level | Notes |
|-------|----------------|-------|
| **Content** (`src/data/content.js`) | **High** | All vocabulary, scenarios, exercises, alphabet data, and grammar notes are German. |
| **Engine** (`src/lib/*`) | **Medium** | Core SRS/stats/storage are language-agnostic in logic, but **key shapes, imports, and naming** assume German (`de` field, `deutsch-*` keys, `PRESET_DECKS` import). |
| **Components** (`src/components/*`) | **High** | UI copy, AI prompts, answer-checking, and TTS defaults are German-specific. |
| **Theme** (`src/lib/theme.js`) | **Low–medium** | German flag palette and "Deutsch App" branding comments. |

**Highest-priority extractions for Phase 0–1:** (1) `src/data/content.js` → first `LanguagePack`, (2) answer validation + AI prompt templates → pack `validation` + `prompts`, (3) storage/event keys → namespace by `pack.meta.id`.

---

## `language === 'de'` branches

**Finding:** None in `src/`. The only language-conditional logic is in `src/lib/speech.js:9–10`, which picks a `de` voice when `lang` starts with `'de'` (default `de-DE`). That is appropriate pack/runtime config, not an engine branch on a language id.

---

## Findings table

| # | File:line | What is coupled | Suggested home |
|---|-----------|-----------------|----------------|
| **Content pack — vocabulary & phrases** |
| 1 | `src/data/content.js:1–17` | `ALPHABET` — 30 German letters including Ä, Ö, Ü, ß with German example words | **Content pack** — `alphabet` or `meta.script` |
| 2 | `src/data/content.js:19–68` | `PRESET_DECKS` — flashcards with `{ de, en, ipa }` shape; nouns include **der/die/das** articles | **Content pack** — `vocabulary` (rename `de` → `term`) |
| 3 | `src/data/content.js:70–75` | `SCENARIOS` — chat role-play settings (Berlin café, airport) | **Content pack** — `scenarios` |
| 4 | `src/data/content.js:84–95` | `TRANSLATE_SENTENCES_A1` — German tile exercises; grammar notes (nominative, accusative, gender) | **Content pack** — `phrases` / `exercises.a1` + `grammar.notes` |
| 5 | `src/data/content.js:97–175` | `TRANSLATE_SENTENCES_A2` — blank-fill with article/case distractors (`einen`/`eine`, dative `dem`, etc.) | **Content pack** — `exercises.a2` + `grammar.cases` |
| 6 | `src/data/content.js:177–197` | `TRANSLATE_SENTENCES_B1` — Konjunktiv II, relative clauses, `deren`, verb-final subordinates | **Content pack** — `exercises.b1` |
| 7 | `src/data/content.js:199–259` | `SCENARIO_TASKS` — per-scenario tasks with German hints | **Content pack** — `scenarios[].tasks` |
| 8 | `src/data/content.js:267–276` | `ALPHABET_QUIZ_GROUPS` — confusable groups including U/Ü, S/ß | **Content pack** — `alphabet.quizGroups` |
| **Engine — data shape & imports** |
| 9 | `src/lib/gamification.js:6` | Imports `PRESET_DECKS` from content for `decksMastered()` | **Engine** reads `pack.vocabulary` via injected pack |
| 10 | `src/lib/gamification.js:168` | `srsKey(deckId, card.de)` — SRS keyed on German surface form | **Engine** uses `card.id` or `pack.validation.termKey(card)` |
| 11 | `src/lib/srs.js:5,35–36` | SRS storage comment and `srsKey(deckId, de)` — second segment is German word | **Engine** — generic `itemId`; pack supplies id |
| 12 | `src/lib/srs.js:86,108` | Due-card logic indexes cards by `card.de` | **Engine** — use stable `card.id` from pack |
| 13 | `src/lib/stats.js:159–160` | `itemKey(tab, context, label)` — vocab/translate use German string as `label` | **Engine** — `label` = pack item id, not surface form |
| 14 | `src/lib/stats.js:6` | `learnedWords: { word: bool }` — keys are German lemmas | **Engine** — `learnedItems` keyed by pack id; namespace per language |
| **Engine — answer matching / normalization** |
| 15 | `src/lib/utils.js:24–36` | `levenshtein()` — case-insensitive only; no ß/ss, umlaut, or NFC normalization | **Content pack** — `validation.normalize()` (German rules first impl.) |
| 16 | `src/components/translate/TileExercise.jsx:43–44` | Exact string join check `answer === exercise.words.join(' ')` — no normalization | **Content pack** — `validation.accepts(expected, given)` |
| 17 | `src/components/translate/BlankExercise.jsx:49` | Strict equality on blank tokens | **Content pack** — `validation.accepts` per blank |
| 18 | `src/components/translate/TypingExercise.jsx:31–41` | Claude prompt: "German language grader", article/case in rubric | **Content pack** — `prompts.gradeTranslation` |
| 19 | `src/components/VocabTab.jsx:132–133` | B1 typed answers: `levenshtein` vs **English** `card.en` (not German) | **Engine** framework + **pack** defines which field to fuzzy-match |
| **Engine — TTS / speech** |
| 20 | `src/lib/speech.js:1–11` | Default `lang = 'de-DE'`; prefers voice where `v.lang.startsWith('de')` | **Content pack** — `meta.locale`; engine calls `speak(text, pack.meta.locale)` |
| **Engine — gamification copy (German UI strings in lib)** |
| 21 | `src/lib/gamification.js:35–41` | Rank names: Anfänger, Lernende, Fortgeschritten, Fließend, Muttersprachler | **Content pack** or **i18n** — `gamification.ranks` |
| 22 | `src/lib/gamification.js:82–154` | Achievement names in German (Drei am Stück, Wochenheld, Wortschatz 25, …) | **Content pack** or **i18n** — `gamification.achievements` |
| **Storage & events — not namespaced per language** |
| 23 | `src/lib/storage.js:1` | `STORAGE_KEY = 'deutsch-app-state-v1'` — single blob for all progress | **Engine** — `app-state-v1` or `{packId}-app-state-v1` |
| 24 | `src/App.jsx:168,170,218` | `deutsch-onboarded`, `deutsch-level` in localStorage | **Engine** — `{packId}-onboarded`, `{packId}-level` or global app prefs |
| 25 | `src/components/SplashScreen.jsx:13–14` | Writes `deutsch-onboarded`, `deutsch-level` | **Engine** — same as above |
| 26 | `src/components/ChatTab.jsx:14,28,35` | `deutsch-welcome-dismissed` | **Engine** — `{packId}-welcome-dismissed` |
| 27 | `src/lib/stats.js:210` | `CustomEvent('deutsch:progress')` | **Engine** — `app:progress` or `{packId}:progress` |
| 28 | `src/App.jsx:157–160` | Listens for `deutsch:progress` | **Engine** — match renamed event |
| 29 | `src/components/StatsTab.jsx:80,95` | Dispatches `deutsch:progress` on goal change | **Engine** — match renamed event |
| **Theme & branding** |
| 30 | `src/lib/theme.js:2,33–36` | "Deutsch App" header comment; German flag palette (red/gold/black) | **Theme** — `themeId: 'de-flag'` bound to pack |
| 31 | `src/App.jsx:328` | Header logo text `Deutsch.` | **Theme** or **pack.meta** — `nativeName` / brand string |
| 32 | `src/components/SplashScreen.jsx:63` | Splash logo `Deutsch.` | **Theme** or **pack.meta** |
| **Components — hardcoded German UI (not in content.js)** |
| 33 | `src/components/AlphabetTab.jsx:131` | Hero title `Das Alphabet` | **i18n** or pack UI strings |
| 34 | `src/components/AlphabetTab.jsx:312` | Hardcoded special letters `['Ä','Ö','Ü','ß']` | **Content pack** — `alphabet.specialLetters` |
| 35 | `src/components/VocabTab.jsx:172` | Hero title `Wortschatz` | **i18n** |
| 36 | `src/components/TranslateTab.jsx:103` | Hero title `Übersetzen` | **i18n** |
| 37 | `src/components/translate/PromptCard.jsx:33` | Label `TRANSLATE TO GERMAN` | **i18n** — direction-aware ("Translate to {targetLanguage}") |
| 38 | `src/components/translate/TypingExercise.jsx:94` | Label `YOUR GERMAN TRANSLATION` | **i18n** |
| 39 | `src/components/chat/ChatInput.jsx:49` | Placeholders `Sprich auf Deutsch...` / `Schreib auf Deutsch...` | **i18n** + pack `meta.nativeName` |
| 40 | `src/components/chat/MessageList.jsx:34` | Typing indicator `Anna tippt` | **i18n** |
| 41 | `src/components/ChatTab.jsx:60–72` | Hardcoded intro messages in German | **Content pack** — `scenarios[].intros` |
| 42 | `src/components/ChatTab.jsx:129–143` | System prompt: "German tutor Anna", JSON schema with `de`/`ipa`/`en` fields | **Content pack** — `prompts.chatTutor` + response schema |
| 43 | `src/components/VocabTab.jsx:145–146` | AI deck generation prompts require `de` key and German articles | **Content pack** — `prompts.generateVocab` |
| 44 | `src/components/translate/generateSentences.js:9–18` | AI sentence generation: German-only, A2 targets articles/prepositions | **Content pack** — `prompts.generateExercises` |
| **Components — German grammar assumptions in exercise flow** |
| 45 | `src/components/translate/BlankExercise.jsx:17` | Comment/doc: "German sentence" blanks | **Content pack** — exercise type metadata |
| 46 | `src/data/content.test.js:51–60` | Tests assert Ä, Ö, Ü, ß in alphabet | **Content pack** tests (move with pack) |
| 47 | `src/data/content.test.js:177,231` | Asserts `words.join(' ') === de` — German tokenization contract | **Content pack** — validation contract tests |
| **Package / product identity** |
| 48 | `package.json:2` | Package name `deutsch-app` | **Product** — rename when platform ships (non-blocking) |

---

## German grammar & normalization (cross-cutting)

These are **embedded in content and exercise design**, not centralized in engine code:

| Pattern | Where | Pack extraction |
|---------|-------|-----------------|
| **der/die/das** articles on nouns | `PRESET_DECKS`, A1/A2 distractors | `grammar.genders`, vocab `partOfSpeech` |
| **Case & declension** (accusative `einen`, dative `dem`, `ins`) | `TRANSLATE_SENTENCES_A2` blanks/notes | `grammar.cases` + exercise `blanks` |
| **Umlauts & ß** | Alphabet, vocab, exercises | `validation.normalize()` (NFC, ß↔ss policy) |
| **Konjunktiv, relative clauses** | B1 sentence bank notes | Pack content only |
| **IPA** | All vocab cards | Pack field `ipa` (optional per language) |

There is **no shared `normalize()` or `accepts()`** today — matching is split between exact string compare (tiles/blanks), Levenshtein on English (vocab B1), and Claude API grading (typing).

---

## `localStorage` / state keys summary

| Key | Location | Namespaced? | Suggested key |
|-----|----------|-------------|---------------|
| `deutsch-app-state-v1` | `src/lib/storage.js` | No | `{packId}-app-state-v1` |
| `deutsch-onboarded` | `App.jsx`, `SplashScreen.jsx` | No | `app-onboarded` or per-pack |
| `deutsch-level` | `App.jsx`, `SplashScreen.jsx` | No | `{packId}-level` |
| `deutsch-welcome-dismissed` | `ChatTab.jsx` | No | `{packId}-welcome-dismissed` |
| `learnedWords` (inside state blob) | `stats` shape | No — German words as keys | `learnedItems` with stable ids |
| `srs` keys `deckId:de` | `srs.js` | No | `deckId:itemId` |

---

## Recommended migration order (aligns with design note Phase 0–1)

1. **Define `LanguagePack` interface** and load current `content.js` through it (behavior unchanged).
2. **Namespace storage** by `pack.meta.id` before adding a second language.
3. **Extract `validation.normalize` / `validation.accepts`** — start with German rules used by Tile/Blank exercises.
4. **Move AI prompt strings** from components into pack `prompts` module.
5. **Decouple `gamification.js`** from direct `PRESET_DECKS` import — inject pack vocabulary.
6. **Rename `card.de` → `card.term`** (or add `id`) in pack schema; update SRS/item keys.
7. **Theme binding** — `pack.meta.themeId` drives flag palette vs future packs.

---

## Out of scope (not audited as coupling)

- `api/chat.js` — server proxy (per mission brief).
- Tier B work (pack directory layout, full theme extraction) — blocked until contract is locked.
- Test files under `src/components/` — parallel work; listed only where they encode German content contracts (`content.test.js`).

---

## Verification

This audit is **documentation only**. No source files were modified.  
**Done when:** this file exists with a findings table ✓
