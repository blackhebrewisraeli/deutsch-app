import { describe, it, expect } from 'vitest';
import { MODELS } from './catalog.js';
import { ANTHROPIC_PROVIDER, providerForModelId } from './providers.js';

describe('providerForModelId', () => {
  it('names anthropic for every catalog model', () => {
    for (const model of Object.values(MODELS)) {
      expect(model.provider).toBe(ANTHROPIC_PROVIDER);
      expect(providerForModelId(model.id)).toBe(ANTHROPIC_PROVIDER);
    }
  });

  it('defaults unknown or missing ids to anthropic so a stale pin still ships', () => {
    expect(providerForModelId('gpt-4o-mini')).toBe(ANTHROPIC_PROVIDER);
    expect(providerForModelId(undefined)).toBe(ANTHROPIC_PROVIDER);
    expect(providerForModelId(null)).toBe(ANTHROPIC_PROVIDER);
    expect(providerForModelId('')).toBe(ANTHROPIC_PROVIDER);
  });
});
