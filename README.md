# Deutsch · Sprachschule

> A bold, editorial-style German learning app powered by Claude AI.

Four tabs: a conversational tutor (speech in / speech out), the full alphabet with pronunciation, flashcard decks (preset + AI-generated), and a smart translator with word-by-word grammar breakdown. Tracks a daily streak and learned-word count, all persisted locally.

![preview](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white) ![Claude](https://img.shields.io/badge/Claude-Sonnet_4-d62828)

---

## Quick start

### 1. Get an Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com), create an API key, and add a small amount of credit ($5 is plenty).

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/deutsch-app.git
cd deutsch-app
npm install
```

### 3. Add your API key

```bash
cp .env.example .env
```

Edit `.env` and paste your real key after `VITE_ANTHROPIC_API_KEY=`.

### 4. Run it

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

---

## Features

### 01 · Chat
- Talk to **Anna**, a friendly AI German tutor
- Browser microphone (Web Speech API, Chromium-based browsers only)
- Text-to-speech for every German line, with on-demand replay
- Real-time corrections shown in a separate panel
- Role-play scenarios: free chat, café, meeting people, airport

### 02 · Alphabet
- All 26 letters plus **Ä Ö Ü ß**
- Tap any letter to hear it pronounced with an example word
- Detail card shows the example word and translation

### 03 · Vocab
- Four preset decks: greetings, food, travel, numbers
- Type any topic and let Claude generate a 10-card deck on the fly
- Flip cards, hear pronunciation, mark words as learned
- Progress bar shows your position and which cards you've mastered

### 04 · Translate
- Auto-detects English vs German input
- Returns translation, IPA pronunciation, and a word-by-word table
- Each word includes a brief grammar note (e.g. "noun, masculine", "verb, 1st person")
- Speaker button on each individual word

### Progress tracking
- **Streak counter** — increments when you visit on consecutive days
- **Learned word count** — updates live as you mark cards
- Everything persists in `localStorage`

---

## Tech stack

- **React 18** + **Vite 5** — build tool & dev server
- **lucide-react** — icons
- **Web Speech API** — speech recognition + text-to-speech (no external service)
- **Anthropic API** (Claude Sonnet 4) — tutor, deck generation, translation

---

## How API calls work

The Anthropic API doesn't allow direct browser requests by default (CORS), and exposing your API key in client-side code is dangerous. This project handles both problems by routing all requests through the Vite dev server:

1. The browser hits `/api/anthropic/v1/messages`
2. Vite proxies it to `https://api.anthropic.com/v1/messages`
3. The proxy injects your API key from `.env` server-side

**For production deployment**, you must replace this with a proper backend (an Express server, Cloudflare Worker, Vercel serverless function, etc.) — never deploy this as-is to a static host with the key exposed.

---

## Browser support

| Feature | Chrome / Edge / Arc | Firefox | Safari |
|---------|---------------------|---------|--------|
| Text input + Claude | ✅ | ✅ | ✅ |
| Text-to-speech | ✅ | ✅ | ✅ |
| Speech recognition (mic) | ✅ | ❌ | ⚠️ partial |

German voice quality depends on your OS — macOS ships with high-quality "Anna" and "Petra" voices; Windows has "Katja" and "Hedda".

---

## Project structure

```
deutsch-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AlphabetTab.jsx
│   │   ├── ChatTab.jsx
│   │   ├── TranslateTab.jsx
│   │   ├── UI.jsx           # shared components (Hero, SectionLabel, StatBlock)
│   │   └── VocabTab.jsx
│   ├── data/
│   │   └── content.js       # alphabet, preset decks, scenarios
│   ├── lib/
│   │   ├── claude.js        # API client
│   │   ├── speech.js        # TTS wrapper
│   │   ├── storage.js       # localStorage helpers
│   │   └── theme.js         # design tokens
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Acknowledgments

- AI tutor, deck generation, and translation powered by [Anthropic Claude](https://www.anthropic.com)
- Typography: [Fraunces](https://fonts.google.com/specimen/Fraunces) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
