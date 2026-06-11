// Validates and constrains an AI-lane request body, returning a rebuilt
// clean body — only known-safe fields are ever forwarded upstream.

export const ALLOWED_MODELS = ['claude-haiku-4-5-20251001'];
export const MAX_TOKENS_CAP = 1024;
export const MAX_MESSAGES = 100;
export const MAX_TOTAL_CHARS = 100000; // system prompt + all message content

// Returns { ok: true, safeBody } or { ok: false, message }.
export function validateAiBody(rawBody) {
  let body = rawBody;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: 'Invalid JSON body' };
    }
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Invalid request body' };
  }

  const { model, system, messages } = body;

  if (!ALLOWED_MODELS.includes(model)) {
    return { ok: false, message: 'Unsupported model' };
  }

  let maxTokens = Number(body.max_tokens);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 1000;
  maxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CAP);

  if (system !== undefined && typeof system !== 'string') {
    return { ok: false, message: 'Invalid system prompt' };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: 'messages must be a non-empty array' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, message: 'Too many messages' };
  }

  let totalChars = system ? system.length : 0;
  for (const m of messages) {
    if (
      !m ||
      typeof m !== 'object' ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string'
    ) {
      return { ok: false, message: 'Invalid message format' };
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return { ok: false, message: 'Request too large' };
  }

  const safeBody = { model, max_tokens: maxTokens, messages };
  if (system) safeBody.system = system;
  return { ok: true, safeBody };
}
