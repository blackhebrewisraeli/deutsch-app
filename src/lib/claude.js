// Claude API client. Every environment calls our versioned serverless API —
// the key never exists in the browser. Locally, `npm run dev:full`
// (vercel dev) serves the same functions that run in production;
// plain `npm run dev` has no /api routes, so AI features fail politely.
// Contract: docs/api/ai.md.

const ENDPOINTS = {
  chat: '/api/v1/ai/chat',
  grade: '/api/v1/ai/grade',
  deck: '/api/v1/ai/deck',
};

export const callClaude = async (
  systemPrompt,
  userMessage,
  conversationHistory = [],
  { endpoint = 'chat' } = {}
) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];

  const response = await fetch(ENDPOINTS[endpoint], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData?.error?.message || JSON.stringify(errorData);
    console.error('Claude API error:', response.status, detail);
    throw new Error(`API call failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
};
