<div align="center">

<br/>

<sup>S P R A C H S C H U L E &nbsp;×&nbsp; E S T .&nbsp; 2 0 2 5</sup>

# Deutsch·

### *An editorial-style German learning app — AI tutor, smart flashcards, live translation*

<p>
  <img alt="React" src="https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB"/>
  &nbsp;
  <img alt="Vite" src="https://img.shields.io/badge/Vite_5-646CFF?style=flat-square&logo=vite&logoColor=white"/>
  &nbsp;
  <img alt="Claude" src="https://img.shields.io/badge/Claude_Sonnet_4-D62828?style=flat-square"/>
  &nbsp;
  <img alt="Web Speech API" src="https://img.shields.io/badge/Web_Speech_API-16110B?style=flat-square"/>
  &nbsp;
  <img alt="License" src="https://img.shields.io/badge/License-MIT-7a6e5c?style=flat-square"/>
</p>

<p>
  <a href="#-features"><b>Features</b></a> &nbsp;·&nbsp;
  <a href="#-quick-start"><b>Quick Start</b></a> &nbsp;·&nbsp;
  <a href="#%EF%B8%8F-tech-stack"><b>Tech Stack</b></a> &nbsp;·&nbsp;
  <a href="#%EF%B8%8F-how-it-works"><b>How It Works</b></a> &nbsp;·&nbsp;
  <a href="#-deploy-to-production"><b>Deploy</b></a>
</p>

<br/>

![Splash screen — German flag onboarding](docs/screenshot-splash.png)

![Chat tab — AI tutor Anna](docs/screenshot-chat.png)

<br/>

</div>

---

## What is this?

**Deutsch · Sprachschule** is a full-featured German language learning app that runs entirely in the browser. It combines four independent learning modules under one editorial, Bauhaus-inspired interface — bold German flag palette (black · red · gold · white), Fraunces serif headings, and monospace labels.

On first visit, a dramatic full-screen splash with the German flag colours greets you and asks you to choose your level — **Beginner** (A1–A2) or **Intermediate** (A2–B1). Anna, the AI tutor, adapts her language complexity accordingly.

Every AI-powered feature — the conversation tutor, the vocabulary generator, the smart translator — calls **Claude Sonnet 4** via a secure server-side proxy, keeping your API key out of the browser at all times.

---

## ✦ Features

<details>
<summary><b>&nbsp;01 · Chat — Talk to Anna, your AI tutor</b></summary>
<br/>

![Splash screen](docs/screenshot-splash.png)

*First visit: choose your level on the German flag splash screen*

![Chat tab](docs/screenshot-chat.png)

Anna is a friendly German tutor who lives inside Claude Sonnet 4. She speaks back to you using the browser's native text-to-speech engine, accepts voice input from your microphone (Chrome / Edge / Arc), corrects your German in real time, and stays in character across four role-play scenarios.

**Scenarios:**

| Icon | Name | Setting |
|:---:|---|---|
| ◆ | Free Chat | Open conversation — any topic |
| ☕ | Order Coffee | At a Berlin café |
| ✶ | Meet Someone | Small talk and introductions |
| ✈ | At the Airport | Check-in and asking for directions |

**How corrections work:**

Every reply you send is evaluated. If you make a mistake, a panel appears on the right side of the screen:

```
⚠  NEEDS A FIX
─────────────────────────────────────────────
YOU SAID   →   Ich bin gehen
CORRECT    →   Ich gehe            [ HEAR IT ]

"gehen" is the infinitive. Use the conjugated
form "gehe" for "I go."
─────────────────────────────────────────────
```

If your German is flawless, the same panel shows:  **✓ Alles gut! No mistakes to fix.**

**How to use:**
- Type your message and press `Enter`, **or**
- Click the **mic button** and speak German directly
- Click the 🔊 icon on any of Anna's messages to replay her voice

</details>

---

<details>
<summary><b>&nbsp;02 · Alphabet — Das Alphabet</b></summary>
<br/>

![Alphabet tab](docs/screenshot-alphabet.png)

An interactive 6-column grid of all **30 German letters** — the standard 26 plus **Ä, Ö, Ü, ß**. The four special characters are displayed on a slightly deeper background so they stand out.

Click any tile to:
- Hear it **spoken aloud** with a native-quality German TTS voice
- See an **example word** (*Apfel, Brot, Glück, Straße…*)
- Read its **English translation**

The selected letter expands into a full-width detail card with the letter rendered at 180px — bold, red, unmissable.

</details>

---

