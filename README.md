<div align="center">

<br/>

<sup>S P R A C H S C H U L E &nbsp;×&nbsp; E S T .&nbsp; 2 0 2 6</sup>

# Deutsch·

### *A guided German learning app — AI tutor, exercise-driven practice, installable PWA*

<p>
  <a href="https://deutsch-app-dusky.vercel.app"><img alt="Live Demo" src="https://img.shields.io/badge/▶_Live_Demo-3FA34D?style=flat-square"/></a>
  &nbsp;
  <a href="https://github.com/blackhebrewisraeli/deutsch-app/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/blackhebrewisraeli/deutsch-app/actions/workflows/ci.yml/badge.svg"/></a>
  &nbsp;
  <img alt="Tests" src="https://img.shields.io/badge/Vitest-455_passing-16110B?style=flat-square&logo=vitest"/>
  &nbsp;
  <img alt="RLS" src="https://img.shields.io/badge/RLS_suite-30_adversarial-3FA34D?style=flat-square&logo=supabase&logoColor=white"/>
  &nbsp;
  <img alt="License" src="https://img.shields.io/badge/License-MIT-7a6e5c?style=flat-square"/>
</p>

<p>
  <img alt="React" src="https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB"/>
  &nbsp;
  <img alt="Vite" src="https://img.shields.io/badge/Vite_5-646CFF?style=flat-square&logo=vite&logoColor=white"/>
  &nbsp;
  <img alt="Claude" src="https://img.shields.io/badge/Claude_Haiku_4.5-D62828?style=flat-square"/>
  &nbsp;
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-F5C518?style=flat-square"/>
  &nbsp;
  <img alt="Mobile" src="https://img.shields.io/badge/Mobile-responsive-16110B?style=flat-square"/>
</p>

<p>
  <a href="#-learning-levels"><b>Levels</b></a> &nbsp;·&nbsp;
  <a href="#-features"><b>Features</b></a> &nbsp;·&nbsp;
  <a href="#-german-grammar--vocabulary-coverage"><b>Grammar Coverage</b></a> &nbsp;·&nbsp;
  <a href="#️-tech-stack"><b>Tech Stack</b></a> &nbsp;·&nbsp;
  <a href="#-multi-language-architecture"><b>Architecture</b></a> &nbsp;·&nbsp;
  <a href="#-quick-start"><b>Quick Start</b></a> &nbsp;·&nbsp;
  <a href="#-deploy-to-production"><b>Deploy</b></a>
</p>

<br/>

</div>

---

## What is this?

**Deutsch · Sprachschule** is an exercise-driven German learning app that runs in the browser and installs as a PWA. It does not wait for you to know what to do — it gives you a task, you respond, and it tells you whether you got it right.

The app covers **three CEFR proficiency levels** (A1 · A2 · B1) across four exercise modules — guided conversation, alphabet recognition, vocabulary active recall, and translation — plus a **Stats tab** that records every interaction and resurfaces what you got wrong. Vocab is backed by a **Leitner spaced-repetition scheduler**, so cards return at the right time, not on every visit.

All AI features call **Claude Haiku 4.5** through a versioned server-side API (`/api/v1/ai/*` — validated, rate-limited, [contract-documented](./docs/api/ai.md)) — your API key never touches the browser.

---

## 📊 Learning Levels

Choose your level on the splash screen. It is stored in `localStorage` and drives the exercise mode in every tab.

| Level | CEFR description | Exercise mode |
|:---:|---|---|
| **A1 — Beginner** | You know basic vocabulary and can form simple sentences | **Word tiles** — all German words provided; assemble them in the correct order |
| **A2 — Elementary** | You can handle familiar situations with some grammar knowledge | **Fill the blanks** — sentence shown with 2–3 key words missing; select from a tile bank |
| **B1 — Intermediate** | You can describe experiences and explain opinions in German | **Free typing + AI grading** — translate the sentence yourself; Claude grades your answer |

You can change your level at any time by clearing the onboarding state (or via returning to the splash screen on first visit to a new device).

---

## ✦ Features

### 01 · Chat — Geführtes Gespräch (Guided Conversation)

Anna, your AI tutor, does not wait for you to speak. She opens each session with a **task suited to your level** and guides you toward completing it.

**How tasks work:**

```
╔══════════════════════════════════╗
║  C  YOUR TASK                    ║
║  ─────────────────────────────── ║
║  TASK 1                          ║
║  "Order a large coffee and ask   ║
║   how much it costs."            ║
║                                  ║
║  [SHOW HINT]                     ║
╚══════════════════════════════════╝
```

Hints are available (always visible for A1, toggle for A2, hidden for B1). When Claude detects the task is naturally complete, the panel advances to the next task automatically.

**Four scenarios, three difficulty levels each:**

