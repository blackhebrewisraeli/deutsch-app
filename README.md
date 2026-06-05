<div align="center">

<br/>

<sup>S P R A C H S C H U L E &nbsp;×&nbsp; E S T .&nbsp; 2 0 2 6</sup>

# Deutsch·

### *A guided German learning app — AI tutor, exercise-driven practice, installable PWA*

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
  &nbsp;
  <img alt="License" src="https://img.shields.io/badge/License-MIT-7a6e5c?style=flat-square"/>
</p>

<p>
  <a href="#-learning-levels"><b>Levels</b></a> &nbsp;·&nbsp;
  <a href="#-features"><b>Features</b></a> &nbsp;·&nbsp;
  <a href="#-german-grammar--vocabulary-coverage"><b>Grammar Coverage</b></a> &nbsp;·&nbsp;
  <a href="#️-tech-stack"><b>Tech Stack</b></a> &nbsp;·&nbsp;
  <a href="#-quick-start"><b>Quick Start</b></a> &nbsp;·&nbsp;
  <a href="#-deploy-to-production"><b>Deploy</b></a>
</p>

<br/>

![Splash screen — German flag onboarding](docs/screenshot-splash.png)

![Chat tab — AI tutor Anna](docs/screenshot-chat.png)

<br/>

</div>

---

## What is this?

**Deutsch · Sprachschule** is an exercise-driven German learning app that runs in the browser and installs as a PWA. It does not wait for you to know what to do — it gives you a task, you respond, and it tells you whether you got it right.

The app covers **three CEFR proficiency levels** (A1 · A2 · B1) across four learning modules: guided conversation, alphabet recognition, vocabulary active recall, and translation exercises. Every mode adapts to your chosen level automatically.

All AI features call **Claude Haiku 4.5** through a server-side proxy — your API key never touches the browser.

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
  "correct": true,
  "corrected": "Trotz des Regens haben wir den Spaziergang genossen.",
  "message": "Perfect. Note: 'trotz' always takes genitive — des Regens, not dem Regen."
}
```

When the **built-in sentence bank** (10 sentences per level) is exhausted, Claude generates 5 fresh sentences on demand and appends them — the exercise never runs out.

---

### Progress tracking

The header always shows two stats, persisted in `localStorage`:

- 🔥 **Streak** — opens the app on consecutive days → streak increments
- ✓ **Learned** — counts vocabulary cards answered correctly across all decks

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
| Build tool | **Vite 5** | Dev server, API proxy, fast HMR |
| AI | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Tutor, grading, deck generation, translation |
| Speech synthesis | **SpeechSynthesis API** | Native German TTS — no external service |
| Speech recognition | **Web Speech API** | Microphone input in Chat — Chrome/Edge only |
| Icons | **lucide-react** | Consistent SVG icon set |
| Typography | **Fraunces** (display) + **JetBrains Mono** (labels) | Editorial serif + technical mono |
| Design tokens | `src/lib/theme.js` | Centralised colours, type scale, spacing, component composites |
| Persistence | **localStorage** | Streak, learned words, chosen level — no backend |
| Linting | **ESLint 10** (flat config) + `react-hooks/exhaustive-deps` | Catches stale closures, missing deps, unused vars |
| Formatting | **Prettier 3** | Consistent code style, enforced on every commit |
| Pre-commit | **Husky + lint-staged** | Runs ESLint + Prettier automatically before every `git commit` |
| PWA | **vite-plugin-pwa** + Workbox | Installable on iOS/Android, offline-capable static assets |
| Responsive | `useWindowWidth` hook | Live viewport width → inline style breakpoints (mobile < 640px) |
| Deployment | **Vercel** | Static SPA + `/api/chat.js` serverless function |

**No CSS framework. No database. No authentication. No third-party tracking.** The only external call is to the Anthropic API.

---

## ⚙️ How It Works

### The API proxy — keeping your key safe

In **development**, Vite proxies `/api/anthropic` → `https://api.anthropic.com` and injects your key server-side:

