// Server-side entry point for the re-auth gate.
//
// The implementation moved to src/lib/authClaims.js so the CLIENT can ask the
// same question before it offers a sensitive control (changing an email), and
// there is exactly one definition of "authenticated recently" rather than two
// that can drift. Everything about WHY this reads `amr` and not `iat` lives
// there, next to the code.
//
// The .js extension is mandatory: this resolves under native Node ESM on
// Vercel, where a missing extension is a 500 that Vite and vitest both hide.
export { latestAuthTime, isRecentAuth, REAUTH_MAX_AGE_SEC } from '../../src/lib/authClaims.js';
