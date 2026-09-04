// Claude API client. Every environment calls our versioned serverless API —
// the key never exists in the browser. Locally, `npm run dev:full`
// (vercel dev) serves the same functions that run in production;
// plain `npm run dev` has no /api routes, so AI features fail politely.
// Contract: docs/api/ai.md.
//
// Model + token budget come from routeAiRequest. A missing routingContext
// is treated as guest chat so today's callers keep the cheap Haiku baseline.

import { routeAiRequest } from './ai-routing/router.js';

const ENDPOINTS = {
  chat: '/api/v1/ai/chat',
  grade: '/api/v1/ai/grade',
  deck: '/api/v1/ai/deck',
};

const DEFAULT_ROUTING_CONTEXT = { taskType: 'chat' };

function routingContextFor(routingContext) {
  if (!routingContext || typeof routingContext !== 'object' || Array.isArray(routingContext)) {
    return DEFAULT_ROUTING_CONTEXT;
  }
  return { ...DEFAULT_ROUTING_CONTEXT, ...routingContext };
}

export const callClaude = async (
  systemPrompt,
  userMessage,
  conversationHistory = [],
  { endpoint = 'chat', routingContext } = {}
) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];
  const { model, maxTokens } = routeAiRequest(routingContextFor(routingContext));

  const response = await fetch(ENDPOINTS[endpoint], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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
