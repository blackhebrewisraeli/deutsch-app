// Claude API client.
//
// In development:  requests go to /api/anthropic (Vite proxy → api.anthropic.com)
// In production:   requests go to /api/chat (Vercel serverless function)
//
// The API key is ALWAYS injected server-side — never exposed in the browser bundle.

const API_URL = import.meta.env.PROD
  ? '/api/chat'
  : '/api/anthropic/v1/messages';

export const callClaude = async (systemPrompt, userMessage, conversationHistory = []) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
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
