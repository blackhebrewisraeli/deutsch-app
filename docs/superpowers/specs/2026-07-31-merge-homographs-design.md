# Merge homograph cards — design

Date: 2026-07-31 · Branch: `feat/merge-homographs` · Base: `main` @ `515b480`
Closes: `docs/DEMO_READINESS.md` P2 #18

## Problem

The same German word can appear on several flashcards with different correct
answers. A deck can show `in` twice; in multiple choice, two options can both be
defensible, and the learner has no way to tell which card they are looking at.

Measured over the 4,480 shipped entries, keyed by the German text the learner
actually sees (`article ? article + ' ' + de : de`, the string `resolveCard`
builds at `src/packs/resolve.js:8`):

| | count |
| --- | ---: |
| Cards showing identical German text | 258 groups |
| Extra cards from the duplication | 279 |
| Group sizes | 242 pairs · 12 triples · 3 quads · 1 quint |
| Cross-part-of-speech (e.g. `in` prep + adj) | 162 |
| Same part of speech, noun (e.g. `Tag` day + tag) | 74 |
| Same part of speech, other | 22 |

## What must NOT merge

**52 lemmas are distinguished by gender**, and in German the article *is* the
distinction — they are different words:

```
der Tor    (fool)      vs  das Tor    (gate)
die Leiter (ladder)    vs  der Leiter (leader, conductor)
die Post   (mail)      vs  der Post   (forum post)
der Mensch (human)     vs  das Mensch (pejorative)
```

Merging these would teach a learner something false. They are excluded
structurally rather than by a special case: the grouping key is the *rendered*
German including the article, so `der Tor` and `das Tor` are different keys and
never meet. No exclusion list to maintain.

## Design

### Where

A new pure module `scripts/import-lexicon/mergeHomographs.js`, applied at import
time — consistent with the gloss cleanup, and it keeps `public/lexicon` the one
source of truth with no runtime cost.

**Applied after `disambiguateIds`, deliberately.** Merging earlier would collapse
the id collision that produced `n:tag:day-a-24-hour-period` and rename the
survivor to `n:tag`. Ids key saved learner progress (`learnedWords[card.id]`, and
`srsKey(deckId, id)` in `src/lib/srs.js`), so that would orphan progress on a card
that is not going away. Running after ids are assigned lets the surviving entry
keep exactly the id it has today.

### Grouping and primary selection

Group by rendered German. Within a group, the **primary** is the entry with the
lowest `freqRank` (most frequent sense); ties break on existing order.

The primary keeps its `id`, `pos`, `article`, `de`, `plural`, `ipa`, `cefr` and
`freqRank`.

### The merged answer

`en[0]` becomes the joined union of senses:

1. Order senses by `freqRank`, primary first.
2. For each sense take its first gloss, then that gloss's **first synonym** — the
   text before the first `,` or `;`.
3. Skip any sense whose gloss is meta-linguistic
   (`/\b(form of|inflection of|preterite|abbreviation of|clipping of|nominalization of)\b/i`).
   `nominalization of` was added during implementation, after reading the real
   merged output: without it `die Gleiche` went from a clean `"equality"` to
   `"equality · nominalization of gleich: female equivalent of Gleicher"`.
   The definitional prose Wiktionary writes for function words (`"indicating …"`,
   `"Used to frame a statement …"`) is deliberately *not* skipped — it is the only
   gloss such a word has, and `ein` is accepted as-is below.
4. Deduplicate case-insensitively.
5. Keep at most **2** senses, joined with `" · "`.
6. If every sense was skipped or empty, fall back to the primary's first synonym.

The remaining array entries keep each sense's full gloss, so `card.glosses`
retains the detail.

```
in       → "in"                       both senses' first synonym is "in", deduped
doch     → "though · after all"
da       → "there · since"
der Tag  → "day · tag"
denn     → "for · so"
das Mal  → "time · a mark on the body"
nach     → "after"                    junk sense skipped, not merged in
seit     → "since"                    identical senses collapse
```

Two separator decisions matter and were measured, not guessed:

- **`" · "`, not `"; "`.** Cleaned glosses already contain `,` and `;` internally
  (from `cleanGloss`'s synonym cap), so joining with `"; "` produced soup:
  `doch` read as `"though; yet; but; after all; yet; however"` — six senses on
  sight, two in fact.
- **First synonym per sense, not the whole gloss.** Keeping whole glosses put p90
  answer length at 68 with 98 answers over 40 characters, partly undoing the
  gloss-cleanup work that landed in PR #69. First-synonym gives p90 32 — matching
  the current lexicon-wide p90 — with 15 answers over 40.

| | whole gloss, `"; "` | chosen: first synonym, `" · "` |
| --- | ---: | ---: |
| p50 / p90 / max length | 33 / 68 / 156 | 18 / 32 / 142 |
| answers > 40 chars | 98 | 15 |

The 15 remaining long answers are the encyclopedic-prose senses (`ein` →
`"one · indicating concrete or abstract/metaphorical motion into something"`),
already accepted as-is in the gloss-cleanup design.

### Other fields

- **`verb`:** the primary's; if the primary has none and another sense does, take
  the first that has it. 11 groups mix a verb sense with a non-verb one, and verb
  conjugation is rendered on the card (`formatVerb` in `VocabTab`).
- **`examples`, `tags`:** unioned, primary first, examples deduplicated by `de`.
- **`pos`:** the primary's. `pos` is carried through `resolveCard` but never
  rendered, so a cross-part-of-speech merge costs the learner nothing visible.

## Cost, stated plainly

**279 ids retire.** Progress on each surviving primary card is preserved; a
learner who had learned a *secondary* sense's card loses that flag and its SRS
scheduling. This is inherent to merging rather than a defect — it is what the
change is for — but it belongs in the PR body, not in a later discovery.

Entry count goes **4,480 → 4,201**. Unlike the gloss cleanup there is no
backfill, because merging runs after the top-5000-by-rank pool has been chosen.

## Non-goals

- **Merging gender-distinguished pairs.** Covered above; excluded by the key.
- **Changing `resolveCard` or the flashcard UI.** `en[0]` remains the answer.
- **Changing typed-answer matching.** `fuzzyMatch` still compares the whole
  answer string, so `in` accepts `"in"` and not `"inside"` — as today.
- **Recovering the dropped 3rd+ sense** for the 16 groups with more than two.
  They keep their full glosses in `card.glosses`.

## Testing

- `scripts/import-lexicon/mergeHomographs.test.js` — pure unit tests over the real
  shapes found above: a cross-POS pair (`in`), a same-POS noun pair (`der Tag`),
  identical senses collapsing (`seit`), a junk sense skipped (`nach`), a
  gender-distinguished pair left untouched (`der Tor` / `das Tor`), primary
  selection by `freqRank`, verb inheritance when the primary lacks it, and the
  2-sense cap.
- `src/packs/lexiconSample.test.js` already validates every shipped index row, so
  the regenerated artifacts are checked automatically.
- Full suite, lint and format before commit; `.husky/pre-commit` is never bypassed.

## Verification

After `npm run import:lexicon`:

- entry count 4,201 (± the exact merge count reported by the import)
- zero rendered-German duplicates remain
- the 52 gender pairs all still present as separate entries
- `n:tag:day-a-24-hour-period` still exists, now answering `"day · tag"`
- p90 first-gloss length ≤ 35 and answers over 40 chars ≤ 250
- id churn: ~279 retired, and **0 ids changed for a surviving card**
