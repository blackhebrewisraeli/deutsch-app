# Chat UX redesign — conversation first

**Status:** design, pending owner visual approval. **Do not implement until approved.**
**Date:** 2026-09-18
**Branch:** `cursor/chat-ux-redesign-design-7ed1`
**Audited against:** live Chat at `npm run dev` (no AI backend). Correction and waiting states were exercised with a page-local `fetch` mock; error used the real 404 from missing `/api`.

This is a Chat-tab layout and hierarchy change. Header, nav, model routing, auth, storage, quotas, and CEFR/vocab gating stay as they are.

---

## 1 · Goal

Conversation is the primary activity: it is obvious what to practice, German is comfortable to read, the composer is easy to write in, and corrections sit on the turn they belong to. Deutsch. identity (ivory ground, charcoal/gold/flag-red, Fraunces wordmark and headings, Plus Jakarta Sans body, JetBrains Mono labels and IPA) stays.

---

## 2 · Audit (current)

Desktop grid today (`ChatTab.jsx`): `280px minmax(0, 1fr) 320px` once `width >= bp.wide` (720). At a 1280 viewport with 32px page padding that leaves **~568px** for the thread between a 280px scenario rail and a 320px correction column.

| State | What the live UI does | Pain vs goal |
| --- | --- | --- |
| Open (Free Chat) | Greeting in a gold Fraunces bubble with IPA + EN always on. Right column is an empty card, `minHeight: 240`, copy **Alles gut! / No mistakes to fix**. A/B/C section badges. | Grades a turn that has not happened. Empty card steals width. |
| Scenario + task | Selecting Order Coffee swaps greeting and the red **Your Task** card. Left rail also holds the 2×2 model picker and a Tip card. Task + tip often clip below the fold. | Secondary chrome is a full column. Conversation stays the leftover track. |
| Waiting | `Anna tippt ●●●` in the thread. Correction column does not change. | Fine; keep. |
| Correction | Last fix lands in a large red **B Correction** panel (`YOU SAID` / `CORRECT` / explain / HEAR IT), visually detached from the learner bubble. | Correction is a place, not a turn. |
| Error | Tutor bubble: `Entschuldigung, ein Fehler.` + IPA + `Sorry — API call failed (404: {})`. Empty **Alles gut!** still showing. | Error is in-thread (good). Empty “no mistakes” next to a failed turn is wrong. |
| Mobile 375 | Single column. Scenario is a horizontal scroller (good). **Empty correction hides** (good). Model tiles + red task + tip **stack above** the thread, so the greeting is below the fold. Composer mic is 56×56 and SEND is a labelled press-button; the field truncates to `Schreib auf`. | Conversation is not the first activity. Writing is squeezed. |

A/B/C markers are live: `SectionLabel` on Scenario (A) and Correction (B); TaskPanel paints its own **C**. They do not aid the task.

Reference captures of the **current** live app (not the proposal):

- [Desktop, correction present](../mocks/current-chat-desktop-correction.png)
- [Desktop, error + empty “Alles gut!”](../mocks/current-chat-desktop-error.png)
- [Mobile 375, coffee — thread below the fold](../mocks/current-chat-mobile-coffee.png)

---

## 3 · Layout proposal

### Desktop (`width >= bp.wide`)

Drop the third column. Grid becomes:

```
220px minmax(0, 1fr)
```

At 1280 that is **~972px** of conversation (~70% wider than today). Side rail holds only:

1. **Scenario** — vertical radio list, name + icon, no uppercase description, no A badge, no extra card shadow wrapping a second frame.
2. **Current task** — compact flag-red block (assignment, not error). Task text fully visible. Hint remains a disclosure. No C badge.
3. **Modell** — existing `ModelPicker compact` unchanged in behaviour; quieter hosting only.

Tip card goes away. One italic helper under the composer is enough: *Anna corrects as you go.*

The conversation column is **not** a second card-in-a-card. Hairline + surface is enough; drop `SHADOW.card` on the thread frame.

### Mobile (`< bp.wide`)

Keep one column, but **reorder** so the thread is the first tall thing:

1. Scenario chips (already the mobile picker).
2. One-line task strip: `Task 1 · Order a coffee` + Hint.
3. Conversation.
4. Composer.
5. Modell as a collapsed disclosure *below* the thread (or still in the rail on desktop only). Do not change `ModelPicker`’s API.

Empty correction stays omitted (already true).

### Composer (both)

Input takes the row. Mic and send shrink to **40×40** icon buttons (`aria-label` already exists). Send is the arrow only — drop the `SEND` label and the 24px horizontal padding. `minWidth: 0` on the field stays.

---

## 4 · Interactions

### Corrections — on the turn, not in a panel

`correction` is still the JSON field on the tutor reply. ChatTab should **attach it to that user turn** (the message that was graded), not keep a single sidebar value.

