// Claude API client.
//
// In development, requests go to /api/anthropic which is proxied by Vite
// (see vite.config.js) to https://api.anthropic.com with the API key
// injected from the VITE_ANTHROPIC_API_KEY env variable.
//
// For production deployment, replace this with a call to your own backend
// or a serverless function — NEVER expose your API key in client-side code
// in a deployed app.

const API_URL = '/api/anthropic/v1/messages';

export const callClaude = async (systemPrompt, userMessage, conversationHistory = []) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`API call failed (${response.status}). Check your .env file has VITE_ANTHROPIC_API_KEY set.`);
  }

  const data = await response.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
};
