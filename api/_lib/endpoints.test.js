import { describe, it, expect } from 'vitest';
import { chatHandler as chat, gradeHandler as grade, deckHandler as deck } from './aiEndpoints.js';
import legacy from '../chat.js';

describe('AI endpoints', () => {
  it('every route exports a handler function', () => {
    expect(typeof chat).toBe('function');
    expect(typeof grade).toBe('function');
    expect(typeof deck).toBe('function');
    expect(typeof legacy).toBe('function');
  });

  it('the legacy /api/chat route is the v1 chat handler', () => {
    expect(legacy).toBe(chat);
  });
});
