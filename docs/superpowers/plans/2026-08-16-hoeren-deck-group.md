# Hören Deck Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hören deck group that plays a German word and asks the learner to type it — and first fix the voice selection it depends on, which four shipped components also depend on.

**Architecture:** `speak()` picks a voice from a pack-declared preference instead of array order; `CardFace` learns to conceal `examples`, completing the conceal set; the `DRILLS` table gains an optional `speak` column and VocabTab plays it on card change with a replay control.

**Tech Stack:** React 18 + Vite 5, inline styles from `src/lib/theme.js`, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-16-hoeren-deck-group-design.md`

## Global Constraints

- **Inline styles only**, tokens from `src/lib/theme.js`.
- **Tests use `globals: false`** — import from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **No existing test may change.** Task 1 touches `speech.js`, which four shipped
  components use — `speech.test.js`'s five cases passing **untouched** is the
  proof the fallback chain preserves today's behaviour. **If one fails, the
  preference is overriding where it should defer.**
- **Do not re-run `npm run import:lexicon`.**
- Open a PR against `main`; never push to `main`.

## What already exists — do not rebuild

- `speak(text, lang, rate)` and its five tests.
- `conceal` on `CardFace` (a list, since #106) guarding `ipa`, `plural`, `verb`.
- The `DRILLS` table (#108) — this is a row plus one new optional column.
- **A replay-button precedent**: `AlphabetTab.jsx:185` has
  `aria-label="Play letter audio again"` with the `Volume2` icon. Follow it
  rather than inventing a control.
- `validate.js` checks the required `meta` keys are strings and does not reject
  unknown ones, so `voicePreference` needs no validator change.

## File Structure

| file | change |
|---|---|
| `src/lib/speech.js` | voice chosen by preference, not array order |
| `src/lib/speech.test.js` | multi-voice fixture (additive) |
| `src/packs/de/index.js` | `meta.voicePreference` |
| `src/components/vocab/CardFace.jsx` | `examples` becomes concealable |
| `src/components/vocab/CardFace.test.jsx` | new case (additive) |
| `src/components/vocab/drills.js` | `Hören` row + `speak` column |
| `src/components/VocabTab.jsx` | autoplay on card change + replay button |
| `src/packs/de/autoDecks.js` | `Hören` group, three decks from the level map |
| `src/components/VocabTab.test.jsx` | new `describe` (additive) |

---

### Task 1: choose the voice deliberately

**Files:** `src/lib/speech.js`, `src/lib/speech.test.js`, `src/packs/de/index.js`

**Why first:** the drill is unusable on a novelty voice, and this fixes four
shipped components on the way.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/speech.test.js` — note the fixture has **several** German
voices, which is exactly what the existing one lacks:

```js
describe('voice selection with several voices available', () => {
  // The real macOS list: eight novelty voices, then the standard one. `.find`
  // takes array order and lands on "Eddy"; the pack asks for "Anna".
  const MANY = [
    { lang: 'en-US', name: 'Samantha' },
    { lang: 'de-DE', name: 'Eddy' },
    { lang: 'de-DE', name: 'Flo' },
    { lang: 'de-DE', name: 'Grandma' },
    { lang: 'de-DE', name: 'Anna' },
  ];

  it('prefers a voice the pack names over whatever comes first', async () => {
    getVoices.mockReturnValue(MANY);
    const { speak } = await import('./speech');
    speak('Wasser');
    expect(lastUtterance.voice.name).toBe('Anna');
  });

  it('walks the preference list in order', async () => {
    getVoices.mockReturnValue([
      { lang: 'de-DE', name: 'Eddy' },
      { lang: 'de-DE', name: 'Markus' },
    ]);
    const { speak } = await import('./speech');
    speak('Wasser');
    // 'Anna' is absent, so the next preference wins — not Eddy.
    expect(lastUtterance.voice.name).toBe('Markus');
  });

  it('falls back to a default-flagged voice when no preference matches', async () => {
    getVoices.mockReturnValue([
      { lang: 'de-DE', name: 'Eddy' },
      { lang: 'de-DE', name: 'Rocko', default: true },
    ]);
    const { speak } = await import('./speech');
    speak('Wasser');
    expect(lastUtterance.voice.name).toBe('Rocko');
  });

  it('falls back to the first match — today\\'s behaviour — as the last resort', async () => {
    getVoices.mockReturnValue([
      { lang: 'de-DE', name: 'Eddy' },
      { lang: 'de-DE', name: 'Flo' },
    ]);
    const { speak } = await import('./speech');
    speak('Wasser');
    expect(lastUtterance.voice.name).toBe('Eddy');
  });
});
```

- [ ] **Step 2: Run to verify the first three fail**

Run: `npx vitest run src/lib/speech.test.js`

Expected: the first three FAIL (all pick "Eddy"), the fourth PASSES — it pins
today's behaviour, which must survive.

- [ ] **Step 3: Declare the preference**

In `src/packs/de/index.js`, beside `locale`:

