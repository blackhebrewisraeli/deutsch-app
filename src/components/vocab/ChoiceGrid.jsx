import { BUTTON, SPACE } from '../../lib/theme';

/**
 * The four multiple-choice options. The parent owns the shuffle — see the memo
 * in VocabTab — so this only renders what it is handed.
 *
 * @param {{ choices: string[], onChoose: (choice: string) => void }} props
 */
export default function ChoiceGrid({ choices, onChoose }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: SPACE[3],
      }}
    >
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          onClick={() => onChoose(choice)}
          style={{
            ...BUTTON.tile,
            padding: SPACE[4],
          }}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}
