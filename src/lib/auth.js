// Identity surface for B2 — language-blind. The only module that imports
// @supabase/supabase-js. Reads the PUBLIC Supabase vars (anon key is public
// by design; RLS is the authorization layer). When the vars are absent
// (CI, or any environment before B2.3 wires them), the module no-ops and
// isAuthConfigured() is false, so the app behaves exactly as it does today.
import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

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

const NOT_CONFIGURED = { error: { message: 'Sign-in is not available right now.' } };

export async function signInWithMagicLink(email) {
  const c = getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function verifyCode(email, token) {
  const c = getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.verifyOtp({ email, token, type: 'email' });
}

export async function signOut() {
  const c = getClient();
  if (!c) return { error: null };
  return c.auth.signOut();
}

// React hook exposing { session, user, status }. status ∈
// 'loading' | 'authenticated' | 'anonymous'. When auth is not configured the
// hook settles on 'anonymous' immediately and never subscribes.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const c = getClient();
    if (!c) {
      setStatus('anonymous');
      return;
    }
    let active = true;
    c.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'anonymous');
    });
    const { data: sub } = c.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'authenticated' : 'anonymous');
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, status };
}