| Condition | UI |
| --- | --- |
| No graded turn yet | Nothing. No card, no check, no “Alles gut!”. |
| Reply with `correction` | Compact cue under **that** learner bubble: `Needs a fix · {fixed}`. Button/disclosure, `aria-expanded`. |
| Cue expanded | Original (struck), fixed (body, hear control), explain (body italic). Same content as today’s panel. |
| Reply with no `correction` | Optional 1-line cue under that turn (`No fix this time`), auto-quiet, never a 240px panel. |

Retire `CorrectionPanel` from the ChatTab grid. Logic can move to a small `InlineCorrection` rendered from `MessageList` / `MessageBubble`.

Waiting stays `Anna tippt`. Error stays an in-thread tutor bubble; do not invent a “no mistakes” state beside it.

### German first; EN and IPA on request

Tutor (and greeting) bubbles:

- **German** is the only default line — Plus Jakarta Sans, ~17px / 1.5. Fraunces is for headings (wordmark, scenario names), not message bodies.
- **Speak** stays next to the German line.
- **EN** and **IPA** are separate, keyboard-reachable toggles (`aria-expanded`, `aria-controls`). IPA still uses `TEXT.ipa` (JetBrains Mono; θ/χ coverage). EN uses body italic.
- Learner bubbles are German only (they already are).

Collapsed is the default after this change. Existing tests that expect IPA/EN always in the document need to assert the controls and the expanded state instead.

---

## 5 · Visual system (keep / drop)

Keep: ivory `--c-ground`, gold tutor fill with `accentOn`, ink learner fill, flag-red **only** for “the app is asking you” (task), error-red **only** for a real fix, Fraunces headings, body sans, mono labels/IPA, `minmax(0, 1fr)`, existing focus ring.

Drop on Chat: A/B/C badges, empty correction card, Tip card frame, press-shadow stacking on mic/send/thread/correction, Fraunces 20px as the message face, always-on IPA/EN.

Do not add a UI library. Do not replace fonts.

---

## 6 · Acceptance criteria (from the owner brief)

1. Desktop conversation column is substantially wider than today’s leftover `1fr` between 280+320.
2. Scenario + task live in a compact secondary area; they no longer compete as equal columns with the thread.
3. A correction appears next to the learner message it refers to, with expandable detail.
4. Before any graded reply, the UI does **not** say there are no mistakes.
5. Composer input is the dominant width; mic and send are small icon actions.
6. German is the default visible message; EN and IPA are progressive disclosure and accessible.
7. Message body face is Plus Jakarta Sans; headings stay Fraunces; IPA stays JetBrains Mono via `TEXT.ipa`.
8. A/B/C markers and surplus frames/shadows are gone from Chat.
9. Header, nav, model-picker **behaviour**, API contracts, auth, storage, quotas, and level/vocab gating are untouched.
10. `npm test`, `npm run lint`, `npm run format:check` still pass after the later implementation PR.

---

## 7 · Files likely to change (after approval only)

Verified with `npm run where`. Blast radius is Chat-local except `App.jsx` importing `ChatTab` (do not edit App).

| File | Role |
| --- | --- |
| `src/components/ChatTab.jsx` + `.test.jsx` | Grid, correction state attached to turns, drop sidebar panel, reorder mobile. |
| `src/components/chat/ScenarioPicker.jsx` + `.test.jsx` | Compact list; drop `SectionLabel` A. |
| `src/components/chat/TaskPanel.jsx` + `.test.jsx` | Compact task; drop C; mobile one-line strip. |
| `src/components/chat/CorrectionPanel.jsx` + `.test.jsx` | Remove from layout; replace with inline cue. |
| `src/components/chat/InlineCorrection.jsx` + `.test.jsx` | **New** — cue + expanded detail. |
| `src/components/chat/MessageBubble.jsx` + `.test.jsx` | Body face; EN/IPA disclosure; optional inline correction slot. |
| `src/components/chat/MessageList.jsx` + `.test.jsx` | Pass per-turn correction; keep typing indicator. |
| `src/components/chat/ChatInput.jsx` + `.test.jsx` | 40×40 icon mic/send; field takes the row. |

**Leave alone unless a Chat import forces it:** `WelcomeBanner.jsx` (first-visit only), `ModelPicker.jsx` (keep compact API), `src/components/UI.jsx` `SectionLabel` (Stats still uses A/B/C), `App.jsx`, packs, `/api`, storage keys.

---

## 8 · Out of scope

Implementing this layout; API/JSON contract; auth, sync, quotas; model routing; CEFR/vocab gating; new fonts or CSS libraries; header/nav; production Supabase; merging.

---

## 9 · Mockups (proposed)

Static HTML using light-mode tokens and vendored faces: [chat-ux-redesign.html](../mocks/chat-ux-redesign.html)

- [Desktop ~1280](../mocks/chat-ux-redesign-desktop.png)
- [Mobile ~375](../mocks/chat-ux-redesign-mobile.png)