| Scenario | A1 example task | B1 example task |
|---|---|---|
| ◆ Free Chat | "Say hello and tell Anna your name." | "Tell Anna about a problem you had recently and how you solved it." |
| ☕ Order Coffee | "Order a coffee." | "Complain politely that your order is wrong." |
| ✶ Meet Someone | "Ask Anna her name and where she is from." | "Have a natural small-talk conversation about your week." |
| ✈ At the Airport | "Ask where the check-in desk is." | "Explain that your flight was cancelled and ask about your options." |

**Inline grammar correction:**

Every reply is evaluated. If you make a mistake, the correction panel shows:

```
⚠  NEEDS A FIX
──────────────────────────────────────────────────
YOU SAID   →   Ich lerne Deutsch seit drei Monat.
CORRECT    →   Ich lerne Deutsch seit drei Monaten.   [ HEAR IT ]

"After 'seit' (since), use the dative case.
'Monat' → 'Monaten' (plural dative)."
──────────────────────────────────────────────────
```

**Anna's JSON response schema (what Claude returns on every turn):**

```json
{
  "de": "Willkommen! Was darf ich Ihnen bringen?",
  "ipa": "[vɪlˈkɔmən vas daʁf ɪç ˈiːnən ˈbʁɪŋən]",
  "en": "Welcome! What can I bring you?",
  "correction": null,
  "taskComplete": false
}
```

When `taskComplete` is `true`, the task panel advances to the next task for the current scenario.

---

### 02 · Alphabet — Hören & Erkennen (Listen & Identify)

Two modes behind a toggle:

**Quiz mode (default):** A letter is spoken aloud by the browser's German TTS voice. Four confusable letter options are shown — tap the one you heard. Score tracked per session.

```
ROUND 4 · SCORE 3/3 · WHICH LETTER DID YOU HEAR?

        🔊   TAP TO HEAR AGAIN

    ┌──────┐  ┌──────┐
    │  U   │  │  Ü   │ ← correct
    ├──────┤  ├──────┤
    │  O   │  │  Ö   │
    └──────┘  └──────┘
```

**Letter groups are chosen for maximum confusion value** — letters that German learners commonly mishear:

| Group | Letters | Why confusable |
|:---:|---|---|
| 1 | U · Ü · O · Ö | Front/back vowel pairs |
| 2 | A · Ä · E · I | Short vowel spectrum |
| 3 | S · ß · Z · W | Sibilants and voiced variants |
| 4 | B · P · D · T | Voiced/unvoiced pairs |
| 5 | V · W · F · B | Labial consonants |
| 6 | G · K · J · Y | Velar and palatal consonants |
| 7 | R · L · N · M | Liquids and nasals |
| 8 | H · X · Q · C | Rare / silent letters |

**Browse mode:** The full 30-letter grid (A–Z + Ä · Ö · Ü · ß). Click any letter to hear it spoken, see an example word, and read its English meaning.

---

### 03 · Vocab — Aktives Lernen (Active Recall)

Cards never just flip to reveal the answer — you have to produce it first.

**A1 / A2 — Multiple choice (4 options):**

```
CARD 4 / 10 · WHAT DOES THIS MEAN?

┌────────────────────────────────────┐
│                                    │
│         der Hund                   │
│     [deːɐ̯ hʊnt]                   │
│                                    │
└────────────────────────────────────┘

  ┌──────────┐   ┌──────────┐
  │   cat    │   │   dog ✓  │  ← gold flash
  ├──────────┤   ├──────────┤
  │   horse  │   │   bird   │
  └──────────┘   └──────────┘
```

**B1 — Type the meaning:**

```
CARD 4 / 10 · TRANSLATE THIS WORD

┌────────────────────────────────────┐
│           der Hund                 │
└────────────────────────────────────┘

  [ dog                           ]  ← text input
  [ CHECK → ]
```

Answers within **Levenshtein distance ≤ 2** (one or two typos) are marked **ALMOST** and advance the card. Wrong answers return to the back of the queue — the deck never completes until every card is answered correctly at least once.

**Preset decks** (same for all levels):

| Deck | Cards | Sample words |
|---|:---:|---|
| Greetings | 10 | Hallo, Guten Morgen, Tschüss, Wie geht es dir? |
| Food & Drink | 10 | das Brot, der Kaffee, die Milch, der Apfel |
| Travel | 10 | der Bahnhof, der Pass, links, geradeaus |
| Numbers | 10 | eins through zehn |

**AI-generated decks:** Type any topic — *colours, animals, at the doctor's, football* — and Claude generates a 10-card deck with German articles for nouns, IPA, and English meanings.

---

### 04 · Translate — Übersetzen (Translation Exercise)

The app gives you a sentence. You translate it. The exercise mode depends on your level.

**A1 — Word tiles:**

