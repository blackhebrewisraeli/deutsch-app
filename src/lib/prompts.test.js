import { describe, it, expect } from 'vitest';
import { chatSystemPrompt, graderSystemPrompt, deckPrompts, sentencePrompts } from './prompts';

const prompts = {
  persona: 'Anna',
  targetLanguage: 'German',
  levels: {
    a1: 'The learner is A1 BEGINNER. Use very simple German.',
    a2: 'The learner is A2 ELEMENTARY. Use natural but simple German.',
    b1: 'The learner is B1 INTERMEDIATE. Use natural German.',
  },
  exercises: {
    a1: 'A1 beginner (very simple sentences)',
    a2: 'A2 elementary (focus on articles and prepositions)',
    b1: 'B1 intermediate (complex grammar)',
  },
  deck: { cardExample: 'der Hund', ipaExample: '[deːɐ̯ hʊnt]' },
};

// ChatTab has no test file of its own, so these assertions are the only
// coverage the largest prompt gets. Check every part, not a sample.
describe('chatSystemPrompt', () => {
  const base = { prompts, scenarioDesc: 'ordering coffee', level: 'a1' };

  it('names the pack persona and target language', () => {
    const out = chatSystemPrompt(base);
    expect(out).toContain('friendly German tutor named Anna');
  });

  it('includes the scenario description', () => {
    expect(chatSystemPrompt(base)).toContain('The current scenario is: ordering coffee.');
  });

  it('includes the level pedagogy for the level given', () => {
    expect(chatSystemPrompt(base)).toContain('The learner is A1 BEGINNER');
    expect(chatSystemPrompt({ ...base, level: 'b1' })).toContain('The learner is B1 INTERMEDIATE');
    expect(chatSystemPrompt({ ...base, level: 'b1' })).not.toContain('A1 BEGINNER');
  });

  it('carries the engine JSON contract with all five keys', () => {
    const out = chatSystemPrompt(base);
    expect(out).toContain('You MUST always respond with strict JSON only');
    for (const key of ['"de"', '"ipa"', '"en"', '"correction"', '"taskComplete"']) {
      expect(out).toContain(key);
    }
  });

  it('adds the task sentence only when a task is given', () => {
    const withTask = chatSystemPrompt({ ...base, task: 'Order a coffee' });
    expect(withTask).toContain(`The learner's current task is: "Order a coffee"`);
    expect(chatSystemPrompt(base)).not.toContain('current task is');
  });

  // The level-key trap: cefrLevels is uppercase, components pass lowercase.
  // A mismatch does not throw — it interpolates the string "undefined".
  it('never emits the literal string undefined', () => {
    for (const level of ['a1', 'a2', 'b1']) {
      expect(chatSystemPrompt({ ...base, level })).not.toContain('undefined');
    }
  });
});

describe('graderSystemPrompt', () => {
  it('names the target language on both sides of the translation', () => {
    const out = graderSystemPrompt({ prompts });
    expect(out).toContain('You are a German language grader');
    expect(out).toContain('translate an English sentence into German');
  });

  it('carries the three-verdict contract', () => {
    const out = graderSystemPrompt({ prompts });
    expect(out).toContain('"verdict": "correct" | "almost" | "wrong"');
    expect(out).toContain('"corrected"');
    expect(out).toContain('"message"');
    expect(out).toContain('Use "almost" if');
  });

  it('never emits the literal string undefined', () => {
    expect(graderSystemPrompt({ prompts })).not.toContain('undefined');
  });
});

describe('deckPrompts', () => {
  it('uses the pack card and IPA examples', () => {
    const { user } = deckPrompts({ prompts, topic: 'weather' });
    expect(user).toContain('der Hund');
    expect(user).toContain('[deːɐ̯ hʊnt]');
  });

  it('puts the topic in the user message and the shape in the system prompt', () => {
    const { system, user } = deckPrompts({ prompts, topic: 'weather' });
    expect(system).toContain('You generate German vocabulary flashcards');
    expect(user).toContain('on the topic: "weather"');
    expect(user).toContain('Generate exactly 10 German flashcards');
  });

  it('never emits the literal string undefined', () => {
    const { system, user } = deckPrompts({ prompts, topic: 'weather' });
    expect(system + user).not.toContain('undefined');
  });
});

describe('sentencePrompts', () => {
  it('uses the pack exercise focus for the level', () => {
    expect(sentencePrompts({ prompts, level: 'a2' }).system).toContain(
      'A2 elementary (focus on articles and prepositions)'
    );
  });

  it('asks for the tile shape at a1, blanks at a2, and plain pairs at b1', () => {
    expect(sentencePrompts({ prompts, level: 'a1' }).user).toContain('"words"');
    expect(sentencePrompts({ prompts, level: 'a2' }).user).toContain('"blanks"');
    expect(sentencePrompts({ prompts, level: 'b1' }).user).toContain('"note":"grammar concept"');
  });

  it('never emits the literal string undefined at any level', () => {
    for (const level of ['a1', 'a2', 'b1']) {
      const { system, user } = sentencePrompts({ prompts, level });
      expect(system + user).not.toContain('undefined');
    }
  });
});
