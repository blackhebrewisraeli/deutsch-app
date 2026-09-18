import { describe, it, expect } from 'vitest';
import {
  SPARSE_THRESHOLD,
  STARTER_LIMIT,
  MAX_ALLOWLIST,
  indexCardsById,
  resolveTerm,
  starterTermsFromDecks,
  buildChatAllowlist,
  scenariosForLevel,
} from './chatVocab.js';

const termOf = (card) => card.term;

const decks = {
  greetings: [
    { id: 'hi', term: 'hello' },
    { id: 'bye', term: 'goodbye' },
    { id: 'please', term: 'please' },
  ],
  food: [
    { id: 'bread', term: 'bread' },
    { id: 'water', term: 'water' },
  ],
};

describe('resolveTerm', () => {
  const byId = indexCardsById(decks);

  it('uses termOf when the card is in the index', () => {
    expect(resolveTerm('hi', byId, termOf)).toBe('hello');
  });

  it('falls back to the id when the card is missing', () => {
    expect(resolveTerm('custom-word', byId, termOf)).toBe('custom-word');
  });

  it('falls back to the id when termOf is omitted', () => {
    expect(resolveTerm('hi', byId)).toBe('hi');
  });

  it('trims and drops empty ids', () => {
    expect(resolveTerm('  hi  ', byId, termOf)).toBe('hello');
    expect(resolveTerm('   ', byId, termOf)).toBe('');
    expect(resolveTerm(null, byId, termOf)).toBe('');
  });
});

describe('starterTermsFromDecks', () => {
  it('walks decks in object order and stops at the limit', () => {
    expect(starterTermsFromDecks({ decks, termOf, limit: 4 })).toEqual([
      'hello',
      'goodbye',
      'please',
      'bread',
    ]);
  });

  it('returns an empty list when there is no catalog', () => {
    expect(starterTermsFromDecks({})).toEqual([]);
    expect(starterTermsFromDecks()).toEqual([]);
  });
});

describe('buildChatAllowlist', () => {
  it('unions scoped and legacy maps and resolves surface forms', () => {
    const { vocab, sparse, learnedCount } = buildChatAllowlist({
      learnedByDeck: { greetings: { hi: true } },
      learnedWords: { water: true, hi: true },
      decks,
      termOf,
      sparseThreshold: 0,
    });
    expect(learnedCount).toBe(2);
    expect(sparse).toBe(false);
    expect(vocab).toEqual(['hello', 'water']);
  });

  it('sorts stably and caps the list', () => {
    const { vocab } = buildChatAllowlist({
      learnedWords: { zed: true, alpha: true, mid: true },
      sparseThreshold: 0,
      maxTerms: 2,
    });
    expect(vocab).toEqual(['alpha', 'mid']);
  });

  it('mixes in starter terms when the learned set is sparse', () => {
    const { vocab, sparse, learnedCount } = buildChatAllowlist({
      learnedByDeck: { greetings: { hi: true } },
      decks,
      termOf,
      sparseThreshold: 8,
      starterLimit: 4,
    });
    expect(learnedCount).toBe(1);
    expect(sparse).toBe(true);
    expect(vocab).toContain('hello');
    expect(vocab).toContain('goodbye');
    expect(vocab.length).toBeGreaterThan(1);
  });

  it('does not hard-fail when everything is empty', () => {
    const { vocab, sparse, learnedCount } = buildChatAllowlist();
    expect(vocab).toEqual([]);
    expect(sparse).toBe(true);
    expect(learnedCount).toBe(0);
  });

  it('uses the id as the term for custom cards not in the pack', () => {
    const { vocab } = buildChatAllowlist({
      learnedWords: { 'die Sonne': true },
      decks,
      termOf,
      sparseThreshold: 0,
    });
    expect(vocab).toEqual(['die Sonne']);
  });

  it('dedupes case-insensitively across learned and starter', () => {
    const { vocab } = buildChatAllowlist({
      learnedWords: { Hello: true },
      decks,
      termOf,
      starterLimit: 3,
    });
    const hellos = vocab.filter((t) => t.toLowerCase() === 'hello');
    expect(hellos).toHaveLength(1);
  });
});

describe('scenariosForLevel', () => {
  const scenarios = [{ id: 'free' }, { id: 'airport' }, { id: 'coffee' }];
  const chatTasks = {
    free: { a1: [{ task: 'hi' }], b1: [{ task: 'essay' }] },
    airport: { b1: [{ task: 'delay' }] },
    coffee: { a1: [] },
  };

  it('keeps scenarios that have tasks at the classified band', () => {
    expect(scenariosForLevel(scenarios, chatTasks, 'a1').map((s) => s.id)).toEqual(['free']);
    expect(scenariosForLevel(scenarios, chatTasks, 'b1').map((s) => s.id)).toEqual([
      'free',
      'airport',
    ]);
  });

  it('tolerates missing maps', () => {
    expect(scenariosForLevel(null, chatTasks, 'a1')).toEqual([]);
    expect(scenariosForLevel(scenarios, null, 'a1')).toEqual([]);
  });
});

describe('budgets', () => {
  it('keeps the published caps small enough for a system prompt', () => {
    expect(SPARSE_THRESHOLD).toBe(8);
    expect(STARTER_LIMIT).toBe(12);
    expect(MAX_ALLOWLIST).toBe(80);
  });
});
