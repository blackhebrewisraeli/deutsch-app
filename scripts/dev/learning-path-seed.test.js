import { describe, it, expect } from 'vitest';
import {
  DECK_ID,
  LEVEL_KEY,
  STATE_KEY,
  TUTORIAL_KEY,
  foodDeck,
  learningPathSeed,
  srsKey,
} from './learning-path-seed.js';
import { activePack } from '../../src/packs/index.js';

describe('learningPathSeed', () => {
  it('targets Food & Drink rather than the Vocab default greetings deck', () => {
    const seed = learningPathSeed();
    expect(DECK_ID).toBe('food');
    expect(seed.deckId).toBe('food');
    expect(Object.keys(activePack.content.decks)[0]).toBe('greetings');
    expect(seed.cards).toBe(activePack.content.decks.food);
    expect(seed.cards[0].id).toBe('das Brot');
  });

  it('leaves one card unlearned so deck-unfinished can name that deck', () => {
    const seed = learningPathSeed();
    expect(seed.remainingCount).toBe(1);
    expect(seed.learnedCards).toHaveLength(seed.cards.length - 1);
    expect(seed.remainingCards).toEqual([seed.cards[seed.cards.length - 1]]);
    expect(seed.recommendation.test('1 card left in your deck')).toBe(true);

    const blob = JSON.parse(seed.localStorage[STATE_KEY]);
    expect(blob.learnedByDeck.food[seed.remainingCards[0].id]).toBeUndefined();
    expect(blob.learnedWords[seed.remainingCards[0].id]).toBeUndefined();
    expect(Object.keys(blob.learnedByDeck.food)).toHaveLength(9);
    expect(blob.learnedWords[seed.learnedCards[0].id]).toBe(true);
    expect(blob.srs[srsKey('food', seed.remainingCards[0].id)].nextDue).toBeGreaterThan(Date.now());
    expect(blob.srs[srsKey('greetings', 'Hallo')]).toBeTruthy();
    expect(blob.daily).toBeTruthy();
    expect(blob.gamification.goal).toBe(50);
  });

  it('writes only keys the app already persists', () => {
    const seed = learningPathSeed();
    expect(STATE_KEY).toBe('deutsch-app-state-v1');
    expect(TUTORIAL_KEY).toBe('deutsch-tutorial-completed');
    expect(LEVEL_KEY).toBe('deutsch-level');
    expect(Object.keys(seed.localStorage).sort()).toEqual(
      [
        'deutsch-app-state-v1',
        'deutsch-level',
        'deutsch-onboarded',
        'deutsch-tutorial-completed',
        'deutsch-welcome-dismissed',
      ].sort()
    );
    expect(srsKey('food', 'das Brot')).toBe('food:das Brot');
  });

  it('exposes the resolved food deck the smoke will click through', () => {
    const cards = foodDeck();
    expect(cards.length).toBeGreaterThanOrEqual(4);
    for (const card of cards) {
      expect(card.id).toBeTruthy();
      expect(card.de).toBeTruthy();
      expect(card.en).toBeTruthy();
    }
  });
});
