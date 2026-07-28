# Auto-Decks Grounded in Real Data (P0) — Design

Date: 2026-07-13
Status: Approved (brainstorming) — pending spec review
Tracked as: `docs/DEMO_READINESS.md` P0 items #1 and #2
Depends on: the shipped lexicon (`public/lexicon/`, 4,418 entries) — code-only, no re-import.

## Problem

Two of the three shipped auto-deck families are broken against the real imported
data. Both were written against assumptions before the real import existed.

**#1 — Seven of eight Topic decks resolve to zero cards.** `src/packs/de/autoDecks.js`
filters on invented tags (`travel`, `home`, `people`, `work`, `body`, `nature`, `time`)
that do not occur in the data. Only `food` matches, with 16 entries. A visitor
clicking those chips on the live demo gets an empty deck.

Real tag vocabulary (Wiktionary domain labels, ≥40 entries): `lifestyle` 234,
`sciences` 201, `natural-sciences` 163, `hobbies` 156, `sports` 129,
`physical-sciences` 128, `government` 126, `politics` 111, `mathematics` 100,
`engineering` 98, `business` 78, `law` 59, `military` 57, `war` 57, `games` 54,
`human-sciences` 52, `computing` 48, `medicine` 46, `entertainment` 45.
**3,724 of 4,418 entries (84%) carry no tag at all**, so topic decks can cover at
most ~16% of the lexicon.

**#2 — Frequency decks under-deliver on their names.** "Core 100"
(`{by:'freq', range:[1,100]}`) resolves to **8 cards**; "Top 500" to **114**. The
rule filters on raw Leipzig rank, but the pipeline keeps the top 5,000 *parsed
Wiktextract entries* by rank, which reach down to rank **12,695** — the highest
frequency ranks are function words the filters drop (no article / form-of / no
example). The first 100 kept entries actually span ranks 1–450.

## 1. Frequency decks — a `top` rule

Add an auto rule whose semantics match the deck names:

```js
auto: { by: 'top', count: 100 }   // sort entries by rank ascending, take first N
```

`top` performs no per-entry filtering: it sorts by `freqRank` (nulls last, as the
existing sorts do) and slices `count`. "Core 100" then means *the 100 most frequent
words in this lexicon* and yields exactly 100 cards.

Both resolvers implement it:
- `src/packs/resolve.js` `resolveDeck` — sort + slice over `Object.values(lexicon)`.
- `src/packs/lexiconStore.js` `resolveAutoDeck` — the existing pipeline already
  sorts index rows by rank; `top` skips the `matches()` filter and slices the sorted
  rows before loading chunks (so it still loads only the chunks it needs).

The existing `by:'freq'` range rule is **retained** (tested, and a legitimate way to
express a raw-rank band) — it is simply no longer used by a shipped deck.

## 2. Topic decks — real tags, any-of merging

Extend the `tag` rule so `auto.tag` accepts **a string or an array of strings**
(any-of match). This merges thin, overlapping domain labels into solid decks
without a new rule type. Shipped decks (counts verified against the real index):

| Deck | Tags | Cards |
|---|---|---|
| Lifestyle | `lifestyle` | 234 |
| Science | `sciences`, `natural-sciences`, `physical-sciences`, `human-sciences` | 291 |
| Hobbies & Games | `hobbies`, `games`, `entertainment` | 214 |
| Sports | `sports` | 129 |
| Politics | `politics`, `government`, `military`, `war` | 126 |
| Business & Law | `business`, `law` | 136 |
| Tech | `computing`, `engineering`, `mathematics` | 147 |
| Medicine | `medicine` | 46 |

The eight invented-tag decks are removed. These are subject domains rather than
everyday themes (food/travel/home) because that is what the source data provides;
the group label stays **"Topics"**.

## 3. Regression guard (the load-bearing part)

A data-driven test asserts that **every shipped auto-deck resolves to at least 40
cards against the real `public/lexicon/index.json`**. This is precisely the check
whose absence let seven empty decks reach production, and it fails loudly if a
future import shifts the tag vocabulary or rank distribution.

The threshold is 40 — comfortably below the smallest shipped deck (Medicine, 46)
and far above zero, so it catches collapse without being brittle.

## 4. Testing

- **Resolver units** (fixture-based, as today): `by:'top'` returns the N
  lowest-rank cards in rank order and never exceeds `count`; `by:'tag'` accepts a
  string (existing behaviour, unchanged) and an array (any-of).
- **Population guard**: every entry in `AUTO_DECKS` resolves to ≥40 rows against the
  real index (pure index-level filtering, no fetch needed).
- Existing tests stay green. CEFR decks are untouched.

## 5. Out of scope

CEFR re-banding (DEMO_READINESS P1 #4 — requires a re-import), German-only examples
(P1 #3), any regeneration of `public/lexicon/`. This change is code-only.

## 6. Risks

- **Tag vocabulary is import-dependent.** A future dump could rename domain labels
  and empty these decks again — which is exactly what the §3 guard now catches at
  test time rather than in production.
- **Topic decks cover only ~16% of the lexicon** (84% untagged). Accepted: they are
  a supplementary browse axis, not the primary one; frequency and CEFR decks cover
  the whole lexicon.