```js
    locale: 'de-DE',
    // The Web Speech API exposes no quality or novelty flag, so the only stable
    // handle is the voice NAME. Without this, speak() takes whatever `.find`
    // hits first, which on macOS is a novelty voice ("Eddy") while the standard
    // German voice ("Anna") sits last in the list. Best first; a name that is
    // absent is skipped.
    voicePreference: ['Anna', 'Markus', 'Petra', 'Yannick', 'Helena'],
```

- [ ] **Step 4: Implement the chain**

In `src/lib/speech.js`, replace the single `find` with:

```js
/**
 * The voice to use for a language, best first:
 *   1. a name the pack asked for,
 *   2. a voice the platform flags as default,
 *   3. the first match — the behaviour before this existed.
 *
 * Names are the only stable handle the Web Speech API offers; there is no
 * quality flag. So this is a hint that degrades, not a guarantee.
 */
function pickVoice(voices, base, preference = []) {
  const forLang = voices.filter((v) => v.lang?.startsWith(base));
  for (const name of preference) {
    const hit = forLang.find((v) => v.name === name);
    if (hit) return hit;
  }
  return forLang.find((v) => v.default) ?? forLang[0];
}
```

and in `speak`:

```js
  const voice = pickVoice(
    window.speechSynthesis.getVoices(),
    lang.split('-')[0],
    activePack.meta.voicePreference
  );
  if (voice) u.voice = voice;
```

**`activePack.meta.voicePreference` may be undefined** for a pack that declares
none — the `= []` default handles it. Do not make it required.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/speech.test.js`

Expected: all nine PASS, **the original five unchanged**. If the "leaves the
voice unset when no voice matches" case fails, `pickVoice` is returning
something for an empty list — `forLang[0]` on `[]` is `undefined`, which is
correct; check the caller's `if (voice)` guard survived.

- [ ] **Step 6: Confirm the four consumers still pass, then commit**

Run: `npx vitest run src/components/ChatTab* src/components/AlphabetTab* src/components/chat/`

```bash
git add src/lib/speech.js src/lib/speech.test.js src/packs/de/index.js
git commit -m "fix(speech): choose the voice deliberately, not by array order"
```

---

### Task 2: the conceal set is completed

**Files:** `src/components/vocab/CardFace.jsx`, `src/components/vocab/CardFace.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to `CardFace.test.jsx`:

