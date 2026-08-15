import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { AUTO_DECKS } from './autoDecks';
import { selectRows } from '../lexiconStore';

// Guards the SHIPPED decks against the REAL lexicon index: every auto deck a user
// can click must resolve to real cards. Seven Topic decks once shipped resolving
// to zero because they filtered on tags that do not exist in the imported data —
// this test is what makes that impossible to repeat. Index-level only (no fetch):
// runs the real selectRows() from lexiconStore.js against the real index, so a
// regression in production row-selection (e.g. tag matching) fails this test.
const MIN_CARDS = 40;
const DIR = 'public/lexicon/de';
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
// `has` names a field on the resolved entry, which the index does not carry, so
// honouring it needs the chunks. Read from disk, not fetched — this test stays
// index-and-artifact level with no network. Without this a `has` deck reports
// its pre-filter count (607 where only 580 are answerable) and would look
// covered while proving nothing.
const entries = readdirSync(DIR)
  .filter((f) => /^chunk-\d+\.json$/.test(f))
  .reduce((acc, f) => Object.assign(acc, JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))), {});

const answerableCount = (deck) => {
  const rows = selectRows(index, deck.auto);
  return deck.auto.has ? rows.filter((r) => entries[r.id]?.[deck.auto.has]).length : rows.length;
};

describe('shipped auto decks resolve against the real lexicon', () => {
  it.each(AUTO_DECKS.map((d) => [d.name, d]))(
    '"%s" resolves to at least ' + MIN_CARDS + ' cards',
    (_name, deck) => {
      expect(answerableCount(deck)).toBeGreaterThanOrEqual(MIN_CARDS);
    }
  );

  it('every deck id is unique', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