```
TRANSLATE TO GERMAN
"I drink water."

YOUR ANSWER ─────────────────────────────────
  [ Ich ] [ trinke ]  ← placed tiles (click to return)

WORD BANK ───────────────────────────────────
  [ Wasser. ]  [ esse ]  [ laufe ]

[ CHECK → ]  [ ⏭ skip ]
```

**A2 — Fill the blanks:**

```
TRANSLATE TO GERMAN
"The child plays with the ball."

COMPLETE THE SENTENCE
  Das Kind spielt mit ___ Ball.
  
  [ der ]  [ den ]  [dem] ← correct  [ die ]

[ CHECK → ]  [ ⏭ skip ]
```

**B1 — Free typing + AI grading:**

```
TRANSLATE TO GERMAN
"Despite the rain, we enjoyed the walk."

  ┌────────────────────────────────────────┐
  │ Trotz des Regens haben wir den        │
  │ Spaziergang genossen.                  │
  └────────────────────────────────────────┘

[ CHECK →  ]  [ ⏭ skip ]

✓ CORRECT ───────────────────────────────────
  "Great use of 'trotz + genitive' and 
   Perfekt with haben."
[ NEXT EXERCISE → ]
```

**B1 grading prompt schema (what Claude returns):**

```json
{
  "verdict": "correct",
  "corrected": "Trotz des Regens haben wir den Spaziergang genossen.",
  "message": "Perfect. Note: 'trotz' always takes genitive — des Regens, not dem Regen."
}
```

`verdict` is `"correct"`, `"almost"`, or `"wrong"`. Both **correct** and **almost** advance the exercise.

When the **built-in sentence bank** (10 sentences per level) is exhausted, Claude generates 5 fresh sentences on demand and appends them — the exercise never runs out.

---

### Progress tracking

The header shows **level**, **streak**, and **daily goal** progress (XP-derived), persisted in `localStorage`:

- **Level badge** — XP from all graded exercises; rank names (Anfänger → Fließend, …)
- 🔥 **Streak** — consecutive days with at least one visit
- **Goal ring** — today's XP vs. daily target (configurable in Stats)

The **05 Stats** tab shows total XP, learned-word count, achievements, and goal/sound settings. A red badge on the Stats nav tab shows how many items are waiting for review (wrong answers + due vocab cards), capped at "9+". Six practice dashboards — see the next section.

---

### 05 · Stats — Statistik (Practice Dashboard)

A dedicated tab that records every graded interaction across the four exercise modules and turns them into an at-a-glance picture of practice.

```
╔══════════════════════════════════════════════════════════════════╗
║  TODAY                                                            ║
║  12  exercises    ACCURACY · STREAK 4                             ║
║                  [████████░░░░██░░] ✓ 8 (67%) ≈ 2 (17%) ✗ 2 (16%) ║
╚══════════════════════════════════════════════════════════════════╝
```

**Six sections (A–F):**

| # | Section | Shows |
|---|---|---|
| A | **Today** | Today's total exercises, three-way accuracy bar (correct / almost / wrong), streak count |
| B | **Last 12 months** | GitHub-style heatmap of daily activity (53 weeks × 7 days, 5 intensity buckets) |
| C | **By section** | Horizontal bars: Chat / Alphabet / Vocab / Translate. Most-practised tab is highlighted red. |
| D | **Accuracy by level** | Three-way stacked bars per CEFR level (A1 / A2 / B1) |
| E | **Review — tap to re-attempt** | Up to 10 most-recently-wrong items. Click a row → jump straight to that exercise with the item pre-loaded. |
| F | **Vocab review queue** | DUE NOW count + mastered progress bar (out of 40 cards) + per-deck breakdown (Greetings / Food & Drink / Travel / Numbers) |

**Storage:** all event data is forward-only — past practice is not backfilled. Schema extends `deutsch-app-state-v1`:

```js
{
  stats:        { streak, learnedCount, lastVisit },
  learnedWords: { '<de>': bool },
  daily:        { 'YYYY-MM-DD': { total, byTab, byLevel: { a1, a2, b1: { correct, almost, wrong } } } },
  items:        { '<tab>:<context>:<label>': { tab, context, label, detail, lastVerdict, lastTs, attempts, wrongCount } },
  srs:          { '<deckId>:<id>': { box, lastReviewed, nextDue, reps } },
  gamification: { goal, soundOn, achievements, lastGoalMet },
}
```

**Spaced repetition (Leitner):** Vocab cards live in 5 boxes with intervals 1d / 3d / 7d / 14d / 30d. After each card you pick **Hard / Good / Easy** (or **Again** on a wrong answer) and the system schedules the next review accordingly. Box 5 = mastered. The Vocab queue is ordered _due first → new → over-review_, so you always start with what needs you most.

---

## 🇩🇪 German Grammar & Vocabulary Coverage

### Grammar topics by level

