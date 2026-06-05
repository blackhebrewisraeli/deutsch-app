# Deutsch App — Maintenance Checklist

Run this checklist after every deployment, dependency update, or model change.
Each check should take under 2 minutes. Full checklist: ~20 minutes.

---

## How to run

Open the **live production URL**: `https://deutsch-app-dusky.vercel.app`

Open browser DevTools (F12) → **Console tab**. Keep it visible throughout.
Any red errors = investigate before marking a check as passed.

Clear localStorage before a full run to test first-visit behaviour:
DevTools → Application → Local Storage → Right-click → Clear

---

## 0. Onboarding — Splash Screen

1. Clear localStorage and hard-reload (`Cmd+Shift+R`)

| Check | Expected | Pass? |
|-------|----------|-------|
| German flag (black / red / gold stripes) renders | Three colour bands visible | |
| Three level buttons appear | 🌱 Beginner (A1) · 📚 Elementary (A2) · 🎓 Intermediate (B1) | |
| Click **Beginner (A1)** | Enters app, Chat tab active, task panel shows an A1 task | |
| Reload page | Splash does NOT show again (skipped) | |

---

## 1. Chat Tab — Guided Conversation

Navigate to **01 Chat**.

**Task panel (left sidebar):**

| Check | Expected | Pass? |
|-------|----------|-------|
| "C YOUR TASK" panel visible | Red panel with task text | |
| Task text matches level | A1: short one-sentence prompt; B1: multi-sentence scenario | |
| SHOW HINT button (A1/A2 only) | Toggles hint text below the task | |
| No hint button for B1 | Hidden for intermediate level | |

**Anna's greeting:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Opening message appears | German text + IPA + English translation | |
| 🔊 icon plays audio | German TTS spoken aloud | |
| Correction panel shows "Alles gut!" | Right panel with checkmark | |

**Send a message with a grammar mistake:**
Type: `Ich gehe in die Schule seit drei Jahr.` → press Enter

| Check | Expected | Pass? |
|-------|----------|-------|
| Anna responds | German reply with IPA + English | |
| Correction panel turns red | "NEEDS A FIX" with strikethrough | |
| Correct form shown | "drei Jahren" (dative plural) | |
| Explanation shown | Brief English grammar note | |

**Scenario switching:**
Click **Order Coffee** in the left panel

| Check | Expected | Pass? |
|-------|----------|-------|
| Chat resets with café intro | New opening line in German | |
| Task panel resets to task 1 | New task appropriate to scenario + level | |
| Correction clears | Back to "Alles gut!" | |

---

## 2. Alphabet Tab — Listen & Identify

Click **02 Alphabet**.

**Quiz mode (default):**

| Check | Expected | Pass? |
|-------|----------|-------|
| Quiz mode loads by default | 🔊 play button + 4 letter tiles + "WHICH LETTER DID YOU HEAR?" | |
| 🔊 button plays audio | A letter is spoken aloud | |
| Click a correct answer | Gold feedback panel, score increments | |
| Click a wrong answer | Red feedback with correct letter shown | |
| NEXT ROUND → advances | New round with new letter group | |
| Score tracker updates | "ROUND N · SCORE X/Y" updates correctly | |

**Browse mode:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Click 📋 Browse toggle | Full A–Z + Ä/Ö/Ü/ß grid appears | |
| All 30 characters render | 26 + 4 special characters | |
| Example words are capitalised | **Apfel**, **Brot**, **Glück** (not lowercase) | |
| Click any letter | Audio plays, detail panel appears | |
| Toggle back to Quiz | Quiz resumes at current round | |

---

## 3. Vocab Tab — Active Recall

Click **03 Vocab**.

**A1 / A2 — Multiple choice:**

| Check | Expected | Pass? |
|-------|----------|-------|
| German word + IPA shown on card | e.g. "Hallo [ˈhalo]" | |
| 4 English options shown | 2×2 grid of buttons | |
| Click correct option | Gold flash, "N remaining" decrements | |
| Click wrong option | Red feedback, card goes back in queue | |
| Deck complete → banner | "✓ Deck complete" shimmer banner | |

**B1 — Type the meaning:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Text input shown (not button grid) | Input field with "Type the English meaning…" | |
| Type exact answer + Enter | Green "✓ CORRECT", card advances | |
| Type near-correct (1–2 typo) | "≈ ALMOST — CHECK SPELLING", card advances | |
| Type wrong answer | Red "✗ NOT QUITE", card re-queued | |

**Custom deck generation:**

