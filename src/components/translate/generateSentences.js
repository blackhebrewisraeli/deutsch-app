import { callClaude } from '../../lib/claude';
import { activePack } from '../../packs';
import { sentencePrompts } from '../../lib/prompts';

// Generates 5 fresh translation exercises for the given level when the
// built-in sentence bank is exhausted. Returns a parsed JSON array matching
// the shape each level's exercise component expects.
export async function generateMoreSentences(level) {
  const { system, user } = sentencePrompts({ prompts: activePack.prompts, level });
  const raw = await callClaude(system, user, [], { endpoint: 'grade' });
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