```js
  it('conceals the example sentence when a drill asks for the word itself', () => {
    // The listening drill's answer IS the headword, and a Tatoeba example
    // almost always contains it.
    const card = { ...noun, examples: [{ de: 'Ich esse Brot.' }] };
    const { rerender } = render(<CardFace card={card} learned={false} mobile={false} />);
    expect(screen.getByText('Ich esse Brot.')).toBeInTheDocument();

    rerender(<CardFace card={card} learned={false} mobile={false} conceal={['examples']} />);
    expect(screen.queryByText('Ich esse Brot.')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails, then implement**

`CardFace.jsx:118` currently reads `{card.examples?.length > 0 && (`. Change to:

```jsx
      {card.examples?.length > 0 && !hidden('examples') && (
```

Run: `npx vitest run src/components/vocab/CardFace.test.jsx` — expected PASS
with the existing cases untouched.

- [ ] **Step 3: Commit**

```bash
git add src/components/vocab/CardFace.jsx src/components/vocab/CardFace.test.jsx
git commit -m "feat(vocab): CardFace can conceal the example sentence"
```

---

### Task 3: the drill row and the audio prompt

**Files:** `src/components/vocab/drills.js`, `src/components/VocabTab.jsx`

- [ ] **Step 1: Add the row**

In `drills.js`:

```js
  Hören: {
    kind: 'typed',
    // The answer IS the headword, so everything the card knows gives it away:
    // IPA is a phonetic transcription, the plural and verb lines carry the stem,
    // and the example almost always contains the word. Only the audio remains.
    display: () => '🔊',
    conceal: ['ipa', 'plural', 'verb', 'examples'],
    speak: (card) => card.de,
    label: () => 'Type what you hear',
    placeholder: () => '…',
    expected: (card) => card.de,
    answer: (card) => card.de,
  },
```

`speak` is a new optional column. Update the table's header comment to document
it, and extend `drills.test.js`'s "homogeneous shape" case to allow it.

- [ ] **Step 2: Play on card change**

In `VocabTab.jsx`, import `speak` from `'../lib/speech'` and add an effect after
the queue effects:

```js
  // The audio IS the question for a listening drill, so it plays on arrival
  // rather than waiting for a click — a learner who must press play before
  // every card is being taxed, not tested. speak() is a no-op where
  // speechSynthesis is missing, which is also what makes this safe in jsdom.
  useEffect(() => {
    if (drill?.speak && card) speak(drill.speak(card));
    // card.id is the identity that matters; re-speaking on unrelated re-renders
    // would interrupt the learner mid-word.
  }, [drill, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Autoplay may be blocked before the first user gesture** (spec §5). Clicking the
deck to enter is that gesture, so in practice the first card is fine — but the
replay button is the mitigation and must be present, not decorative.

- [ ] **Step 3: The replay control**

Render above the typed input when the drill has audio, following
`AlphabetTab.jsx:185`:

```jsx
              {drill?.speak && !answered && (
                <button
                  type="button"
                  onClick={() => speak(drill.speak(card))}
                  aria-label="Play the word again"
                  style={{ ...BUTTON.tile, width: '100%', marginBottom: SPACE[3] }}
                >
                  <Volume2 size={18} aria-hidden="true" /> PLAY AGAIN
                </button>
              )}
```

Import `Volume2` from `lucide-react` as `MessageBubble` does. Check `BUTTON.tile`
exists in the theme before using it; if not, match whatever `AlphabetTab`'s
replay button uses.

- [ ] **Step 4: Verify nothing else moved**

Run: `npx vitest run src/components/`

The other four drills must be untouched — `drill?.speak` is undefined for them,
so neither the effect nor the button fires.

- [ ] **Step 5: Commit**

```bash
git add src/components/vocab/drills.js src/components/vocab/drills.test.js src/components/VocabTab.jsx
git commit -m "feat(vocab): the Hören drill plays its question"
```

---

### Task 4: decks, the leak test, browser, PR

- [ ] **Step 1: The decks**

`DECK_GROUPS` gains `'Hören'`; three decks from the level map as in #108:

```js
  // Hören — hear it, type it. Nouns only: they carry the capital letter, which
  // is itself a spelling rule worth drilling, and it keeps the decks comparable
  // to Artikel and Plural. 607 / 876 / 1,380 cards.
  ...['A1', 'A2', 'B1'].map((level, i) => ({
    id: `hoeren-${level.toLowerCase()}`,
    name: `${level} Hören`,
    icon: ['🟢', '🔵', '🟣'][i],
    group: 'Hören',
    auto: { by: 'cefr', level, pos: 'noun' },
  })),
```

Run `npx vitest run src/packs/de/` — `autoDecks.test.js` and the population test
must pass **unedited**.

- [ ] **Step 2: The leak test — the whole point**

Append a `describe` to `VocabTab.test.jsx` using `mockLexiconFetch`. Mock the
speech module so the effect is observable:

```js
vi.mock('../lib/speech', () => ({ speak: vi.fn() }));
```

**Check whether a module-level `vi.mock` conflicts with the existing
`vi.mock('../lib/claude')` block at the top of the file** — add it there rather
than inside the describe, and confirm the other suites still pass.

Cover, on an A1 Hören card:

1. **none** of the headword, IPA, plural, verb lines or example is in the
   document — the leak checklist as an assertion;
2. `speak` was called with the card's `de` on arrival;
3. the replay button calls `speak` again;
4. typing the word grades correct; typing a plausible mishearing grades wrong;
5. the keyboard spelling of an umlaut is accepted (`haeuser` for `Häuser`) —
   this is the drill's whole point, per spec §3.3.

- [ ] **Step 3: Prove the concealment**

Drop `conceal` from the Hören row and confirm the leak test fails naming the
field. Restore.

- [ ] **Step 4: Browser, with sound**

```bash
npm run build
```

Start `prod-preview`; **unregister the service worker and clear caches first**.

Then A1 Hören, and confirm:

1. audio plays on arrival, and it is **not** a novelty voice — check with
   `speechSynthesis.getVoices().find(v => v.name === 'Anna')` and by ear;
2. the card shows **only** the play glyph — no word, no IPA, no example;
3. PLAY AGAIN re-speaks;
4. a correct answer grades correct with no LEARNED badge; the verdict shows the
   word;
5. **the no-German-voice path**: stub `getVoices` to return only English in the
   console and confirm the drill still functions rather than throwing.

- [ ] **Step 5: PR**

Non-draft, targeting `main`. In the body: the voice-selection defect and that it
affected four shipped components; the 51% spelling-ambiguity measurement; the
full leak checklist and that this drill conceals everything; that autoplay is
deliberate; and that `speech.test.js`'s original five passed untouched.

---

## Self-Review

**Spec coverage.** §3.1 → Task 1. §3.2 → Tasks 2 and 3. §3.3 → Task 4 Step 2's
umlaut case. §3.4 → Task 4 Step 1. §6 → Task 4 Steps 2–4.

**Task 1 is the risky one**, not the drill. It changes a module four shipped
components import. The five existing tests passing untouched is the proof, and
the fourth new test deliberately pins *today's* behaviour as the last fallback
so the chain cannot silently change what happens where no preference applies.

**Two things this plan does not know.** Whether `BUTTON.tile` is the right token
for a full-width replay button (Task 3 Step 3 says check), and whether a
module-level `vi.mock` for speech disturbs the existing suites (Task 4 Step 2
says check). Both are cheap to verify and expensive to assume.

**The honest risk.** Verifying "it is not a novelty voice" by ear is not
something a test can do. Task 4 Step 4 is the only place that judgement happens,
and if the voice still sounds wrong the fix is the preference list in the pack,
not the code.
