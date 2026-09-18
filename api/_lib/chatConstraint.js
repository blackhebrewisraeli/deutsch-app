// Chat-only extras: classified CEFR + learned-vocab allowlist.
// Validated here so a client cannot raise the band or dump an unbounded list
// into the Anthropic body. The fields themselves are never forwarded; they
// fold into a language-blind system-prompt appendix.
//
// Do not import src/lib/levelPref.js or src/lib/chatVocab.js from this file.
// Those pull extensionless client imports that native Node (Vercel) cannot
// resolve — see api/v1/ai-esm-resolution.test.js. prompts.js is safe: it has
// no imports of its own.

import { chatServerConstraint } from '../../src/lib/prompts.js';

const LEVELS = ['a1', 'a2', 'b1'];
export const MAX_VOCAB_TERM_CHARS = 64;
// Keep in lockstep with src/lib/chatVocab.js MAX_ALLOWLIST.
const MAX_ALLOWLIST = 80;

/**
 * @param {object} safeBody already-stripped Anthropic body from validateAiBody
 * @param {unknown} rawBody original request body
 * @returns {{ ok: true, safeBody: object } | { ok: false, message: string }}
 */
export function applyChatConstraints(safeBody, rawBody) {
  const raw = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {};

  let level;
  if (raw.level !== undefined) {
    if (typeof raw.level !== 'string') {
      return { ok: false, message: 'Invalid level' };
    }
    const k = raw.level.toLowerCase();
    level = LEVELS.includes(k) ? k : 'a1';
  }

  let vocab;
  if (raw.vocab !== undefined) {
    if (!Array.isArray(raw.vocab)) {
      return { ok: false, message: 'Invalid vocab list' };
    }
    const seen = new Set();
    vocab = [];
    for (const item of raw.vocab) {
      if (typeof item !== 'string') continue;
      const t = item.trim();
      if (!t || t.length > MAX_VOCAB_TERM_CHARS) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      vocab.push(t);
      if (vocab.length >= MAX_ALLOWLIST) break;
    }
  }

  const hasLevel = level !== undefined;
  const hasVocab = Array.isArray(vocab) && vocab.length > 0;
  if (!hasLevel && !hasVocab) return { ok: true, safeBody };

  const appendix = chatServerConstraint({
    level: hasLevel ? level : undefined,
    vocab: hasVocab ? vocab : undefined,
  });
  const system = safeBody.system ? `${safeBody.system}\n\n${appendix}` : appendix;
  return { ok: true, safeBody: { ...safeBody, system } };
}