<details>
<summary><b>&nbsp;03 · Vocab — Wortschatz (Flashcards)</b></summary>
<br/>

![Vocab tab](docs/screenshot-vocab.png)

Flashcard-style vocabulary practice. Four curated decks are built-in, and you can generate any custom deck via Claude.

**Preset decks:**

| Deck | Cards | Highlights |
|---|:---:|---|
| Greetings | 10 | Hallo, Guten Morgen, Auf Wiedersehen… |
| Food & Drink | 10 | das Brot, der Kaffee, die Milch… |
| Travel | 10 | der Bahnhof, links, Wo ist...? |
| Numbers | 10 | eins through zehn |

**AI-generated decks:** Type any topic — *"weather", "animals", "at the doctor's", "colours"* — and Claude builds a 10-card deck on the fly, with German articles for nouns and IPA pronunciation.

**Each card shows:**
- Front: German word / phrase + IPA pronunciation
- Back: English translation (click to flip)

**Controls:**
- Click card → flip
- 🔊 → hear the word pronounced
- **MARK LEARNED** → persists to `localStorage` + updates the counter in the header
- Progress bar at the top: red = current card, dark = learned, light = not yet

</details>

---

<details>
<summary><b>&nbsp;04 · Translate — Übersetzer (Smart Translator)</b></summary>
<br/>

![Translate tab](docs/screenshot-translate.png)

A translator that auto-detects whether you're typing **English or German** and returns far more than just a translation.

**For every query you get:**

1. The translated text
2. IPA pronunciation of the German version
3. A word-by-word grammar breakdown table:

| German | English | Grammar note |
|---|---|---|
| Ich | I | personal pronoun, 1st person singular |
| gehe | go | verb, present tense, 1st person singular |
| in | into | preposition + accusative |
| die | the | definite article, feminine accusative |
| Stadt | city | noun, feminine |

Every word in the table has its own 🔊 speaker button for individual pronunciation.

**Keyboard shortcut:** <kbd>⌘ Cmd</kbd> + <kbd>Enter</kbd> (Mac) &nbsp;/&nbsp; <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (Windows)

</details>

---

<details>
<summary><b>&nbsp;Progress Tracking — Streak & Learned Words</b></summary>
<br/>

The header always shows two stats:

- 🔥 **Streak** — increments when you open the app on consecutive days. Skip a day and it resets to 1.
- ✓ **Learned** — counts how many vocabulary cards you've marked as learned across all decks.

Both are stored in `localStorage` — no account, no server, no sign-up.

</details>

---

## ⚡ Quick Start

