import { callClaude } from '../../lib/claude';
import { activePack } from '../../packs';
import { sentencePrompts } from '../../lib/prompts';
import { clampMode } from '../../lib/levelGate';
import { getUserLevel } from '../../lib/levelPref';

// Generates 5 fresh translation exercises for the given level when the
// built-in sentence bank is exhausted. Returns a parsed JSON array matching
// the shape each level's exercise component expects.
export async function generateMoreSentences(level) {
  const gated = clampMode(level, getUserLevel());
  const { system, user } = sentencePrompts({ prompts: activePack.prompts, level: gated });
  const raw = await callClaude(system, user, [], {
    endpoint: 'grade',
    routingContext: { taskType: 'grammar_generation', userTier: 'guest' },
  });
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
