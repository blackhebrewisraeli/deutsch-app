import { useState, useEffect } from 'react';
import { activePack } from '../../packs';
import { AUTO_DECKS } from '../../packs/de/autoDecks';
import { resolveAutoDeck } from '../../packs/lexiconStore';

/**
 * Resolves a lexicon-derived deck. Preset and custom decks are already in
 * memory, so this only fires for ids in AUTO_DECKS and reports nothing for the
 * rest.
 *
 * The cancelled flag matters: switching decks quickly enough leaves an earlier
 * fetch in flight, and without it the slower response wins and shows cards from
 * the deck the learner already left.
 *
 * @param {string} deckId
 * @returns {{ isAuto: boolean, cards: object[]|null, loading: boolean,
 *             error: boolean, retry: () => void }}
 */
export default function useAutoDeck(deckId) {
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isAuto = AUTO_DECKS.some((d) => d.id === deckId);

  useEffect(() => {
    const def = AUTO_DECKS.find((d) => d.id === deckId);
    if (!def) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setCards(null);
    resolveAutoDeck(def, activePack.grammar, activePack.meta.id)
      .then((resolved) => {
        if (!cancelled) setCards(resolved);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, retryCount]);

  return { isAuto, cards, loading, error, retry: () => setRetryCount((c) => c + 1) };
}
