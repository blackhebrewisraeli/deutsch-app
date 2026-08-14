import { useState, useEffect, useRef, useMemo } from 'react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../lib/theme';
import { callClaude } from '../lib/claude';
import { loadState } from '../lib/storage';
import { activePack } from '../packs';
const { decks: PRESET_DECKS } = activePack.content;
import { Hero } from './UI';
import { shuffle } from '../lib/utils';
import { fuzzyMatch } from '../lib/matching';
import { ANSWER } from '../lib/textRules';
import { deckPrompts } from '../lib/prompts';
import { recordEvent, recordItem } from '../lib/stats';
import { getDueCards, recordVocabAnswer } from '../lib/srs';
import DeckProgress from './ui/DeckProgress';
import DeckPicker from './vocab/DeckPicker';
import CardFace from './vocab/CardFace';
import ChoiceGrid from './vocab/ChoiceGrid';
import TypedAnswer from './vocab/TypedAnswer';
import VerdictPanel from './vocab/VerdictPanel';
import DeckCompleteBanner from './vocab/DeckCompleteBanner';
import useAutoDeck from './vocab/useAutoDeck';

export default function VocabTab({
  level,
  learnedWords,
  markLearned,
  mobile = false,
  reviewTarget = null,
  onReviewConsumed,
}) {
  const [deckId, setDeckId] = useState('greetings');
  const [customCards, setCustomCards] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deckComplete, setDeckComplete] = useState(false);

  const {
    isAuto,
    cards: asyncDeck,
    loading: deckLoading,
    error: deckError,
    retry,
  } = useAutoDeck(deckId);

  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'almost' | 'wrong'
  const [typedAnswer, setTypedAnswer] = useState('');
  const [queue, setQueue] = useState([]);
  // A pending review target — when the deck-reset effect runs, it puts this
  // card first in the queue instead of starting fresh.
  const pendingReviewRef = useRef(null);

  const activeDeck =
    deckId === 'custom' && customCards
      ? customCards
      : isAuto
        ? asyncDeck || []
        : PRESET_DECKS[deckId] || [];

  useEffect(() => {
    const target = pendingReviewRef.current;
    const srs = (loadState() ?? {}).srs ?? {};
    // SRS-derived queue: due first, then new, then over-review.
    let q = getDueCards(srs, activeDeck, deckId, Date.now());
    if (target) {
      const idx = activeDeck.findIndex((c) => c.id === target);
      if (idx >= 0) {
        q = [idx, ...q.filter((i) => i !== idx)];
      }
      pendingReviewRef.current = null;
    }
    setQueue(q);
    setAnswered(false);
    setResult(null);
    setTypedAnswer('');
    setDeckComplete(false);
    // activeDeck is derived from deckId+customCards+asyncDeck which are in deps — safe to omit
  }, [deckId, customCards, asyncDeck, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brief lock to swallow the trailing click event that would otherwise pass
  // through to whatever button mounts at the SRS button's screen position on
  // the next card (e.g. clicking GOOD also clicking the new card's MC option
  // at the same coordinates).
  const clickLockRef = useRef(false);

  // SRS verdict + queue advance, shared by all four buttons in the verdict panel.
  const handleSrsVerdict = (srsVerdict) => {
    if (!card || clickLockRef.current) return;
    clickLockRef.current = true;
    recordVocabAnswer(deckId, card.id, srsVerdict);
    advanceQueue(srsVerdict !== 'again');
    setTimeout(() => {
      clickLockRef.current = false;
    }, 200);
  };

  // Pick up review targets handed in from the Stats Review feed.
  useEffect(() => {
    if (!reviewTarget) return;
    pendingReviewRef.current = reviewTarget.label;

    if (deckId === reviewTarget.context) {
      // Already on the right deck — the deck-reset effect won't fire, so
      // manually re-run the same queue-with-target build here.
      const idx = activeDeck.findIndex((c) => c.id === reviewTarget.label);
      if (idx >= 0) {
        const rest = activeDeck.map((_, i) => i).filter((i) => i !== idx);
        setQueue([idx, ...rest]);
        setAnswered(false);
        setResult(null);
        setTypedAnswer('');
        pendingReviewRef.current = null;
      }
    } else {
      // Deck change — pendingReviewRef will be consumed by the deck-reset effect.
      setDeckId(reviewTarget.context);
    }

    onReviewConsumed?.();
  }, [reviewTarget, onReviewConsumed]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentIdx = queue[0] ?? null;
  const card = currentIdx !== null ? activeDeck[currentIdx] : null;

  const getChoices = (deck, cardIdx) => {
    const correct = deck[cardIdx].en;
    const others = shuffle(deck.filter((_, i) => i !== cardIdx).map((c) => c.en));
    return shuffle([correct, ...others.slice(0, 3)]);
  };

  // Build the four multiple-choice options once per card. getChoices() reshuffles
  // on every call, so calling it inline in render let any unrelated re-render
  // (e.g. a parent sync-status update) reorder the buttons under the user's
  // finger — registering the wrong answer. Memoizing per card keeps the order
  // stable until the displayed card actually changes.
  const choices = useMemo(
    () => (currentIdx !== null && activeDeck.length >= 4 ? getChoices(activeDeck, currentIdx) : []),
    [deckId, currentIdx, card?.id, activeDeck.length] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const advanceQueue = (wasCorrect) => {
    setAnswered(false);
    setResult(null);
    setTypedAnswer('');
    setQueue((prev) => {
      const [, ...rest] = prev;
      const next = wasCorrect ? rest : [...rest, prev[0]];
      if (wasCorrect && rest.length === 0) setDeckComplete(true);
      return next;
    });
  };

  const submitTyped = () => {
    if (!typedAnswer.trim() || !card || clickLockRef.current) return;
    const { distance: dist } = fuzzyMatch(card.en, typedAnswer, ANSWER);
    const res = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';
    setAnswered(true);
    setResult(res);
    if (res === 'correct' || res === 'almost') markLearned(card.id);
    recordEvent('vocab', level, res);
    recordItem('vocab', deckId, card.id, card.en, res);
  };

  const chooseOption = (choice) => {
    if (clickLockRef.current) return; // swallow phantom clicks during transition
    const correct = choice === card.en;
    const verdict = correct ? 'correct' : 'wrong';
    setAnswered(true);
    setResult(verdict);
    if (correct) markLearned(card.id);
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, card.en, verdict);
  };

  const generateDeck = async () => {
    if (!customTopic.trim()) return;
    setGenerating(true);
    try {
      const { system: systemPrompt, user: userMsg } = deckPrompts({
        prompts: activePack.prompts,
        topic: customTopic,
      });
      const raw = await callClaude(systemPrompt, userMsg, [], { endpoint: 'deck' });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomCards(parsed.map((c) => ({ ...c, id: activePack.cardId(c) })));
        setDeckId('custom');
      }
    } catch (err) {
      alert('Could not generate deck — ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Multiple choice needs four distinct options; below that, even A1 types.
  // Spelled out rather than derived as `!showChoices`, which would additionally
  // show the input for any level outside a1/a2/b1 — not reachable through the
  // pack's cefrLevels today, but a behaviour change either way.
  const isBeginner = level === 'a1' || level === 'a2';
  const showChoices = isBeginner && activeDeck.length >= 4;
  const showTyped = level === 'b1' || (isBeginner && activeDeck.length < 4);

  return (
    <div>
      <Hero
        kicker="Section 03"
        title="Wortschatz"
        sub="Flip, listen, learn. Pick a preset or generate a deck on any topic."
      />

      <div
        style={{
          display: 'grid',
          // minmax(0, 1fr) rather than 1fr: a bare 1fr track keeps min-width
          // auto, so it refuses to shrink below its content's min-content width
          // and pushes past the viewport instead (377px inside 337px at 375px
          // wide). minmax(0, …) lets the track shrink and the content reflow.
          gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : '320px minmax(0, 1fr)',
          gap: mobile ? 16 : 32,
          marginTop: 32,
        }}
      >
        <DeckPicker
          deckId={deckId}
          onSelect={setDeckId}
          customCards={customCards}
          customTopic={customTopic}
          onTopicChange={setCustomTopic}
          generating={generating}
          onGenerate={generateDeck}
        />

        {/* ── Right column: active recall UI ── */}
        <div>
          {isAuto && deckLoading && (
            <div
              style={{
                padding: SPACE[8],
                textAlign: 'center',
                fontFamily: FONTS.mono,
                color: COLORS.mute,
              }}
            >
              Loading deck…
            </div>
          )}
          {isAuto && deckError && (
            <div
              style={{
                padding: SPACE[8],
                textAlign: 'center',
                fontFamily: FONTS.mono,
                color: COLORS.red,
              }}
            >
              Could not load this deck.{' '}
              <button type="button" onClick={retry} style={{ textDecoration: 'underline' }}>
                Retry
              </button>
            </div>
          )}
          {card && (
            <>
              {/* Progress bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: SPACE[4],
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.caps,
                    color: COLORS.mute,
                  }}
                >
                  {queue.length} card{queue.length !== 1 ? 's' : ''} remaining
                </div>
                <DeckProgress cards={activeDeck} learnedWords={learnedWords} />
              </div>

              {deckComplete && (
                <DeckCompleteBanner
                  learnedCount={activeDeck.filter((c) => learnedWords[c.id]).length}
                  onDismiss={() => setDeckComplete(false)}
                />
              )}

              <CardFace card={card} learned={!!learnedWords[card.id]} mobile={mobile} />

              {showChoices && !answered && <ChoiceGrid choices={choices} onChoose={chooseOption} />}

              {showTyped && !answered && (
                <TypedAnswer value={typedAnswer} onChange={setTypedAnswer} onSubmit={submitTyped} />
              )}

              {answered && (
                <VerdictPanel result={result} answer={card.en} onVerdict={handleSrsVerdict} />
              )}
            </>
          )}
          {!card && !deckComplete && (
            <div
              style={{
                padding: SPACE[8],
                textAlign: 'center',
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.base,
                color: COLORS.mute,
              }}
            >
              Select a deck to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