```
Browser               Vite dev server              Anthropic API
   │                        │                            │
   │  POST /api/anthropic/  │                            │
   │  v1/messages           │                            │
   │  ─────────────────────►│                            │
   │                        │  x-api-key: [from .env]    │
   │                        │  ──────────────────────── ►│
   │                        │◄───────────────────────────│
   │◄───────────────────────│                            │
```

In **production** (Vercel), `/api/chat.js` is a Node.js serverless function that reads `VITE_ANTHROPIC_API_KEY` from Vercel's environment and proxies the request server-side. The key never appears in the browser bundle.

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
System: You are a German grader. Respond ONLY with JSON: { correct, corrected, message }
        Set correct:true if grammatically valid and meaning preserved.

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

## ⚡ Quick Start

**Prerequisites:** Node.js 20+ (see `.nvmrc`), an Anthropic API key ([get one here](https://console.anthropic.com))

```bash
# 1. Clone
git clone https://github.com/blackhebrewisraeli/deutsch-app.git
cd deutsch-app

# 2. Install
npm install

# 3. Add your API key
cp .env.example .env
# Edit .env → VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# 4. Start dev server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**.

**Available scripts:**

```bash
npm run dev          # Start Vite dev server (with API proxy)
npm run build        # Production build (generates service worker)
npm run preview      # Preview the production build locally
npm run lint         # ESLint across src/
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier across src/
npm run format:check # Verify formatting without writing
```

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
3. Environment Variables → VITE_ANTHROPIC_API_KEY = sk-ant-api03-...
4. Deploy
```

The `vercel.json` at the root configures the Vite framework preset and registers `/api/chat.js` as a serverless function automatically.

**What gets deployed:**
- `dist/` — compiled React SPA
- `dist/sw.js` — Workbox service worker (offline caching)
- `dist/manifest.webmanifest` — PWA manifest
- `api/chat.js` — Node.js serverless function (Anthropic proxy)

---

## 📁 Project Structure

```
deutsch-app/
│
├── api/
│   └── chat.js                ← Vercel serverless function (Anthropic proxy)
│
├── public/
│   ├── favicon.svg            ← Browser tab icon
│   ├── icon-base.svg          ← Source SVG for PWA icons
│   ├── pwa-192.png            ← PWA icon (Android)
│   ├── pwa-512.png            ← PWA icon (splash screen)
│   └── apple-touch-icon.png  ← iOS home screen icon
│
├── scripts/
│   └── gen-icons.js           ← One-time icon generator (npm i -D sharp && node scripts/gen-icons.js)
│
├── src/
│   ├── components/
│   │   ├── AlphabetTab.jsx    ← Audio quiz mode + browse grid
│   │   ├── ChatTab.jsx        ← Guided conversation, task panel, speech I/O, corrections
│   │   ├── SplashScreen.jsx   ← First-visit level picker (A1 / A2 / B1)
│   │   ├── TranslateTab.jsx   ← Exercise mode: tiles (A1) / blanks (A2) / typing+AI (B1)
│   │   ├── UI.jsx             ← Shared components: Hero, SectionLabel, StatBlock
│   │   └── VocabTab.jsx       ← Active recall: multiple choice (A1/A2) / type (B1)
│   │
│   ├── data/
│   │   └── content.js         ← Alphabet, preset decks, scenarios, sentence banks,
│   │                             task prompts, quiz groups
│   │
│   ├── lib/
│   │   ├── claude.js          ← Anthropic API client (dev proxy / prod serverless)
│   │   ├── speech.js          ← SpeechSynthesis wrapper
│   │   ├── storage.js         ← localStorage read/write
│   │   ├── theme.js           ← Design tokens: COLORS, FONTS, FONT_SIZE, BUTTON, CARD, TEXT…
│   │   ├── useWindowWidth.js  ← Responsive hook: live viewport width + isMobile() / isTablet()
│   │   └── utils.js           ← shuffle(arr), levenshtein(a, b)
│   │
│   ├── App.jsx                ← Root layout, tab navigation, streak/learned stats
│   └── main.jsx
│
├── .husky/pre-commit          ← Runs lint-staged before every commit
├── .prettierrc                ← Prettier config
├── eslint.config.js           ← ESLint flat config (react, react-hooks, react-refresh)
├── vercel.json                ← Framework config + serverless function registration
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
