# Deck progress indicator — design

Date: 2026-07-29 · Branch: `fix/deck-progress-indicator` · Base: `main` @ `ce2e7b7`

## Problem

`VocabTab` renders one fixed-width dot per card in the active deck,
unconditionally (`src/components/VocabTab.jsx` ~line 459):

```jsx
{activeDeck.map((_, i) => (
  <div key={i} style={{ width: 26, height: 8, borderRadius: RADIUS.pill, ... }} />
))}
```

The dot strip sits in a `display: flex; justify-content: space-between` row, so it
is the only unbounded child and it dictates the page width. The indicator was
designed when every deck held 10 cards. The app now ships a 4,424-word lexicon
exposed through 13 auto decks, so opening any large deck blows out the layout.

Measured on https://deutsch-app-dusky.vercel.app at a 1274px viewport:

| Deck      | Dots | Page `scrollWidth` | vs viewport |
| --------- | ---: | -----------------: | ----------: |
| Greetings |   10 |             normal |        fine |
| Core 100  |  100 |            3,551px |        2.8x |
| B1        | 2212 |           69,023px |         54x |

B1 also mounts 2,212 needless DOM nodes.

Deck sizes in play:

- 4 curated decks (`src/packs/de/decks.js`): 10 cards each.
- 1 generated "Your Deck": 10 cards.
- 13 auto decks (`src/packs/de/autoDecks.js`): Core 100 = 100, Top 500 = 500,
  CEFR A1 = 885 / A2 = 1,327 / B1 = 2,212, 8 topic decks at 46–291.

## What must be preserved

The dots encode a real signal: green = the card is in `learnedWords`, neutral =
not yet. Whatever replaces them at scale must still convey per-deck progress.

## Approach: threshold swap

Small decks keep the dot strip — it reads well at 10 cards and is part of the
app's texture. Large decks get a compact bar plus a count.

Rejected alternatives:

- **Always bar + counter.** One code path, no threshold constant, but it throws
  away a detail that costs nothing at 10 cards.
- **Compressed dots** (cap at ~20, each dot a bucket). Keeps one visual
  language, but a partially-filled bucket is ambiguous and it is the most code
  for the least clarity.

## Component

Extract the right-hand side of the progress row into a presentational component,
`src/components/ui/DeckProgress.jsx`, alongside the other UI primitives.

```
DeckProgress({ cards, learnedWords })
```

- `cards` — the active deck array (each card has an `id`).
- `learnedWords` — the id → truthy map already threaded through `VocabTab`.

It owns the threshold decision and returns `null` for an empty deck.
`VocabTab` renders `<DeckProgress cards={activeDeck} learnedWords={learnedWords} />`
in place of the inline `.map`. Nothing else in `VocabTab` changes.

## Behaviour

`DOT_THRESHOLD = 12`.

**`cards.length <= 12` — dot strip (unchanged output).** One pill per card:
`width: 26, height: 8, borderRadius: RADIUS.pill`, gap 5,
`background: learnedWords[card.id] ? COLORS.green : '#e7dcae'`. 12 covers the
four 10-card curated decks and the 10-card generated deck with headroom; the
smallest auto deck is 46, so no auto deck can fall below it.

**`cards.length > 12` — bar + count.** A 120px track (`#e7dcae`,
`RADIUS.pill`, height 8) with a `COLORS.green` fill at `learned / total`, and a
mono label `N / M LEARNED` (`FONTS.mono`, `FONT_SIZE.tag`,
`LETTER_SPACING.caps`, `COLORS.mute`) — matching the "cards remaining" label
opposite it in the same row. Constant DOM cost: 3 nodes at any deck size.

The bar carries `role="progressbar"` with `aria-valuenow` (learned),
`aria-valuemin={0}`, `aria-valuemax` (total) and an `aria-label`, so the signal
reaches assistive tech as well (AGENTS.md a11y baseline).

## Mobile guard

The 10-dot strip is ~305px wide (10 × 26 + 9 × 5). On a 375px viewport, next to
the "10 cards remaining" label, that is already tight. The dot strip container
gets `minWidth: 0` and each dot `flex: '0 1 26px'`, so dots shrink rather than
force the row wider than its container. To be verified empirically at 375px,
not by arithmetic.

## Testing

New `describe('deck progress')` block in `src/components/VocabTab.test.jsx`:

1. A 10-card curated deck renders 10 dots and no `progressbar`.
2. The Core 100 auto deck (fixture-backed, reusing the existing fetch mock over
   `src/packs/__fixtures__/lexicon/`) renders a `progressbar` and no dot strip.
3. `aria-valuenow` / `aria-valuemax` reflect `learnedWords` and deck size.

Dots get a stable hook for querying (`data-testid="deck-progress-dot"`); the bar
is queried by `role="progressbar"`.

The existing `describe('auto deck loading')` tests are untouched and must stay
green.

## Verification

- `npm test`, `npm run lint`, `npm run format:check` all pass (pre-commit runs
  lint-staged + the full suite; never bypassed).
- Dev-server check that the B1 deck no longer widens the page: page
  `scrollWidth` equals `clientWidth` at 1274px **and** at 375px.

## Documentation

`docs/DEMO_READINESS.md`:

- Add this bug as a new P0 item and tick it once fixed.
- Add a separate, unticked P1 item for the raw-Wiktionary-gloss content problem
  (flashcard answers such as "ARCHAIC FORM OF STANDEN, FIRST/THIRD-PERSON PLURAL
  PRETERITE OF STEHEN"). It needs its own design pass in the import pipeline
  (`scripts/import-lexicon/parseWiktextract.js`) plus an import re-run, and is
  explicitly out of scope here.
- Tick items #3, #4 and #6, which landed in PRs #64 and #65 but are still shown
  open.

## Out of scope

- Any change to `public/lexicon/` (canonical, byte-reproducible).
- Gloss cleanup in the import pipeline.
- The "N cards remaining" label on the left of the row.
