// Legacy alias for already-cached PWA bundles — same handler as
// /api/v1/ai/chat. Remove one release cycle after B0 ships.
// Note: Vercel deploys this as a separate function, so in B0 (in-memory
// store) its quota pool is separate from /api/v1/ai/chat; B1's durable
// store unifies them.
export { default } from './v1/ai/chat.js';
