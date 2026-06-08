// Vercel Serverless Function — proxies Anthropic API calls server-side.
// The API key stays on the server and never reaches the browser.
//
// This endpoint is PUBLIC, so it constrains what it will forward to Anthropic:
// allow-listed model, capped max_tokens, size limits, and a rebuilt clean body.
// That prevents it from being abused as a free, max-cost, general-purpose proxy.
// (Per-IP rate limiting is the real anti-abuse control — planned as a follow-up.)

const ALLOWED_MODELS = ['claude-haiku-4-5-20251001'];
const MAX_TOKENS_CAP = 1024;
const MAX_MESSAGES = 100;
const MAX_TOTAL_CHARS = 100000; // system prompt + all message content combined

// Optional origin allow-list. Set ALLOWED_ORIGINS in Vercel (comma-separated,
// e.g. "https://deutsch-app.vercel.app,https://yourdomain.com") to reject
// requests from other sites. Left unset = not enforced, so it can't break the
// app. Note: Origin is spoofable by non-browser clients, so treat this as a
// soft layer on top of the input caps above.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Soft origin check (only enforced if ALLOWED_ORIGINS is configured).
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length > 0 && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is not configured.' });
  }

  // Body may arrive as a parsed object or a raw string.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // --- Validate and constrain inputs ---
  const { model, system } = body;

  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Unsupported model' });
  }

  let maxTokens = Number(body.max_tokens);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 1000;
  maxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CAP);

  if (system !== undefined && typeof system !== 'string') {
    return res.status(400).json({ error: 'Invalid system prompt' });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  let totalChars = system ? system.length : 0;
  for (const m of messages) {
    if (
      !m ||
      typeof m !== 'object' ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string'
    ) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({ error: 'Request too large' });
  }

  // Rebuild a clean body — forward only known-safe fields, nothing the client
  // may have tacked on (tools, metadata, etc.).
  const safeBody = { model, max_tokens: maxTokens, messages };
  if (system) safeBody.system = system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Function error:', err.message);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
