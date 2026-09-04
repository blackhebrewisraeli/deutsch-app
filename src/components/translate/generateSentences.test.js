import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMoreSentences } from './generateSentences';
import { callClaude } from '../../lib/claude';

vi.mock('../../lib/claude', () => ({
  callClaude: vi.fn(),
}));

describe('generateMoreSentences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
