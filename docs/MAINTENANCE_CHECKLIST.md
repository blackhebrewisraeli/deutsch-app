# Deutsch App — Maintenance Checklist

Run this checklist after every deployment, dependency update, or model change.
Each check should take under 2 minutes. Full checklist: ~15 minutes.

---

## How to run

Open the **live production URL**: `https://deutsch-app-dusky.vercel.app`

Open browser DevTools (F12) → **Console tab**. Keep it visible throughout.
Any red errors = investigate before marking a check as passed.

---

## 1. Splash Screen

**First-time visit simulation:**
1. Open DevTools → Application → Local Storage → delete all `deutsch-*` keys
2. Hard-reload the page (`Cmd+Shift+R`)

| Check | Expected | Pass? |
|-------|----------|-------|
| German flag (black/red/gold stripes) renders | Three color bands visible | |
| Level picker appears | "Beginner" and "Intermediate" buttons | |
| Click **Beginner** | Enters app, Chat tab active | |
| Reload page | Splash does NOT show again (skipped) | |

---

## 2. Chat Tab — AI Tutor (Anna)

**Standard: Anna sends an opening message automatically. No action needed.**

| Check | Expected | Pass? |
|-------|----------|-------|
| Anna's greeting appears on load | German text + IPA + English translation visible | |
| Correction panel shows "Alles gut!" | Right panel with checkmark | |

**Send a message with a grammar mistake:**
Type: `Ich gehe in die Schule seit drei Jahr.` → press Enter

| Check | Expected | Pass? |
|-------|----------|-------|
| Anna responds | German reply with IPA + English | |
| Correction panel turns red | Shows "NEEDS A FIX" with strikethrough | |
| Correction shows right answer | "drei Jahren" (dative plural) | |
| Explanation appears | Brief English grammar note | |

**Scenario switching:**
Click **Order Coffee** in left panel

| Check | Expected | Pass? |
|-------|----------|-------|
| Chat resets | New opening line about the café | |
| Correction clears | Back to "Alles gut!" | |

**Standard to check all 4 scenarios:** Free Chat, Order Coffee, Meet Someone, At the Airport

---

## 3. Alphabet Tab

Click **02 Alphabet** in the nav.

| Check | Expected | Pass? |
|-------|----------|-------|
| All letters render | A–Z visible in grid (26 letters) | |
| Umlauts present | Ä, Ö, Ü, ß visible (rows 27–30) | |
| Each letter has an example word | Word shown below each character | |
| Click any letter | Audio plays (hear it spoken) | |

---

## 4. Vocab Tab — Flashcards

Click **03 Vocab** in the nav.

**Preset deck:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Greetings deck loads | Card 1/10 showing "Hallo" [ˈhalo] | |
| Click the card | Flips to English ("Hello"), background goes dark | |
| Click again | Flips back to German | |
| Click **NEXT →** | Advances to Card 2/10 | |
| Click **← PREV** | Goes back to Card 1/10 | |
| Click **MARK LEARNED** | Button changes to red "UNMARK", header LEARNED counter +1 | |
| Click **UNMARK** | Counter goes back down | |
| Switch to **Food & Drink** deck | New cards load, counter resets to 1/10 | |

**Custom deck generation:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Type a topic (e.g. `animals`) in the input | — | |
| Click **GENERATE 10 CARDS** | Button shows "GENERATING..." | |
| Wait ~5 seconds | New "✦ Your Deck" appears in sidebar | |
| First card shows German word + IPA | Card with article if noun (e.g. "der Hund") | |
| Flip works on custom cards | English translation shows | |

---

## 5. Translate Tab

Click **04 Translate** in the nav.

**English → German:**
Type: `The weather is beautiful today.` → click **TRANSLATE**

| Check | Expected | Pass? |
|-------|----------|-------|
| German translation appears | "Das Wetter ist heute schön." or similar | |
| IPA pronunciation shown | Phonetic transcription under German text | |
| English echo shown | Original sentence in English section | |
| Word-by-word table appears | Each word with German / English / Grammar Note columns | |
| Audio button on each word | Click any speaker icon → word is spoken | |

**German → English (auto-detect):**
Type: `Ich liebe Schokolade.` → click **TRANSLATE**

| Check | Expected | Pass? |
|-------|----------|-------|
| Direction auto-detected | English result shows "I love chocolate." | |
| Word breakdown appears | "Ich", "liebe", "Schokolade" as rows | |

---

## 6. Persistence & Stats

| Check | Expected | Pass? |
|-------|----------|-------|
| Mark a vocab word as Learned | Header LEARNED counter increments | |
| Reload the page | LEARNED count is still the same (not reset) | |
| STREAK counter shows ≥ 1 | Flame icon with number | |

---

## 7. Console Health Check

At the end of the full checklist run:

| Check | Expected | Pass? |
|-------|----------|-------|
| Open DevTools → Console | Zero red errors | |
| Open DevTools → Network → filter by "api" | `/api/chat` calls return HTTP 200 | |
| No failed network requests | No red rows in Network tab | |

---

## Known Issues / Accepted Limitations

| Issue | Status | Notes |
|-------|--------|-------|
| Alphabet example words are lowercase | Accepted (cosmetic) | German nouns should be capitalized — low priority |
| Speech recognition requires Chrome/Edge | By design | Safari/Firefox don't support Web Speech API |
| Mobile layout (Chat tab) | Not optimised | 3-column layout breaks on narrow screens |

---

## What to do when something fails

| Symptom | First thing to check |
|---------|---------------------|
| API call failed (404) | Vercel dashboard → Functions tab → check `api/chat` is deployed |
| API call failed (401/403) | Vercel → Settings → Environment Variables → `VITE_ANTHROPIC_API_KEY` is set |
| API call failed (model not found) | `src/lib/claude.js` → model ID may be retired; update to current Haiku |
| App blank on load | Check browser console for JS errors; check Vercel deployment logs |
| Splash screen never goes away | Check localStorage: `deutsch-onboarded` key should be set after first visit |

---

## Model Reference (current as of 2026-06)

| Use case | Model ID |
|----------|----------|
| All Claude calls in this app | `claude-haiku-4-5-20251001` |

When Anthropic retires a model, the API returns HTTP 404 with the model name in the error.
Check [console.anthropic.com](https://console.anthropic.com) for the current model list.