| Check | Expected | Pass? |
|-------|----------|-------|
| Type `animals` → click GENERATE | Button shows "GENERATING..." | |
| Wait ~5 seconds | "✦ Your Deck" appears in sidebar with 10 cards | |
| First card shows German + IPA | e.g. "der Hund [deːɐ̯ hʊnt]" | |

---

## 4. Translate Tab — Exercise Mode

Click **04 Translate**.

**A1 — Word tiles:**

| Check | Expected | Pass? |
|-------|----------|-------|
| English sentence shown | e.g. "I drink water." | |
| Empty answer area shown | Dashed border area, "YOUR ANSWER" label | |
| Word bank shown below | Shuffled German tiles incl. distractors | |
| Click tile → moves to answer area | Tile appears in answer row | |
| Click placed tile → returns to bank | Tile back in word bank | |
| CHECK disabled until tile placed | Button greyed out on load | |
| CHECK → correct | Gold feedback panel + grammar note | |
| CHECK → wrong | Red feedback + correct sentence shown | |
| ⏭ Skip button | Advances without penalty | |

**A2 — Fill the blanks:**

| Check | Expected | Pass? |
|-------|----------|-------|
| German sentence with ___ blanks shown | e.g. "Ich habe ___ Hund." | |
| Tile bank shown | Only blank words + distractors | |
| Click tile fills next blank | Blank fills in left-to-right order | |
| Click filled blank → returns tile | Tile back in bank | |
| CHECK → correct | Gold feedback + note | |

**B1 — Free typing + AI:**

| Check | Expected | Pass? |
|-------|----------|-------|
| English sentence shown | Complex B1-level sentence | |
| Textarea input shown | "Type your translation here…" | |
| Cmd/Ctrl+Enter submits | Sends without clicking CHECK | |
| CHECK calls AI grader | "GRADING..." shown during request | |
| Correct answer → gold panel | AI praise + grammar tip | |
| Wrong answer → red panel | Corrected sentence + error explanation | |

---

## 5. Persistence & Stats

| Check | Expected | Pass? |
|-------|----------|-------|
| Mark a vocab word as Learned | Header LEARNED counter increments | |
| Reload page | LEARNED count persists (not reset) | |
| STREAK shows ≥ 1 | Flame icon with number | |

---

## 6. Mobile Layout

Resize browser to ~375px width (or use DevTools device mode).

| Check | Expected | Pass? |
|-------|----------|-------|
| Header: logo visible, tagline hidden | "Deutsch." visible, "Sprachschule × Est." hidden | |
| Nav: icon-only tabs | Four icons, no text labels | |
| Chat: scenario bar scrolls horizontally | Single row of scenario buttons | |
| Vocab: deck list above flashcard | Single-column stacked layout | |
| Alphabet quiz: 2×2 letter grid | Options visible without horizontal scroll | |
| Alphabet browse: 4-column grid | Fits without overflow | |

---

## 7. Console Health Check

At the end of the full checklist run:

| Check | Expected | Pass? |
|-------|----------|-------|
| DevTools → Console | Zero red errors | |
| Network → filter "api" | `/api/chat` calls return HTTP 200 | |
| No failed network requests | No red rows in Network tab | |

---

## Known Limitations (by design)

| Limitation | Notes |
|------------|-------|
| Speech recognition (mic input) requires Chrome/Edge | Safari/Firefox don't support Web Speech API |
| Audio quiz may not speak on first load in some browsers | Click 🔊 manually to trigger on silent autoplay policy |
| Mobile layout: Chat correction panel hidden when empty | Appears as soon as Anna corrects a mistake |

---

## What to do when something fails

| Symptom | First thing to check |
|---------|---------------------|
| API call failed (404) | Vercel dashboard → Functions → check `api/chat` is deployed |
| API call failed (401/403) | Vercel → Settings → Environment Variables → `VITE_ANTHROPIC_API_KEY` set |
| API call failed (model not found) | `src/lib/claude.js` → model ID may be retired; update to current Haiku |
| App blank on load | Browser console for JS errors; Vercel deployment logs |
| Splash screen never goes away | localStorage: `deutsch-onboarded` key should be set after level pick |
| Tiles / blanks not appearing | Check `src/data/content.js` — `TRANSLATE_SENTENCES_A1/A2` export present |
| Task panel not showing | Check `CHAT_TASKS` export in `content.js`; check `level` prop passed to ChatTab |

---

## Current model reference

| Use case | Model ID |
|----------|----------|
| All Claude calls | `claude-haiku-4-5-20251001` |

When Anthropic retires a model, the API returns HTTP 404 with the model name in the error.
Check [console.anthropic.com/models](https://console.anthropic.com) for the current list.
