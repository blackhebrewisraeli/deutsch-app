# Hören deck group — hear the word, type it

**Status:** design, ready for a plan
**Date:** 2026-08-16
**Branch target:** `main` (currently `1c44384`, 1372 tests)

---

## 1 · What this is

The fifth drill, and the first whose question is **not text**. The app plays a
German word and the learner types what they heard.

`src/lib/speech.js` already wraps the Web Speech API and is used by four
components; no drill uses it. This is the last unused capability the app ships.

**It also fixes a defect in that wrapper that affects those four components
today** — see §2/F1. That fix is a prerequisite, not a bonus: on this drill the
voice *is* the question.

## 2 · The facts that shape this — all verified in the browser

**F1 — voice selection is arbitrary, and lands badly.** `speech.js` does:

```js
const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(base));
```

`.find` takes the **first match in array order**. Measured on macOS with nine
German voices installed, **none marked `default`**:

```
Eddy, Flo, Grandma, Grandpa, Reed, Rocko, Sandy, Shelley, Anna
      ↑ chosen                                          ↑ the standard voice
```

Eddy/Flo/Grandma/Grandpa/Rocko/Shelley are macOS's *novelty* voices. The
selection is not merely suboptimal, it is **incidental** — it depends on array
order, which varies by OS and installed voice set. ChatTab, AlphabetTab,
MessageBubble and CorrectionPanel have all been speaking German in a novelty
voice.

**F2 — the existing test cannot catch F1.** `speech.test.js` stubs
`getVoices()` with exactly one German voice, so any selection rule passes. The
same shape as the gloss bug in #109: a fixture too simple to express the
failure.

**F3 — the drill has real content.** German orthography is shallow but not
transparent. Entries containing a grapheme that cannot be inferred from sound:

| ambiguity | entries | share |
|---|---|---|
| double consonant (`Sonne` vs `Sone`) | 739 | 18% |
| `ei`/`ai` | 556 | 13% |
| umlaut `ä ö ü` | 530 | 13% |
| `ie`/`ih`/`i` | 317 | 8% |
| `v` (sounds like `f`) | 315 | 7% |
| `ß`/`ss` | 69 | 2% |
| **at least one** | **2,159** | **51%** |

Half the vocabulary carries something a listener must *know*, not derive. That
is a real drill, unlike Präsens (#108), whose content was mostly rule-derivable.

**F4 — this drill leaks through almost everything.** The answer is the headword
itself, so every text the card renders is a giveaway:

| CardFace renders | leaks? |
|---|---|
| `display ?? card.de` | **the answer, verbatim** |
| `card.ipa` | **a phonetic transcription — substantially reveals spelling** |
| `card.plural` | **contains the stem** (`Häuser` → `Haus`) |
| `formatVerb(card.verb)` | **contains the stem** |
| `card.examples[0].de` | **usually contains the word itself** |

Every one must go. `conceal` covers `ipa`, `plural` and `verb` today; **examples
is not yet concealable** (`CardFace:118` renders it unguarded).

**F5 — jsdom has no `speechSynthesis`.** `speak()` already guards for it, and
`speech.test.js` stubs the whole API. Component tests for this drill must stub
it too, or assert around it.

## 3 · Design

### 3.1 Fix voice selection first

`speak()` picks a voice by a **declared preference**, not by array order:

```js
// A pack names the voices it wants, best first. Without this the choice is
// whatever `.find` hits first, which on macOS is a novelty voice.
voicePreference: ['Anna', 'Markus', 'Petra', 'Yannick']
```

on `pack.meta` beside `locale`. `speak()` walks the preference list against the
available voices, falls back to the first `default`-flagged voice for the
language, then to the first match — today's behaviour as the last resort, so
nothing regresses where the preference does not apply.

Voice **names** are the only stable handle the Web Speech API offers; there is
no "quality" or "novelty" flag. The list is therefore a pack-level hint that
degrades gracefully, not a guarantee.

`speech.test.js` gains a fixture with several German voices — the case F2 shows
it cannot currently express.

### 3.2 The card becomes a play button

The drill needs a card face with **no text at all**: a large play control, and a
replay. Rather than a second card component, `CardFace` gains one more prop in
the shape it already has:

- `conceal` grows to accept `'examples'`, guarding `CardFace:118` the way `ipa`,
  `plural` and `verb` already are.
- the drill sets `display: () => '🔊'` so the headword slot renders the control
  glyph rather than the word.

**Audio plays automatically on card change**, and a replay button re-triggers it.
Autoplay is right here because the card *is* the audio — a learner who must click
before every question is being taxed, not tested.

### 3.3 Grading

Identical to Plural/Perfekt/Präsens: `exactMatch` against
`pack.validation.target`. The target rules fold `ä → ae` and `ß → ss`, which
matters more here than anywhere else: a learner on a US keyboard who hears
*Häuser* and types `haeuser` is right, and `hauser` is wrong — exactly the
distinction F3 says the drill exists to teach.

No `fuzzyMatch`, no "almost": a misheard consonant is a different word.

### 3.4 Decks

`DECK_GROUPS` gains `'Hören'`; decks generated from the level map as in #108,
named **"A1 Hören" / "A2 Hören" / "B1 Hören"** — distinct from every existing
label, enforced by the name-uniqueness guard from #106.

Selection is `{ by: 'cefr', level, pos: 'noun' }` — nouns only, deliberately.
The audio of a bare infinitive or adjective is fine, but nouns carry the
capital letter, which is itself a spelling rule worth drilling, and it keeps the
decks comparable to Artikel and Plural. Card counts are therefore 607/876/1380
as in #105.

No `markLearned`, for the fifth time and the same reason.

## 4 · Out of scope

- Recording or speech *recognition*. Output only.
- Sentence dictation from `examples`. A different, harder drill.
- Bundling audio files. The Web Speech API is already there and offline-capable;
  shipping recordings would dwarf the 178 KB the fonts cost.
- Any `localStorage` key change.

## 5 · Risks

**The voice is the environment's, not ours.** A machine with no German voice
gets the default voice reading German with the wrong phonetics — worse than
useless for this drill specifically. §6 requires the deck to detect that and say
so rather than silently teaching a mispronunciation.

**Autoplay may be blocked.** Browsers gate audio on user interaction. The first
card of a session may be silent until the learner clicks something. The replay
button is the mitigation and must be obvious, not decorative.

**This drill is more work than the previous four.** They were a table row and a
deck triple. This one changes `speech.js` (used by four shipped components),
adds a `CardFace` guard, introduces autoplay and a replay control, and needs an
audio stub in tests. Worth saying plainly: it is not a fifth copy of #108.

## 6 · Verification

- `speech.test.js` with a **multi-voice** German fixture, asserting the
  preference wins over array order, and that the fallback chain degrades to
  today's behaviour.
- The four existing `speak()` consumers must be unaffected: their tests pass
  untouched.
- The leak checklist as a test: on a Hören card, **none** of the headword, IPA,
  plural, verb lines or example is in the document.
- A test that the keyboard spelling `haeuser` is accepted and `hauser` is not.
- **Browser, with sound**: confirm the audio plays, that it is the preferred
  voice and not a novelty one, that replay works, and that a wrong answer shows
  the word. Confirm the "no German voice" path by filtering the voice list in
  the console.