**A1 — Word order and basic conjugation**
- Subject–Verb–Object sentence structure
- Present tense conjugation: `ich bin / habe / gehe / trinke / lese`
- Nominative articles: `der / die / das` + gender recognition
- Basic negation and simple adjective agreement

**A2 — Cases, prepositions, and adjective endings**
| Grammar point | Example from exercise bank |
|---|---|
| Accusative masculine | *einen großen Hund* (ein → einen; groß → großen) |
| Movement vs. location | *in die Schule* (acc.) vs. *in der Schule* (dat.) |
| Dative after prepositions | *mit dem Ball, zu meinem Freund* |
| Contractions | *ins = in + das, im = in + dem, zum = zu + dem* |
| Possessives in dative | *ihrem Freund* (dative masculine) |
| Adjective endings after definite article | *Das rote Auto* (neuter nom. → -e) |

**B1 — Complex structures and mood**
| Grammar point | Example from exercise bank |
|---|---|
| Perfekt with *sein* | *bin … gegangen* (movement verb) |
| Perfekt with *haben* | *habe … gekauft, genossen* |
| Konjunktiv II | *hätte, würde + infinitive* |
| seit + present tense | *Er wohnt seit drei Jahren …* |
| Modal verbs | *Ich muss … fertigstellen* (verb-final) |
| Relative clauses | *Die Frau, deren Tasche …* (genitive *deren*) |
| trotz + genitive | *Trotz des Regens …* |
| Indirect speech | *dass … kommen würde* (verb-final) |
| Conditional perfect | *hätte … angerufen, wenn … gewusst hätte* |
| Indirect questions | *Könnten Sie sagen, wo … ist?* |

### Vocabulary domains

The built-in content covers these semantic fields across all levels:

- **Greetings & social phrases** — Hallo, Auf Wiedersehen, Wie geht es dir?
- **Food & drink** — das Brot, der Kaffee, die Milch, das Bier
- **Travel & transport** — der Bahnhof, der Flughafen, links, geradeaus
- **Numbers** — eins through zehn
- **Daily objects** — das Haus, die Katze, der Hund, das Buch
- **Body & feelings** — ich bin müde / hungrig
- **Time expressions** — jeden Tag, seit, gestern

AI-generated decks expand to any domain on demand.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **React 18** | Component model, hooks, concurrent state |
| Build tool | **Vite 5** | Dev server, fast HMR, PWA build (`npm run dev:full` adds the API via vercel dev) |
| AI | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Tutor, grading, deck generation, translation |
| Speech synthesis | **SpeechSynthesis API** | Native German TTS — no external service |
| Speech recognition | **Web Speech API** | Microphone input in Chat — Chrome/Edge only |
| Icons | **lucide-react** | Consistent SVG icon set |
| Typography | **Fraunces** (display) + **JetBrains Mono** (labels) | Editorial serif + technical mono |
| Design tokens | `src/lib/theme.js` | Centralised colours, type scale, spacing, component composites |
| Persistence | **localStorage** (local-first) | Streak, learned words, SRS + stats, gamification — kept in `deutsch-app-state-v1` |
| Sync | **localStorage ↔ Supabase** engine | Built + merged (B2.2): folds local state into per-user rows via LWW / additive-delta / union merges, behind the `VITE_SYNC_ENABLED` build flag — **off in prod** pending B2.3 go-live |
| Auth | **Supabase Auth** (magic-link + OTP) | Passwordless, anonymous-first sign-in UI; gates the sync engine |
| Backend data | **Supabase** (Postgres + RLS) | Live: durable per-IP rate quotas via an atomic RPC; five user-owned tables under adversarially-tested row-level security (revoked-by-default Data API grants) backing the sync engine |
| Error monitoring | **Sentry** (errors-only) | Live in prod + Preview (EU region) — runtime error capture, no PII or session replay |
| Linting | **ESLint 10** (flat config) + `react-hooks/exhaustive-deps` | Catches stale closures, missing deps, unused vars |
| Formatting | **Prettier 3** | Consistent code style, enforced on every commit |
| Testing | **Vitest 2** + **jsdom** + **React Testing Library** | **455 tests** — engine (`src/lib/*`) incl. the sync-engine merges, packs, content invariants, the API middleware and per-route quota contracts (`api/`), the dev-toolkit graph helpers (`scripts/`), and component tests across every tab — plus a separate **30-test adversarial RLS suite** (`npm run test:rls`) that attacks the database policies through real PostgREST |
| CI | **GitHub Actions** | Runs lint + test + build on every push to `main` and every PR |
| Pre-commit | **Husky + lint-staged** | Runs ESLint + Prettier + the full test suite before every `git commit` |
| PWA | **vite-plugin-pwa** + Workbox | Installable on iOS/Android, offline-capable static assets |
| Responsive | `useWindowWidth` hook | Live viewport width → inline style breakpoints (mobile < 640px) |
| Accessibility | Semantic HTML + ARIA | Labeled icon controls, keyboard-operable widgets, visible focus states |
| Deployment | **Vercel** | Static SPA + versioned `/api/v1/*` serverless functions (+ legacy `/api/chat` alias) |