**Prerequisites:** Node.js 18+, an Anthropic API key ([get one here](https://console.anthropic.com) — ~$5 of credit lasts a long time)

```bash
# 1. Clone the repo
git clone https://github.com/blackhebrewisraeli/deutsch-app.git
cd deutsch-app

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
```

Now open `.env` and replace the placeholder with your real API key:

```
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here
```

```bash
# 4. Start the development server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** — you're ready.

> 💡 **Running costs:** A 30-minute session (chat + a few translations + a generated deck) typically costs **$0.01–0.03**. Claude Sonnet 4 is very affordable for personal use.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **React 18** | Component model, hooks, state |
| Build tool | **Vite 5** | Fast dev server + API proxy |
| AI | **Claude Sonnet 4** | Tutor, deck generation, translation |
| Speech input | **Web Speech API** | Browser-native, no external service |
| Text-to-speech | **SpeechSynthesis API** | Browser-native, no external service |
| Icons | **lucide-react** | Crisp, consistent icon set |
| Typography | **Fraunces + JetBrains Mono** | Editorial serif + technical mono |
| Persistence | **localStorage** | No backend needed |
| Styling | **Inline design tokens** | Zero CSS framework, full control |

No database. No authentication. No third-party analytics. The only external call is to the Anthropic API — and even that is proxied through Vite's server so the key never touches the browser.

---

## ⚙️ How It Works

<details>
<summary><b>The API proxy — why your key stays safe</b></summary>
<br/>

The Anthropic API blocks direct browser requests (CORS policy). This project routes every API call through the **Vite dev server**, which injects your key server-side before forwarding to Anthropic:

```
Browser                    Vite dev server               Anthropic API
   │                             │                              │
   │  POST /api/anthropic/       │                              │
   │        v1/messages          │                              │
   │  ────────────────────────► │                              │
   │                             │  POST /v1/messages           │
   │                             │  x-api-key: [from .env]      │
   │                             │  ────────────────────────── ►│
   │                             │                              │
   │                             │       200 + JSON             │
   │                             │ ◄──────────────────────────  │
   │        200 + JSON           │                              │
   │ ◄──────────────────────────│                              │
```

Your `VITE_ANTHROPIC_API_KEY` is read from `.env` **on the server**, injected into the proxy request, and never sent to the browser.

> ⚠️ **For production:** The Vite proxy only works in development. When deploying to Vercel, Netlify, etc., you must add a serverless function that proxies the Anthropic request server-side. See the [Deploy section](#-deploy-to-production).

</details>

<details>
<summary><b>Claude prompt design — how each feature talks to the AI</b></summary>
<br/>

Each of the three AI-powered features uses a different prompt strategy:

**Chat (Anna):**
Claude is instructed to respond with **strict JSON only** — a `de` field (German reply), `ipa` (pronunciation), `en` (English translation), and an optional `correction` object if the user made a mistake. Conversation history is passed on every request so Anna remembers the context of the session.

```json
{
  "de": "Ich möchte einen Kaffee, bitte.",
  "ipa": "[ɪç ˈmœçtə ˈaɪ̯nən kaˈfeː ˈbɪtə]",
  "en": "I'd like a coffee, please.",
  "correction": null
}
```

**Vocab generation:**
A single-shot prompt asking for a JSON array of exactly 10 cards, each with `de`, `en`, and `ipa`. No conversation history. Fast and cheap.

**Translation:**
A single-shot prompt returning a structured object with `sourceLang`, `german`, `english`, `ipa`, and a `words` array for the grammar table.

All three features defensively strip markdown code fences (` ```json ... ``` `) before `JSON.parse()`, since Claude occasionally wraps output in them despite instructions.

</details>

---

## 🌐 Browser Support

| Feature | Chrome / Edge / Arc | Firefox | Safari |
|---|:---:|:---:|:---:|
| Text input + Claude | ✅ | ✅ | ✅ |
| Text-to-speech | ✅ | ✅ | ✅ |
| Microphone / speech recognition | ✅ | ❌ | ⚠️ partial |

Speech recognition uses `SpeechRecognition` / `webkitSpeechRecognition` — a Chromium feature. Firefox doesn't support it; Safari has partial support.

**German voice quality by OS:**
- **macOS** → ships with "Anna" and "Petra" (natural, high-quality)
- **Windows** → "Katja" and "Hedda"
- **Linux** → may need `espeak-ng` or similar installed

---

## 🚀 Deploy to Production

The easiest zero-config option is **Vercel**:

1. Push to GitHub *(already done if you're reading this)*
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `deutsch-app`
3. Under **Environment Variables**, add:
   ```
   VITE_ANTHROPIC_API_KEY = sk-ant-api03-...
   ```
4. Click **Deploy** — done in ~30 seconds

Your app will be live at `https://deutsch-app-xxx.vercel.app`.

> ⚠️ **Security note for public deployments:** Vite's `VITE_*` variables are embedded in the client bundle at build time. This is fine for a personal-use app. If you make it public and want to protect your API key from being extracted from the bundle, add a Vercel serverless function at `/api/chat.js` that holds the key and proxies the request, then update `src/lib/claude.js` to call `/api/chat` instead of `/api/anthropic/v1/messages`.

---

## 📁 Project Structure

```
deutsch-app/
│
├── src/
│   ├── components/
│   │   ├── AlphabetTab.jsx    ← Letter grid + detail card
│   │   ├── ChatTab.jsx        ← AI tutor, speech I/O, corrections
│   │   ├── TranslateTab.jsx   ← Smart translator + grammar table
│   │   ├── UI.jsx             ← Shared: Hero, SectionLabel, StatBlock
│   │   └── VocabTab.jsx       ← Flashcard decks + AI generator
│   │
│   ├── data/
│   │   └── content.js         ← Alphabet data, preset decks, scenarios
│   │
│   ├── lib/
│   │   ├── claude.js          ← Anthropic API client
│   │   ├── speech.js          ← Text-to-speech wrapper
│   │   ├── storage.js         ← localStorage read/write helpers
│   │   └── theme.js           ← Design tokens (colors, fonts)
│   │
│   ├── App.jsx                ← Root layout, tab navigation, stats
│   └── main.jsx
│
├── .env.example               ← Copy to .env and add your key
├── vite.config.js             ← Vite config + API proxy setup
└── package.json
```

---

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

Built with [Claude Sonnet 4](https://www.anthropic.com) &nbsp;·&nbsp; Typography: [Fraunces](https://fonts.google.com/specimen/Fraunces) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

</div>
