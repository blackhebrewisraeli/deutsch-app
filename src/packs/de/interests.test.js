import { describe, it, expect } from 'vitest';
import { validateLexiconEntry } from '../validate';
import { grammar } from './grammar';
import { dePack } from './index';
import { INTEREST_LEXICON, INTEREST_TOPICS, INTEREST_DECK_DEFS, INTEREST_GROUP } from './interests';

const opts = { grammar, cefrLevels: dePack.meta.cefrLevels };

describe('INTEREST_TOPICS', () => {
  it('ships Sport, Tech/IT, and Musik', () => {
    expect(INTEREST_TOPICS.map((t) => t.id)).toEqual(['sport', 'tech', 'musik']);
    expect(INTEREST_GROUP).toBe('Interests');
  });

  it('each topic names a deck, a UI label, and an English prompt hint', () => {
    for (const topic of INTEREST_TOPICS) {
      expect(topic.label.length).toBeGreaterThan(0);
      expect(topic.icon.length).toBeGreaterThan(0);
      expect(topic.deckId).toBe(`interest-${topic.id === 'musik' ? 'musik' : topic.id}`);
      expect(INTEREST_DECK_DEFS[topic.deckId]).toBeDefined();
      expect(topic.promptHint).toMatch(/^[a-z]/);
    }
  });
});

describe('INTEREST_LEXICON', () => {
  it('every entry key equals its entry.id and validates', () => {
    for (const [id, entry] of Object.entries(INTEREST_LEXICON)) {
      expect(entry.id).toBe(id);
      expect(validateLexiconEntry(entry, opts)).toBe(true);
    }
  });

  it('nouns store the lemma in de and the article+lemma id', () => {
    for (const entry of Object.values(INTEREST_LEXICON)) {
      if (entry.pos === 'noun') {
        expect(`${entry.article} ${entry.de}`).toBe(entry.id);
      } else {
        expect(entry.de).toBe(entry.id);
      }
    }
  });

  it('does not collide with the 40 curated lexicon ids', () => {
    for (const id of Object.keys(INTEREST_LEXICON)) {
      expect(dePack.content.lexicon[id]).toBeUndefined();
    }
  });
});

describe('INTEREST_DECK_DEFS', () => {
  it('each deck has ten resolvable cards', () => {
    for (const def of Object.values(INTEREST_DECK_DEFS)) {
      expect(def.group).toBe(INTEREST_GROUP);
      expect(def.cardIds).toHaveLength(10);
      for (const id of def.cardIds) {
        expect(INTEREST_LEXICON[id]).toBeDefined();
      }
    }
  });

  it('resolved pack decks match the defs and carry de/en/ipa', () => {
    for (const topic of INTEREST_TOPICS) {
      const cards = dePack.content.interestDecks[topic.deckId];
      expect(cards).toHaveLength(10);
      for (const card of cards) {
        expect(card.de.length).toBeGreaterThan(0);
        expect(card.en.length).toBeGreaterThan(0);
        expect(card.ipa.length).toBeGreaterThan(0);
        expect(card.id).toBe(card.de);
      }
    }
  });
});