**No CSS framework. Accounts are optional — anonymous-first by design.** The browser's only external call is to the app's own API. Server-side, the backend has two lanes: the **AI service** (`/api/v1/ai/*` → Anthropic) and the **Supabase data lane** (live) carrying durable rate limiting plus the schema + row-level security behind a now-merged localStorage↔Supabase **sync engine** (flag-gated, off in prod pending go-live) — see the [backend architecture spec](./docs/superpowers/specs/2026-06-10-backend-architecture-design.md) and the [B1 design](./docs/superpowers/specs/2026-06-12-backend-b1-data-lane-design.md).

---

## ⚙️ How It Works

### The API proxy — keeping your key safe

Every environment calls the same versioned serverless endpoints — `/api/v1/ai/chat`, `/api/v1/ai/grade`, `/api/v1/ai/deck` ([contract docs](./docs/api/ai.md)):

```
Browser                Vercel function (/api/v1/ai/*)        Anthropic API
   │                            │                                  │
   │  POST /api/v1/ai/chat      │                                  │
   │  ─────────────────────────►│  validate · rate-limit · rebuild │
   │                            │  x-api-key: [ANTHROPIC_API_KEY]  │
   │                            │  ────────────────────────────── ►│
   │                            │◄─────────────────────────────────│
   │◄───────────────────────────│                                  │
```

In production the functions read `ANTHROPIC_API_KEY` from Vercel's environment. Locally, `npm run dev:full` (vercel dev) runs the **same functions** with the Development environment injected — the key never appears in the browser bundle, in any environment. Endpoints reject bodies that fail validation ([error envelope](./docs/api/README.md)) and are rate-limited per IP with **per-route quotas** (chat 20/5 min · deck 5/hour · grade 60/5 min). Quota counters live **durably in Supabase** via an atomic `increment_rate_limit` RPC — surviving cold starts and shared across function instances — with a per-instance in-memory fallback when `SUPABASE_*` is unset. Malformed requests still consume quota: garbage is not free.

### Exercise content flow

```
Component mounts
      │
      ▼
shuffle(BANK_MAP[level])        ← built-in sentences from content.js
      │
      ▼
User works through exercises    ← 10 per set
      │
   exhausted?
      │ yes
      ▼
generateMoreSentences(level)    ← Claude generates 5 more, appended
      │
      ▼
Continue                        ← new exercises appended, score resets
```

### How each Claude call is structured

**Chat (Anna)** — returns structured JSON with conversation awareness:
```
System: You are Anna, a German tutor. Current scenario: [café].
        Task: "Order a large coffee and ask the price."
        Level: A2 — use natural but simple German.
        Respond ONLY with JSON: { de, ipa, en, correction, taskComplete }

User history: [previous turns passed as messages array]
User: "Ich möchte ein Kaffee groß, bitte."
```

**B1 Translation grading** — single-shot evaluation:
```
System: You are a German grader. Respond ONLY with JSON: { verdict, corrected, message }
        verdict: "correct" | "almost" | "wrong"

User: English: "…" | Ideal German: "…" | Learner's answer: "…"
```

**Vocabulary generation** — single-shot JSON array:
```
System: Generate German flashcards. Respond ONLY with a JSON array, no markdown.

User: Generate 10 cards on topic: "animals".
      Return: [{ de, en, ipa }]
```

**A2 sentence generation** (when bank exhausted):
```
System: Generate A2 fill-in-the-blank exercises.

User: Return: [{ en, de, template, blanks: [{ word, distractors }], note }]
```

All JSON responses strip markdown fences (` ```json ... ``` `) before `JSON.parse()` as a defensive measure.

---

## 🌍 Multi-Language Architecture

Deutsch is being evolved from a single-language app into a **language-agnostic learning platform**: the engine — spaced repetition, exercises, answer-matching, progress, gamification — knows nothing about any specific language, and each language is a **content pack** that plugs into one interface. German is the reference "finished product" that proves the engine end-to-end.

**Three swappable layers:**

| Layer | What it is | Where |
|---|---|---|
| **Engine** | SRS, stats, gamification, answer-matching — language-blind | `src/lib/*` |
| **Content pack** | Per language: vocabulary, scenarios, exercises, validation rules, prompts — behind the `LanguagePack` interface | `src/packs/de/` |
| **Theme** | Design tokens (colours, fonts) per language/brand | `src/lib/theme.js` (per-pack tokens planned) |

The active pack is a module singleton (`activePack`); the engine matches answers through a pack-supplied `normalize` rather than hardcoding German rules. Adding a language means dropping in a new pack — no engine rewrite.

