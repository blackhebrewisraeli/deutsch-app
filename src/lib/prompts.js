// The only place in src/ that holds AI prompt text.
//
// Each builder composes three things: engine framing prose, an engine-owned
// JSON output contract, and pack-supplied language fields. The contract stays
// engine-side deliberately — a pack that reworded it would break the calling
// component's JSON.parse at runtime, inside a catch that reports a connection
// error, so the real cause would never surface.
//
// NOTE: the JSON KEY names ("de", "ipa", "en") are the contract the components
// parse and are NOT substituted with the target language. Only the prose around
// them names the language.

/**
 * @typedef {object} Prompts
 * @property {string} persona
 * @property {string} targetLanguage
 * @property {Record<string, string>} levels     — chat pedagogy, lowercase keys
 * @property {Record<string, string>} exercises  — generation focus, lowercase keys
 * @property {{ cardExample: string, ipaExample: string }} deck
 */

/**
 * Vocabulary constraint block for chat. Language-blind: names no target
 * language and gives no language-specific examples. Empty vocab is a
 * first-session scaffold, not an error.
 *
 * @param {{ vocab?: string[], sparse?: boolean }} [args]
 * @returns {string}
 */
export function chatVocabConstraint({ vocab, sparse } = {}) {
  if (!vocab?.length) {
    return 'The learner is new and has no learned vocabulary yet. Stay with the simplest everyday words. Introduce at most one new word per reply and mark it in the English translation.';
  }
  const list = vocab.join(', ');
  const head = sparse
    ? 'The learner knows only a few words; this list includes a small starter set. Stay very simple.'
    : "Stay within the learner's known vocabulary.";
  return `${head} Prefer these terms: ${list}. Function words (articles, pronouns, auxiliaries) may be used freely. When you must introduce a new word, mark it clearly in the English translation and keep new words rare — at most one per turn.`;
}

/**
 * Short appendix the chat API folds into the system prompt after validating
 * the client-supplied level and vocab. Authoritative over client prose that
 * tries to raise the band.
 *
 * @param {{ level?: string, vocab?: string[] }} [args]
 * @returns {string}
 */
export function chatServerConstraint({ level, vocab } = {}) {
  const parts = ['Server constraint (authoritative):'];
  if (level) {
    parts.push(`Learner CEFR band: ${level}. Do not raise complexity above this band.`);
  }
  if (vocab?.length) {
    parts.push(
      `Prefer these known terms: ${vocab.join(', ')}. New words are rare and must be marked.`
    );
  }
  return parts.join(' ');
}

/**
 * Anna's system prompt. `task` is optional — when absent the task sentence is
 * omitted entirely rather than left as an empty clause, which a model reads as
 * a task with no content.
 *
 * `level` is the classified CEFR code. Unknown keys fall back to a1 pedagogy
 * rather than interpolating the string "undefined".
 *
 * @param {{ prompts: Prompts, scenarioDesc: string, task?: string, level: string, vocab?: string[], sparse?: boolean }} args
 * @returns {string}
 */
export function chatSystemPrompt({ prompts, scenarioDesc, task, level, vocab, sparse } = {}) {
  const { persona, targetLanguage, levels } = prompts ?? {};

  const taskLine = task
    ? `The learner's current task is: "${task}". Stay in this scenario and guide them toward completing this task. When the task is naturally complete, include "taskComplete": true in your JSON response; otherwise omit it or set it to false.`
    : '';

  const pedagogy = levels?.[level] || levels?.a1 || '';
  const vocabBlock = chatVocabConstraint({ vocab, sparse });

  return `You are a friendly ${targetLanguage} tutor named ${persona} for a language learner. The current scenario is: ${scenarioDesc}. ${taskLine}

${pedagogy}

${vocabBlock}

You MUST always respond with strict JSON only (no markdown, no extra text):
{
  "de": "your reply in ${targetLanguage} (1-2 sentences)",
  "ipa": "IPA pronunciation of the ${targetLanguage}",
  "en": "English translation",
  "correction": null OR { "original": "what they said", "fixed": "corrected ${targetLanguage}", "explain": "brief friendly explanation in English" },
  "taskComplete": false
}

Stay in the scenario. Only provide 'correction' if the user made a real grammar/vocabulary mistake.`;
}

/**
 * B1 free-typed translation grader.
 * @param {{ prompts: Prompts }} args
 * @returns {string}
 */
export function graderSystemPrompt({ prompts }) {
  const { targetLanguage } = prompts;

  return `You are a ${targetLanguage} language grader. The learner was asked to translate an English sentence into ${targetLanguage}.
Evaluate their answer strictly but fairly. Respond ONLY with valid JSON, no markdown:
{
  "verdict": "correct" | "almost" | "wrong",
  "corrected": "the ideal ${targetLanguage} translation",
  "message": "one sentence of feedback in English explaining the main error or praising them"
}
Use "correct" if the translation is grammatically correct and conveys the full meaning, even if phrasing differs from the ideal.
Use "almost" if there's a minor issue (a typo, a small grammar slip, a slightly off article or case) but the meaning is clearly there.
Use "wrong" if there's a significant grammar mistake, wrong word choice, or the meaning is not conveyed.`;
}

/**
 * Custom vocabulary deck generation.
 * @param {{ prompts: Prompts, topic: string }} args
 * @returns {{ system: string, user: string }}
 */
export function deckPrompts({ prompts, topic }) {
  const { targetLanguage, deck } = prompts;

  return {
    system: `You generate ${targetLanguage} vocabulary flashcards for a beginner. Respond with ONLY a JSON array, no markdown, no extra text.`,
    user: `Generate exactly 10 ${targetLanguage} flashcards on the topic: "${topic}". Return JSON array of objects with keys: de (${targetLanguage} word with article if noun, e.g. "${deck.cardExample}"), en (English translation), ipa (IPA pronunciation in brackets like "${deck.ipaExample}"). No other text.`,
  };
}

/**
 * Fresh translation exercises when a level's sentence bank runs out. The user
 * message differs per level because each level renders a different exercise
 * component, and each needs its own JSON shape.
 *
 * @param {{ prompts: Prompts, level: string }} args
 * @returns {{ system: string, user: string }}
 */
export function sentencePrompts({ prompts, level }) {
  const { targetLanguage, exercises } = prompts;

  const user =
    level === 'b1'
      ? `Generate 5 English sentences for translation into ${targetLanguage} at B1 level. Return: [{"en":"...","de":"...","note":"grammar concept"}]`
      : level === 'a2'
        ? `Generate 5 English sentences for fill-in-the-blank ${targetLanguage} exercises at A2 level. Each must have 1-2 blanks targeting articles or prepositions. Return: [{"en":"...","de":"...","template":"${targetLanguage} with ___ for blanks","blanks":[{"word":"correct","distractors":["wrong1","wrong2"]}],"note":"..."}]`
        : `Generate 5 simple English sentences for word-tile ${targetLanguage} translation at A1 level. Return: [{"en":"...","de":"...","words":["${targetLanguage}","tokens","in","order"],"distractors":["wrong1","wrong2"],"note":"..."}]`;

  return {
    system: `You generate ${targetLanguage} translation exercises for ${exercises[level]} learners. Respond ONLY with valid JSON array, no markdown.`,
    user,
  };
}
