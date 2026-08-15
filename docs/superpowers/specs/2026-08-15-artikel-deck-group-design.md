# Artikel deck group — drill noun gender

**Status:** design, ready for a plan
**Date:** 2026-08-15
**Branch target:** `main` (currently `18983be`, 1292 tests)

---

## 1 · What this is

The app ships **2,863 German nouns and every single one carries its article** —
1,165 `die`, 1,135 `der`, 563 `das`, 100% coverage. `resolveCard` preserves that
article as a field on every resolved card.

**Nothing in `src/components/` reads it.** `grep -rn "article" src/components/`
returns nothing.

So the learner is always *shown* the gender, baked into the display form
"das Jahr", and is **never once asked for it**. For German that is the single
highest-value gap in the app: gender is arbitrary, has to be memorised per noun,
and an error cascades into every case ending downstream. The data is perfect and
does no teaching work.

This spec adds an **Artikel** deck group: decks that show a noun bare — "Jahr" —
and ask for der/die/das.

## 2 · The facts that shape this — all verified against the code

**F1 — the index cannot currently filter nouns.** Index rows are exactly
`{ id, rank, cefr, tags, chunk }` (`scripts/import-lexicon/chunk.js:17`). There
is no `pos` and no `article`. `selectRows` filters the index and nothing else,
so as it stands there is no way to select "the nouns" without loading chunks.

**F2 — the id prefix encodes part of speech, but that is the importer's
convention.** Ids are `n:jahr`, `v:gehen`, `prep:in`. Cross-checked across all
4,201 entries: the `n:` prefix agrees with `pos === 'noun'` **4,201 times with
zero disagreements**. But `POS_PREFIX` lives in `scripts/import-lexicon/ids.js`
— the runtime store does not own that convention. See §3.1.

**F3 — deck breadth decides how much of the lexicon gets fetched.**
`resolveAutoDeck` loads exactly the chunks its selected rows reference:

| deck | nouns | chunks touched | bytes |
|---|---|---|---|
| A1 nouns | 607 | 2 of 9 | 0.50 MB |
| A2 nouns | 876 | 4 of 9 | 1.01 MB |
| B1 nouns | 1,380 | 5 of 9 | 1.13 MB |
| **all nouns** | 2,863 | **9 of 9** | **~2.4 MB** |

An "all nouns" Artikel deck would pull the entire lexicon on one tap. The decks
must be scoped. §3.3.

Two things follow. Scoping helps but is not free — B1 still reaches 5 of 9
chunks, so this bounds the fetch rather than making it small. And **every noun
falls inside A1/A2/B1** (0 orphans), so three CEFR decks reach all 2,863 without
a catch-all deck that would defeat the scoping.

**F4 — a new deck id gives separate SRS state for free.**
`srsKey(deckId, id)` is `` `${deckId}:${id}` `` (`src/lib/srs.js:35`). A card
drilled in `artikel-a1` and the same card drilled in `cefr-a1` keep independent
boxes with no work. This is what makes "deck group" the right shape rather than
a mode toggle.

**F5 — the bare lemma does not survive resolution.** `resolveCard` sets
`de: display` where display is `` `${article} ${lemma}` `` — the bare `entry.de`
is overwritten and lost (`src/packs/resolve.js:8–15`). A gender card that
rendered `card.de` would print "das Jahr" and give away its own answer.

**F6 — the articles are already pack data.** `grammar.articles` is
`['der', 'die', 'das']` (`src/packs/de/grammar.js:9`), put there by Phase 1.4.
The exercise reads its choices from the pack and stays language-agnostic.

**F7 — VocabTab is now decomposed.** PR #104 split it into
`src/components/vocab/`, so `ChoiceGrid` and `VerdictPanel` are standalone and a
new exercise type is an additive component rather than another branch in an
807-line function.

## 3 · Design

### 3.1 `pos` goes into the index — not prefix-sniffing

**Decision: add `pos` to index rows in `buildArtifacts`.**

The tempting shortcut is `row.id.startsWith('n:')`, which F2 proves works today
at zero cost. It is rejected: the index exists *precisely so that selection
needs no chunks*, and it already carries `rank`, `cefr` and `tags` for exactly
that reason — `pos` is the same kind of field and belongs beside them. Filtering
on the prefix would put id-format knowledge into `lexiconStore`, which does not
own `POS_PREFIX`; the two would then have to agree forever with nothing checking
that they do. That is the same "two values that must agree" trap Phases 1.4/1.5
kept hitting.

**Cost:** `index.json` 308.3 KB → 360.9 KB (**+52.6 KB, +17%**). It is fetched
once per session under `StaleWhileRevalidate` and is already precached.

**Cache safety:** adding a field does not renumber anything. The chunk/index
skew hazard documented at `lexiconStore.js:96–114` comes from an import that
changes the *entry count* and reshuffles ids across chunks; this changes neither.
A stale cached index simply lacks `pos`, which §3.2 handles by treating a
missing `pos` as "does not match" — an Artikel deck renders empty for one load
and self-heals on revalidation, rather than showing wrong cards.

### 3.2 `pos` is a modifier on existing selectors, not a new `by`

```js
{ by: 'cefr', level: 'A1', pos: 'noun' }
```

`matches()` gains one clause applied *in addition to* whichever `by` rule runs:

```js
if (auto.pos && row.pos !== auto.pos) return false;
```

This composes with every existing selector — `top`, `cefr`, `tag`, `freq` — so
"the 100 most frequent verbs" or "science nouns" come for free later without
another `by` kind. A new `by: 'gender'` would have been a fifth parallel branch
that could not combine with CEFR at all.

`matches()` currently throws on an unknown `by`; that behaviour is unchanged.

