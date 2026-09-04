// Legacy alias for already-cached PWA bundles — same handler as
// /api/v1/ai/chat. Remove one release cycle after B0 ships.
// Note: Vercel deploys this as a separate function, so in B0 (in-memory
// store) its quota pool is separate from /api/v1/ai/chat; B1's durable
// store unifies them.
//
// Points at the shared handler in api/_lib/aiEndpoints.js rather than at
// api/v1/ai/chat.js, which no longer exists — that endpoint's logic moved
// there, and api/v1/ai.js dispatches to it, when the AI lane was consolidated
// to fit Vercel's Hobby-plan function cap. See api/v1/ai.js.
export { chatHandler as default } from './_lib/aiEndpoints.js';
