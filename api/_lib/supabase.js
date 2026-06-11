import { createClient } from '@supabase/supabase-js';

let cached = null;

// Service-role client for server functions. Returns null when the data lane
// is not configured — callers fall back gracefully (B1 spec: fail open).
// The service-role key bypasses RLS; it must never reach the client bundle.
export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}
