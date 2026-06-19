// Identity surface for B2 — language-blind. The only module that imports
// @supabase/supabase-js. Reads the PUBLIC Supabase vars (anon key is public
// by design; RLS is the authorization layer). When the vars are absent
// (CI, or any environment before B2.3 wires them), the module no-ops and
// isAuthConfigured() is false, so the app behaves exactly as it does today.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isAuthConfigured() {
  return Boolean(URL && ANON_KEY);
}

let client = null;
function getClient() {
  if (!isAuthConfigured()) return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
