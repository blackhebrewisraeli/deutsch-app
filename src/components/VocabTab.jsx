import { useState, useEffect, useRef, useMemo } from 'react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, BUTTON } from '../lib/theme';
import { callClaude } from '../lib/claude';
import { loadState } from '../lib/storage';
import { activePack } from '../packs';
const { decks: PRESET_DECKS } = activePack.content;
import { Volume2 } from 'lucide-react';
import { Hero } from './UI';
import { shuffle } from '../lib/utils';
import { exactMatch, bestGlossMatch } from '../lib/matching';
import { ANSWER } from '../lib/textRules';
import { deckPrompts } from '../lib/prompts';
import { recordEvent, recordItem } from '../lib/stats';
import { getDueCards, recordVocabAnswer } from '../lib/srs';
import DeckProgress from './ui/DeckProgress';
import FeedbackButton from './FeedbackButton';
import DeckPicker from './vocab/DeckPicker';
import CardFace from './vocab/CardFace';
import ChoiceGrid from './vocab/ChoiceGrid';
import TypedAnswer from './vocab/TypedAnswer';
import VerdictPanel from './vocab/VerdictPanel';
import DeckCompleteBanner from './vocab/DeckCompleteBanner';
import ArticleChoice from './vocab/ArticleChoice';
import { drillFor } from './vocab/drills';
import { speak } from '../lib/speech';
import useAutoDeck from './vocab/useAutoDeck';
import { AUTO_DECKS } from '../packs/de/autoDecks';

// The verdict is where the other meanings can be taught — the card face must
// not show them, since that would print the answer above the question.
const glossList = (card) => (card.glosses?.length ? card.glosses.join(' · ') : card.en);

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
    // Every gloss, not just the first. card.en is glosses[0]; a card like
    // "die Uhr" ships "clock, watch" and "meter; gauge" too, and typing "clock"
    // used to be marked wrong.
    const { distance: dist } = bestGlossMatch(card.glosses ?? card.en, typedAnswer, ANSWER);
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

  // Every drill grades the same way: exact match against the pack's target text
  // rules. Deliberately not fuzzyMatch — a gender, plural or participle that
  // differs by one letter is a different word, not a near miss.
  //
  // No markLearned for any drill; see the note in vocab/drills.js.
  const answerDrill = (given) => {
    if (!card || clickLockRef.current) return;
    const expected = drill.expected(card, activePack.grammar) ?? '';
    // A drill may have several right answers — "gut" is the opposite of both
    // "schlecht" and "böse". `accepts` is optional; without it the single
    // expected value is the whole accepted set, which is what the other drills
    // want (a plural or a participle has exactly one form).
    const accepted = drill.accepts ? drill.accepts(card, activePack.grammar) : [expected];
    const verdict = accepted.some((a) => a && exactMatch(a, given, activePack.validation.target))
      ? 'correct'
      : 'wrong';
    setAnswered(true);
    setResult(verdict);
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, expected, verdict);
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
  // Artikel decks drill gender rather than meaning. Keyed off the deck's group
  // so adding a deck to the group is enough — no second list to keep in sync.
  // One table lookup replaces a flag, a conceal branch and an answer branch per
  // drill — see vocab/drills.js. A drill deck replaces the meaning exercises.
  const drill = drillFor(deckId, AUTO_DECKS);
  const isDrill = drill !== null;

  // The audio IS the question for a listening drill, so it plays on arrival
  // rather than waiting for a click — a learner who must press play before every
  // card is being taxed, not tested. speak() is a no-op where speechSynthesis is
  // missing, which is also what makes this safe in jsdom.
  useEffect(() => {
    if (drill?.speak && card) speak(drill.speak(card));
    // card.id is the identity that matters; re-speaking on unrelated re-renders
    // would interrupt the learner mid-word.
  }, [drill, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const showChoices = !isDrill && isBeginner && activeDeck.length >= 4;
  const showTyped = !isDrill && (level === 'b1' || (isBeginner && activeDeck.length < 4));

  return (
    <div>
      <Hero
        kicker="Section 04"
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
          marginTop: SPACE[8],
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
              {/* `flexWrap` is load-bearing, and it fixes a bug that predates
                the report button. Measured in Chrome at 320px:

                  before this change, no button ...... 73px sideways scroll
                  report button in the dots cluster .. 125px
                  this layout ........................ 0px

                DeckProgress's dots are `flex: 0 1 26px`, so they can shrink —
                but sharing a line with the "N cards remaining" label left them
                too little room to shrink into, and the strip stood at 305px in
                a 304px row. Giving the row `flexWrap` drops the strip onto its
                own line, where that shrink finally has somewhere to go: 288px
                at both 10 dots and 12, which is DOT_THRESHOLD and therefore the
                widest the strip can ever be. The report button then sits in the
                left group, where it costs the row nothing.

                So: do not remove flexWrap, and do not move the button back in
                beside the dots. Verified in a browser because jsdom computes no
                layout — the test below pins the property, not the pixels. */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: SPACE[2],
                  marginBottom: SPACE[4],
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
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
                  {/* itemLabel is card.de — the very thing CardFace conceals on
                    the Hören and Artikel decks. Captured for triage, never
                    rendered; see FeedbackDialog. */}
                  <FeedbackButton
                    context={{
                      surface: 'vocab',
                      level,
                      deckId,
                      itemId: card.id,
                      itemLabel: card.de ?? null,
                    }}
                  />
                </div>
                <DeckProgress cards={activeDeck} learnedWords={learnedWords} />
              </div>

              {deckComplete && (
                <DeckCompleteBanner
                  learnedCount={activeDeck.filter((c) => learnedWords[c.id]).length}
                  onDismiss={() => setDeckComplete(false)}
                />
              )}

              <CardFace
                card={card}
                display={drill?.display?.(card)}
                conceal={drill?.conceal}
                learned={!!learnedWords[card.id]}
                mobile={mobile}
              />

              {drill?.kind === 'choice' && !answered && (
                <ArticleChoice
                  articles={drill.options(activePack.grammar)}
                  onChoose={answerDrill}
                />
              )}

              {drill?.speak && !answered && (
                <button
                  type="button"
                  onClick={() => speak(drill.speak(card))}
                  aria-label="Play the word again"
                  style={{ ...BUTTON.tile, width: '100%', marginBottom: SPACE[3] }}
                >
                  <Volume2 size={18} aria-hidden="true" /> PLAY AGAIN
                </button>
              )}

              {drill?.kind === 'typed' && !answered && (
                <TypedAnswer
                  value={typedAnswer}
                  onChange={setTypedAnswer}
                  onSubmit={() => typedAnswer.trim() && answerDrill(typedAnswer)}
                  label={drill.label(activePack.grammar)}
                  placeholder={drill.placeholder(activePack.grammar)}
                />
              )}

              {showChoices && !answered && <ChoiceGrid choices={choices} onChoose={chooseOption} />}

              {showTyped && !answered && (
                <TypedAnswer value={typedAnswer} onChange={setTypedAnswer} onSubmit={submitTyped} />
              )}

              {answered && (
                <VerdictPanel
                  // The gender drill asked for the article, so the answer it
                  // owes back is the full form "das Jahr" — not the English
                  // gloss, which was never the question.
                  result={result}
                  answer={drill ? drill.answer(card, activePack.grammar) : glossList(card)}
                  onVerdict={handleSrsVerdict}
                />
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