**Phased roadmap** — German stays fully working at every step:

- ✅ **Phase 0** — the `LanguagePack` interface; German content loads through it *(merged)*
- 🚧 **Phase 1** — ✅ language-neutral card identity *(merged — SRS/stats key on `card.id`)* · ✅ all translate exercises grade through pack-supplied `normalize` *(merged)* · ✅ TTS voice/locale picked from the pack, not hardcoded `de-DE` *(merged)*; next: diacritic-aware validation, grammar + AI prompts moved into the pack, content relocated under `src/packs/de/`
- ⬜ **Phase 2** extract theme tokens · **Phase 3** add a second pack (e.g. Spanish) to prove the abstraction · **Phase 4** language picker + per-language progress

**Backend arc (parallel track):** the **user interface** (this PWA) and the **developer interface** (versioned REST surface + database contract) are being separated into a two-lane backend. Lane 1 — the AI service (`/api/v1/ai/*`: validation, per-IP quotas, error envelope) — is **live**. Lane 2 — Supabase — is **live**: durable rate limiting runs on it in production, and the sync schema (five user-owned tables under adversarially-tested row-level security, with explicit revoked-by-default Data API grants — `anon` can touch nothing) is deployed. The **localStorage↔Supabase sync engine + magic-link auth (B2.2) are built and merged**, behind the `VITE_SYNC_ENABLED` flag — **off in prod** pending B2.3 go-live (prod env + flag flip). Pack delivery (B4) follows the second language pack.

**Design notes** ([`docs/superpowers/`](./docs/superpowers/)): [multi-language direction](./docs/superpowers/specs/2026-06-09-multi-language-platform-design.md) · [LanguagePack Phase 0 design](./docs/superpowers/specs/2026-06-09-languagepack-contract-design.md) · [Phase 0 plan](./docs/superpowers/plans/2026-06-09-languagepack-phase0.md) · [German coupling audit](./docs/AUDIT_GERMAN_COUPLING.md) · [backend architecture](./docs/superpowers/specs/2026-06-10-backend-architecture-design.md) · [B0 plan](./docs/superpowers/plans/2026-06-11-backend-b0-ai-service.md) · [B1 design](./docs/superpowers/specs/2026-06-12-backend-b1-data-lane-design.md) · [B1 plan](./docs/superpowers/plans/2026-06-12-backend-b1-data-lane.md) · [API contract](./docs/api/README.md) · [data contract](./docs/api/data.md)

---

## ⚡ Quick Start

