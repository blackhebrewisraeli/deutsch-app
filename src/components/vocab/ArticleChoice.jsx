import { BUTTON, SPACE } from '../../lib/theme';

/**
 * The gender drill's answer row. Options come from the pack's
 * grammar.articles, so the engine holds no German.
 *
 * Not shuffled, unlike ChoiceGrid: there are only three, their positions become
 * muscle memory, and reshuffling them every card would tax recognition without
 * testing anything.
 *
 * @param {{ articles: string[], onChoose: (article: string) => void }} props
 */
export default function ArticleChoice({ articles, onChoose }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${articles.length}, minmax(0, 1fr))`,
        gap: SPACE[3],
      }}
    >
      {articles.map((article) => (
        <button
          key={article}
          type="button"
          onClick={() => onChoose(article)}
          style={{ ...BUTTON.tile, padding: SPACE[4] }}
        >
          {article}
        </button>
      ))}
    </div>
  );
}
