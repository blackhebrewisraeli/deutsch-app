import { callClaude } from '../../lib/claude';

// Generates 5 fresh translation exercises for the given level when the
// built-in sentence bank is exhausted. Returns a parsed JSON array matching
// the shape each level's exercise component expects.
export async function generateMoreSentences(level) {
  const levelDesc = {
    a1: 'A1 beginner (very simple sentences)',
    a2: 'A2 elementary (focus on articles and prepositions)',
    b1: 'B1 intermediate (complex grammar)',
  }[level];
  const system = `You generate German translation exercises for ${levelDesc} learners. Respond ONLY with valid JSON array, no markdown.`;
  const user =
    level === 'b1'
      ? `Generate 5 English sentences for translation into German at B1 level. Return: [{"en":"...","de":"...","note":"grammar concept"}]`
      : level === 'a2'
        ? `Generate 5 English sentences for fill-in-the-blank German exercises at A2 level. Each must have 1-2 blanks targeting articles or prepositions. Return: [{"en":"...","de":"...","template":"German with ___ for blanks","blanks":[{"word":"correct","distractors":["wrong1","wrong2"]}],"note":"..."}]`
        : `Generate 5 simple English sentences for word-tile German translation at A1 level. Return: [{"en":"...","de":"...","words":["German","tokens","in","order"],"distractors":["wrong1","wrong2"],"note":"..."}]`;
  const raw = await callClaude(system, user, [], { endpoint: 'grade' });
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
