import { describe, it, expect } from 'vitest';
import { applyChatConstraints, MAX_VOCAB_TERM_CHARS } from './chatConstraint.js';
import { MAX_ALLOWLIST } from '../../src/lib/chatVocab.js';

const safe = () => ({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  system: 'You are a tutor',
  messages: [{ role: 'user', content: 'Hallo' }],
});

describe('applyChatConstraints', () => {
  it('is a no-op when extras are omitted', () => {
    const body = safe();
    const result = applyChatConstraints(body, { ...body });
    expect(result).toEqual({ ok: true, safeBody: body });
  });

  it('clamps an unknown level to a1 and appends an authoritative band', () => {
    const result = applyChatConstraints(safe(), { level: 'C2' });
    expect(result.ok).toBe(true);
    expect(result.safeBody.system).toContain('Learner CEFR band: a1');
    expect(result.safeBody.system).toContain('You are a tutor');
    expect('level' in result.safeBody).toBe(false);
  });

  it('keeps a valid classified level', () => {
    const result = applyChatConstraints(safe(), { level: 'b1' });
    expect(result.safeBody.system).toContain('Learner CEFR band: b1');
  });

  it('rejects a non-string level', () => {
    expect(applyChatConstraints(safe(), { level: { inject: true } }).ok).toBe(false);
  });

  it('rejects a non-array vocab list', () => {
    expect(applyChatConstraints(safe(), { vocab: 'hello' }).ok).toBe(false);
  });

  it('sanitizes vocab: trim, drop junk, dedupe, cap, never forward the field', () => {
    const long = 'x'.repeat(MAX_VOCAB_TERM_CHARS + 1);
    const tooMany = Array.from({ length: MAX_ALLOWLIST + 5 }, (_, i) => `w${i}`);
    const result = applyChatConstraints(safe(), {
      vocab: ['  Hello  ', 'hello', 7, '', long, ...tooMany],
    });
    expect(result.ok).toBe(true);
    expect('vocab' in result.safeBody).toBe(false);
    expect(result.safeBody.system).toContain('Hello');
    expect(result.safeBody.system).not.toContain(long);
    const listed = result.safeBody.system.match(/Prefer these known terms: ([^.]+)/)[1];
    expect(listed.split(', ')).toHaveLength(MAX_ALLOWLIST);
  });

  it('keeps the server cap in lockstep with the client allowlist budget', () => {
    expect(MAX_ALLOWLIST).toBe(80);
  });

  it('does not fail the request when vocab sanitizes to empty', () => {
    const result = applyChatConstraints(safe(), { vocab: [7, '', '   '] });
    expect(result.ok).toBe(true);
    expect(result.safeBody.system).toBe('You are a tutor');
  });
});
