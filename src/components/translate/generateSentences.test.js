import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMoreSentences } from './generateSentences';
import { callClaude } from '../../lib/claude';
import { setUserLevel } from '../../lib/levelPref';

vi.mock('../../lib/claude', () => ({
  callClaude: vi.fn(),
}));

describe('generateMoreSentences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setUserLevel('a1');
  });

  it('sends grammar_generation routingContext, defaulting userTier to guest', async () => {
    const sentences = [{ en: 'Hello', de: 'Hallo', words: ['Hallo'] }];
    callClaude.mockResolvedValue(JSON.stringify(sentences));

    await expect(generateMoreSentences('a1')).resolves.toEqual(sentences);
    expect(callClaude).toHaveBeenCalledWith(expect.any(String), expect.any(String), [], {
      endpoint: 'grade',
      routingContext: { taskType: 'grammar_generation', userTier: 'guest' },
    });
  });

  it('asks for A1 tile sentences when classified A1 even if called with b1', async () => {
    const sentences = [{ en: 'Hello', de: 'Hallo', words: ['Hallo'] }];
    callClaude.mockResolvedValue(JSON.stringify(sentences));
    await generateMoreSentences('b1');
    const [, user] = callClaude.mock.calls[0];
    expect(user).toMatch(/word-tile/i);
    expect(user).not.toMatch(/B1 level/);
  });
});
