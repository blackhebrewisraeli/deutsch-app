// Fixed-window rate limiter with a pluggable store.
// B0 ships MemoryStore: counters live in the warm function instance, so
// limits are best-effort per instance (and per deployed function). Phase B1
// replaces it with a Supabase-backed store behind the same interface:
//   store.increment(key, windowStart) -> Promise<count within window>
// In B2, clientKey() gains a user-id branch when requests carry a JWT.

export class MemoryStore {
  constructor() {
    this.windows = new Map();
  }
  async increment(key, windowStart) {
    const entry = this.windows.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      this.windows.set(key, { windowStart, count: 1 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

export function clientKey(req) {
  // Behind Vercel's proxy the client address is the first x-forwarded-for hop.
  const fwd = req.headers['x-forwarded-for'];
  const ip = typeof fwd === 'string' && fwd.length > 0 ? fwd.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

export function createRateLimiter({ windowMs, max, store = new MemoryStore(), now = Date.now }) {
  return async function check(req) {
    const windowStart = Math.floor(now() / windowMs) * windowMs;
    const count = await store.increment(clientKey(req), windowStart);
    if (count <= max) return { allowed: true };
    const retryAfterSec = Math.ceil((windowStart + windowMs - now()) / 1000);
    return { allowed: false, retryAfterSec };
  };
}