**Prerequisites:** Node.js 20+ (see `.nvmrc`), an Anthropic API key ([get one here](https://console.anthropic.com))

```bash
# 1. Clone
git clone https://github.com/blackhebrewisraeli/deutsch-app.git
cd deutsch-app

# 2. Install
npm install

# 3. Link Vercel (serves the API locally; injects the Development env)
npx vercel link

# 4. Start the full dev server (app + API)
npm run dev:full     # UI-only work: npm run dev (AI calls disabled)
```

Open **[http://localhost:5173](http://localhost:5173)**.

**Available scripts:**

```bash
npm run dev          # Vite only — UI work, no API routes (AI calls fail politely)
npm run dev:full     # vercel dev — app + serverless functions, like production
npm run build        # Production build (generates service worker)
npm run preview      # Preview the production build locally
npm run lint         # ESLint across src/ and api/
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier across src/
npm run format:check # Verify formatting without writing
npm test             # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run test:coverage # Vitest with v8 coverage report
npm run test:rls     # Adversarial RLS suite — needs Docker: `supabase start` first
npm run where -- X   # Dev toolkit — locate module X + who depends on it (also: /component)
npm run audit:dead   # Dev toolkit — list orphan modules (dead code)
npm run clean        # Dev toolkit — wipe stale build/dev caches
```

## Importing vocabulary

The vocabulary lexicon (`public/lexicon/`) is built from three open datasets.
Run the import **locally** — the output files are not checked into version control.

```bash
npm run import:lexicon
```

The importer downloads these pinned sources into a git-ignored
`.cache/lexicon-raw/` directory at the repo root:

| Dataset | URL | License |
|---|---|---|
| Wiktextract (German Wiktionary) | `https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl` | CC BY-SA 4.0 |
| Tatoeba sentences | `https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2` | CC BY 2.0 FR |
| Tatoeba sentence links | `https://downloads.tatoeba.org/exports/links.tar.bz2` | CC BY 2.0 FR |
| Leipzig Corpora (deu\_news\_2023\_100K) | `https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_100K.tar.gz` | CC BY |

**One command.** `npm run import:lexicon` downloads all sources (first run:
~1.2 GB into the git-ignored `.cache/lexicon-raw/`), decompresses them, joins
the Tatoeba de↔en sentence pairs, frequency-sorts the Leipzig word list, and
runs the pipeline. Requires macOS/Linux (`tar` + `bunzip2` on PATH). Prep steps
are idempotent — outputs are reused if present; delete `.cache/lexicon-raw/` to
rebuild from fresh dumps. The run prints a JSON report (kept/rejected counts by
reason + a random sample) — spot-check it before committing `public/lexicon/`.

Output lands in `public/lexicon/` as a set of JSON chunk files plus an
`index.json` and a `manifest.json`. The app loads these chunks on demand and
caches them via the Workbox `CacheFirst` strategy (cache name `lexicon-json`,
30-day TTL).

See [CONTENT_LICENSE.md](./CONTENT_LICENSE.md) for full licensing details.
Content derives from Wiktionary (CC BY-SA 4.0), Tatoeba (CC BY 2.0 FR), and
the Leipzig Corpora Collection (CC BY).

> 💡 **Cost:** A 30-minute session (chat + a few translations + a generated deck) typically costs **$0.01–0.03** with Claude Haiku 4.5.

---

## 🌐 Browser Support

| Feature | Chrome / Edge / Arc | Firefox | Safari |
|---|:---:|:---:|:---:|
| All exercises + AI | ✅ | ✅ | ✅ |
| Text-to-speech (Anna's voice) | ✅ | ✅ | ✅ |
| Microphone / speech recognition | ✅ | ❌ | ⚠️ partial |
| PWA install prompt | ✅ | ❌ | ✅ (Add to Home Screen) |

**German voice quality by OS:**
- **macOS** → "Anna" and "Petra" (natural, neural-quality)
- **iOS** → German Siri voice
- **Windows** → "Katja" and "Hedda"
- **Android** → Google German TTS (install from Play Store if missing)
- **Linux** → may need `espeak-ng` or `speech-dispatcher` installed

---

## 🚀 Deploy to Production

**Vercel (recommended — zero config):**

```
1. Push to GitHub
2. vercel.com → New Project → import deutsch-app
3. Environment Variables → ANTHROPIC_API_KEY = sk-ant-api03-...
   (+ SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY for durable rate limiting,
    + ALLOWED_ORIGINS in Production — scripts/b1-vercel-env-setup.sh automates all of it)
4. Deploy — then ./scripts/verify-b1-production.sh runs the live contract battery
```

The `vercel.json` at the root configures the Vite framework preset and registers everything under `api/` as serverless functions.

**What gets deployed:**
- `dist/` — compiled React SPA
- `dist/sw.js` — Workbox service worker (offline caching)
- `dist/manifest.webmanifest` — PWA manifest
- `api/` — Node.js serverless functions (versioned AI endpoints + legacy alias)

---

## 📁 Project Structure

```
deutsch-app/
│
├── api/
│   ├── _lib/                  ← Shared middleware, each with co-located tests:
│   │   ├── handler.js         ← createAiHandler() — the factory every route composes
│   │   ├── validate.js        ← Body validation (model allow-list, shape checks)
│   │   ├── origin.js          ← Origin allow-list (mandatory in production)
│   │   ├── ratelimit.js       ← Per-IP quotas — Supabase-durable, in-memory fallback
│   │   ├── supabase.js        ← Service-role client (server lane only)
│   │   ├── respond.js         ← The error envelope
│   │   └── anthropic.js       ← The upstream forwarder
│   ├── v1/ai/
│   │   ├── chat.js            ← 20 req / 5 min per IP
│   │   ├── deck.js            ← 5 req / hour per IP (strict — deck generation)
│   │   └── grade.js           ← 60 req / 5 min per IP (high-throughput grading)
│   └── chat.js                ← Legacy alias → v1 chat
│
├── supabase/
│   ├── config.toml            ← Local stack config (revoked-by-default Data API)
│   ├── migrations/            ← rate_limits + atomic RPC · five user tables + RLS policies ·
│   │                            explicit Data API grants (anon: nothing; authenticated: own rows)
│   └── tests/rls/             ← Adversarial RLS suite (npm run test:rls)
│
├── docs/
│   ├── api/                   ← Contracts: ai.md (AI lane) · data.md (data lane) · packs.md
│   ├── superpowers/specs/     ← Architecture design notes (multi-language, LanguagePack, backend, streak, …)
│   ├── superpowers/plans/     ← Implementation plans
│   ├── AUDIT_GERMAN_COUPLING.md
│   ├── MAINTENANCE_CHECKLIST.md
│   └── dev-toolkit.md         ← /component shortcut + audit:dead / clean hygiene
│
├── public/
│   ├── favicon.svg            ← Browser tab icon
│   ├── icon-base.svg          ← Source SVG for PWA icons
│   ├── pwa-192.png            ← PWA icon (Android)
│   ├── pwa-512.png            ← PWA icon (splash screen)
│   └── apple-touch-icon.png  ← iOS home screen icon
│
├── scripts/
│   ├── lib/                   ← Dev-toolkit internals: moduleGraph (pure, tested) + collect
│   ├── where.js               ← `npm run where -- <name>` — locate a module + its dependents (also /component)
│   ├── audit-dead.js          ← `npm run audit:dead` — orphan modules (dead code)
│   ├── clean.js               ← `npm run clean` — wipe stale build/dev caches
│   ├── gen-icons.js           ← One-time icon generator (npm i -D sharp && node scripts/gen-icons.js)
│   ├── b1-vercel-env-setup.sh ← Owner-run: wires SUPABASE_* + ALLOWED_ORIGINS into Vercel
│   └── verify-b1-production.sh ← Post-deploy battery: 200s, foreign-Origin 403, 400 envelope
│
├── src/
│   ├── components/
│   │   ├── AccountChip.jsx    ← Header sign-in / account chip
│   │   ├── AlphabetTab.jsx
│   │   ├── ChatTab.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── SplashScreen.jsx
│   │   ├── StatsTab.jsx
│   │   ├── TranslateTab.jsx
│   │   ├── UI.jsx
│   │   ├── VocabTab.jsx
│   │   ├── WelcomeGate.jsx    ← Anonymous-first onboarding gate
│   │   ├── auth/              ← MagicLinkForm
│   │   ├── chat/              ← ChatInput, MessageBubble, TaskPanel, …
│   │   ├── gamification/      ← LevelBadge, GoalRing, BadgeGrid, …
│   │   ├── stats/             ← Heatmap, ReviewFeed, VocabSrsWidget, …
│   │   ├── translate/         ← TileExercise, BlankExercise, TypingExercise, …
│   │   └── ui/                ← Button, Toast, Confetti
│   │
│   ├── data/
│   │   ├── content.js         ← ALPHABET, PRESET_DECKS, SCENARIOS, CHAT_TASKS,
│   │   │                         TRANSLATE_SENTENCES_*, ALPHABET_QUIZ_GROUPS
│   │   └── content.test.js
│   │
│   ├── lib/
│   │   ├── auth.js            ← Supabase Auth (magic-link / OTP) — sole @supabase/supabase-js importer
│   │   ├── claude.js          ← Anthropic API client (dev proxy / prod serverless)
│   │   ├── gamification.js    ← XP, levels, daily goal, achievements
│   │   ├── matching.js        ← Exact / fuzzy answer matching (language-agnostic)
│   │   ├── observability.js   ← Sentry init (errors-only)
│   │   ├── settingsStamp.js   ← settingsUpdatedAt stamping (sync LWW)
│   │   ├── sound.js           ← Web Audio synth effects (correct, level-up, …)
│   │   ├── speech.js          ← SpeechSynthesis wrapper
│   │   ├── srs.js             ← Leitner spaced repetition
│   │   ├── stats.js           ← Event log + review feed helpers
│   │   ├── storage.js         ← localStorage read/write
│   │   ├── sync.js            ← Sync orchestrator (flag-gated by VITE_SYNC_ENABLED)
│   │   ├── sync/              ← adapters · merge (LWW / additive / union) · syncMeta
│   │   ├── theme.js           ← Design tokens
│   │   ├── useSyncStatus.js   ← Sync status hook (pending · lastSyncedAt)
│   │   ├── useWindowWidth.js  ← Responsive hook + breakpoint helpers
│   │   └── utils.js           ← (+ co-located *.test.js throughout)
│   │
│   ├── packs/                ← Multi-language layer (the LanguagePack interface)
│   │   ├── index.js          ← activePack registry
│   │   ├── validate.js       ← LanguagePack shape checker
│   │   └── de/index.js       ← German pack (wraps content.js)
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── test-setup.js
│
├── AGENTS.md                  ← Shared rules for every AI coding agent (Cursor, Claude Code, …)
├── .mcp.json                  ← Project-scoped Supabase MCP server (mirrored in .cursor/mcp.json)
├── .husky/pre-commit          ← Runs lint-staged + `npm test` before every commit
├── .npmrc                     ← legacy-peer-deps=true (eslint-plugin-react peer-dep workaround)
├── .prettierrc                ← Prettier config
├── .vercelignore              ← Keeps api/**/*.test.js from deploying as functions
├── eslint.config.js           ← ESLint flat config (react, react-hooks, react-refresh)
├── vitest.config.js           ← Vitest config (jsdom env, v8 coverage of src/lib + src/data + src/components)
├── vitest.rls.config.js       ← Separate config for the RLS suite (needs Docker — never in pre-commit)
├── vite.config.js             ← Vite config + PWA plugin + dev proxy
└── package.json
```

---

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

Built with [Claude Haiku 4.5](https://www.anthropic.com) &nbsp;·&nbsp; Typography: [Fraunces](https://fonts.google.com/specimen/Fraunces) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

</div>
