import { COLORS, FONTS, FONT_SIZE, SPACE, TEXT } from '../../lib/theme';
import { INPUT_MODES, STAGES } from '../../lib/chatInputModes';
import ChatInput from './ChatInput';
import FillBlank from './FillBlank';
import WordBank from './WordBank';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

const STAGE_LABELS = Object.freeze({
  [WORD_BANK]: 'Build the sentence',
  [CHOICE_BLANK]: 'Choose the word',
  [TYPED_BLANK]: 'Type the word',
  [FREE_TEXT]: 'Free writing',
});

const MOVE_NOTE = {
  up: (label) => `Nice — next step: ${label}`,
  down: (label) => `Let's add some help: ${label}`,
};

/**
 * Chat's input, chosen by the learner's scaffold stage. Every scaffolded stage
 * renders the AI's latest `next` suggestion. Without a usable one (malformed,
 * or the opener failed) the turn is free text and the stage is left alone, so
 * the next good suggestion brings the scaffold straight back.
 *
 * The status region stays mounted so a stage change is announced.
 */
export default function Composer({
  stage,
  moved,
  scaffold,
  turnKey,
  thinking,
  onSend,
  onChooseStage,
  freeText,
}) {
  const shown = scaffold ? stage : FREE_TEXT;
  const label = STAGE_LABELS[stage];
  const typeInstead = () => onChooseStage(FREE_TEXT);

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'grid',
          gap: SPACE[1],
          padding: scaffold || moved ? `${SPACE[2]}px ${SPACE[3]}px` : 0,
          background: COLORS.paperDeep,
        }}
      >
        {scaffold && (
          <span style={TEXT.label}>
            {`Step ${STAGES.indexOf(stage) + 1} of ${STAGES.length} · ${label}`}
          </span>
        )}
        <div
          role="status"
          style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, color: COLORS.inkSoft }}
        >
          {moved ? MOVE_NOTE[moved](label) : ''}
        </div>
        {shown !== FREE_TEXT && scaffold.en && (
          <p
            style={{
              margin: 0,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.md,
              color: COLORS.ink,
            }}
          >
            {`Say: ${scaffold.en}`}
          </p>
        )}
      </div>

      {shown === WORD_BANK && (
        <WordBank
          key={`bank-${turnKey}`}
          words={[...scaffold.tokens, ...scaffold.distractors]}
          thinking={thinking}
          onSend={onSend}
          onSwitchToTyping={typeInstead}
        />
      )}
      {(shown === CHOICE_BLANK || shown === TYPED_BLANK) && (
        <FillBlank
          key={`gap-${turnKey}-${shown}`}
          mode={shown === CHOICE_BLANK ? 'choice' : 'typed'}
          scaffold={scaffold}
          thinking={thinking}
          onSend={onSend}
          onSwitchToTyping={typeInstead}
        />
      )}
      {shown === FREE_TEXT && (
        <ChatInput
          {...freeText}
          thinking={thinking}
          onSend={onSend}
          onSwitchToWordBank={scaffold ? () => onChooseStage(WORD_BANK) : undefined}
        />
      )}
    </div>
  );
}