### 3.3 Three decks, scoped by CEFR

`DECK_GROUPS` gains `'Artikel'`. `AUTO_DECKS` gains:

| id | name | icon | auto |
|---|---|---|---|
| `artikel-a1` | A1 Nouns | `🟢` | `{ by: 'cefr', level: 'A1', pos: 'noun' }` |
| `artikel-a2` | A2 Nouns | `🔵` | `{ by: 'cefr', level: 'A2', pos: 'noun' }` |
| `artikel-b1` | B1 Nouns | `🟣` | `{ by: 'cefr', level: 'B1', pos: 'noun' }` |

CEFR scoping is both the pedagogically right unit and what bounds the chunk
fetch (F3: 2, 4 and 5 of 9 rather than all 9). **No "all nouns" deck** — it
would pull the whole lexicon, and F3 shows the three levels already reach every
noun without one.

B1 is a 1,380-card deck, which is large for a drill but in line with what the
app already ships (`cefr-b1`, `top-500`); the SRS queue is what makes deck size
tolerable, and `getDueCards` handles it unchanged.

`DeckPicker` already renders every group in `DECK_GROUPS` except `Curated` and
needs **no change**; the group appears because the data does.

### 3.4 The card keeps its bare lemma

`resolveCard` gains one field:

```js
lemma: entry.de,   // bare, before the article is composed into `de`
```

`de` stays exactly as it is, so every existing surface is untouched. "Lemma" is a
universal concept, not a German one, so this does not re-language the resolver.
The Artikel exercise renders `card.lemma`; everything else keeps rendering
`card.de`.

### 3.5 The exercise

New `src/components/vocab/ArticleChoice.jsx` — the same shape as `ChoiceGrid`,
but the options come from `activePack.grammar.articles` rather than from other
cards' glosses, and there is no shuffle: **der/die/das stay in a fixed order**.
Position becomes muscle memory, and reshuffling three buttons every card taxes
recognition without testing anything.

Grading is exact identity against `card.article` — no `fuzzyMatch`, no
`ANSWER` text rules. There are three possible answers and they are pack data;
edit distance has nothing to contribute.

`VerdictPanel` is reused unchanged, with `answer={card.de}` so a wrong guess
shows the full correct form "das Jahr". The SRS verdict buttons behave exactly
as they do for meaning recall.

### 3.6 What the drill does *not* do

**It must not call `markLearned`.** `learnedWords` is keyed by `card.id` alone,
with no notion of which skill was demonstrated — so marking a noun learned for a
correct gender guess would tell the vocab decks the learner knows a word whose
meaning was never asked. Gender and meaning are different skills; the SRS
already keeps them apart by deck id (F4) and that is where the progress lives.

`recordEvent`/`recordItem` are called as normal so the drill shows up in Stats.

## 4 · Regenerating the shipped index

Adding `pos` to `buildArtifacts` fixes the pipeline going forward, but the
**shipped `public/lexicon/de/index.json` also has to gain the field**, and a full
`npm run import:lexicon` means re-downloading Wiktextract + Tatoeba + Leipzig
(multi-GB) and risks the artifacts changing for unrelated reasons.

The chunks already carry `pos` for every entry, so the index can be rebuilt from
what is already on disk. The plan should:

1. Change `buildArtifacts` so the pipeline is correct.
2. Regenerate `index.json` from the existing chunks.
3. **Prove the regenerated file is the old one plus `pos`** — every existing row,
   in the same order, with `id`/`rank`/`cefr`/`tags`/`chunk` byte-identical, and
   `pos` matching the chunk entry's `pos` for all 4,201 rows.

Step 3 is the gate. If it does not hold, stop — do not hand-edit the artifact.

## 5 · Out of scope

- **A gender *mode* over arbitrary decks.** Deck group first, per the decision on
  2026-08-15; a mode multiplies SRS state by skill and needs its own design.
- **Plural drilling.** 92% of nouns have `plural` and it is just as unused, but it
  is a second feature — note it, do not build it here.
- **Adding `article` to the index.** Selection does not need it; it arrives with
  the chunk entry.
- **Re-importing the lexicon.** §4 explicitly avoids this.
- **Any `localStorage` key change.** The new decks reuse the existing `srs` map
  under new deck ids.

## 6 · Risks

**The stale-index window.** A returning user with a cached index lacking `pos`
sees an empty Artikel deck until revalidation. Mitigated by §3.1's fail-closed
rule and by the fact that `StaleWhileRevalidate` refreshes on the same load;
worth one line in the PR body. The alternative — treating missing `pos` as a
match — would render verbs in a gender drill, which is worse.

**Three-option guessing.** 33% of correct answers are luck, against 25% for the
four-way meaning grid. The SRS absorbs this the same way it does elsewhere: a
guessed card comes back. Not worth adding a fourth decoy option that does not
exist in the language.

**`die` is over-represented** (1,165 vs 1,135 vs 563), so always answering "die"
scores ~41%. Worth knowing when reading Stats; not worth rebalancing the decks,
which would misrepresent the language.

## 7 · Verification

- Existing suite green with **no changes to any existing test** — the additive
  shape should make that achievable; if an existing test needs editing, the
  design is wrong, stop and re-open this spec.
- `selectRows` unit tests for the `pos` modifier, including composition with
  `cefr` and the fail-closed missing-`pos` case.
- Component tests for `ArticleChoice` co-located per convention.
- The §4 step-3 index proof, as a test over the shipped artifacts so it keeps
  holding after future imports.
- Exercise it in the browser: pick A1 Nouns, confirm the card shows the **bare**
  lemma, answer wrong, confirm the verdict shows the full "das Jahr", confirm
  the word is **not** marked learned.
