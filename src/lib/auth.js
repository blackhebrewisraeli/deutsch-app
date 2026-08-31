// Identity surface for B2 — language-blind. The only module that imports
// @supabase/supabase-js. Reads the PUBLIC Supabase vars (anon key is public
// by design; RLS is the authorization layer). When the vars are absent
// (CI, or any environment before B2.3 wires them), the module no-ops and
// isAuthConfigured() is false, so the app behaves exactly as it does today.
import { useState, useEffect } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Google sign-in needs both an auth backend AND the flag, because the flag
 * alone cannot tell you whether an owner finished the Google Cloud + Supabase
 * provider setup (docs/AUTH_GOOGLE_OAUTH_RUNBOOK.md). Absent var means OFF,
 * matching SYNC_ENABLED / LEAGUES_ENABLED.
 *
 * NOTE: Vite inlines env at build time, so flipping this in a dashboard does
 * nothing until the app is rebuilt.
 */
export function isGoogleAuthConfigured() {
  return isAuthConfigured() && import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
}

// @supabase/supabase-js pulls in ~816KB of source (auth, postgrest, storage,
// realtime, functions) and none of it is needed to paint the app — a guest can
// use every tab without it. It is loaded on demand instead, so it lands in its
// own chunk rather than in the critical path.
//
// The promise is cached, not the client, so concurrent callers during the load
// share one import and one createClient rather than racing to build several.
// Notified the first time a client actually exists. useAuth uses this to pick
// up a session for a visitor who arrived as a guest (so the chunk was skipped)
// and then signed in — signing in loads the client, and this is how the hook
// finds out it can finally subscribe.
const clientReadyListeners = new Set();

let clientPromise = null;
function getClient() {
  if (!isAuthConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      for (const fn of clientReadyListeners) fn(c);
      return c;
    });
  }
  return clientPromise;
}

/**
 * Classify the current URL as an auth callback without loading the SDK.
 *
 * - `'pending'` — credential present (PKCE `?code=` or implicit hash tokens)
 * - `'error'` — provider reported failure (`?error=` / `#error=` / expired OTP)
 * - `null` — not an auth callback
 *
 * Patterns live here once. `mayHaveSession()` reuses this so the detection
 * regexes are never hand-copied (same defect class as duplicated palettes).
 */
export function authCallbackKind(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return null;
  const search = loc.search || '';
  const hash = loc.hash || '';

  // Errors win — an expired-link hash still carries type=magiclink-style noise
  // in some providers, but `error=` is the signal the user must see.
  if (/[?&](error|error_description|error_code)=/.test(search)) return 'error';
  if (/(?:^|[&#])(error|error_description|error_code)=/.test(hash)) return 'error';

  if (/[?&]code=/.test(search)) return 'pending';
  if (/access_token=|refresh_token=|type=(magiclink|recovery|invite|signup)/.test(hash)) {
    return 'pending';
  }
  return null;
}

/**
 * Why did this auth callback fail? Companion to authCallbackKind — the URL
 * patterns live here, in one place, and are never re-derived in a component.
 *
 * - `'cancelled'` — the user backed out of the provider's consent screen
 * - `'expired'`   — a magic link that timed out or was already used
 * - `'failed'`    — any other reported error
 * - `null`        — not an error callback at all
 *
 * ORDER MATTERS. Supabase reports an expired magic link as
 * `error=access_denied&error_code=otp_expired&…` — BOTH signals in one URL —
 * so testing access_denied first would label every expired link a
 * cancellation. Expired is checked first for exactly that reason.
 *
 * Deliberately separate from authCallbackKind rather than folded into it:
 * that function's `'pending' | 'error' | null` contract is what
 * mayHaveSession() branches on, and mayHaveSession() must stay fail-open.
 */
export function authCallbackReason(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return null;
  if (authCallbackKind(loc) !== 'error') return null;

  const raw = `${loc.search || ''}${loc.hash || ''}`;
  let blob;
  try {
    blob = decodeURIComponent(raw).toLowerCase();
  } catch {
    // A malformed percent-escape is not a reason to lose the error entirely.
    blob = raw.toLowerCase();
  }

  if (/otp_expired|expired/.test(blob)) return 'expired';
  if (/access_denied|user_denied|user_cancelled|consent_required/.test(blob)) return 'cancelled';
  return 'failed';
}

/**
 * Could this visitor possibly be signed in, without loading the SDK to ask?
 *
 * supabase-js persists its session in localStorage under `sb-<ref>-auth-token`.
 * If no such key exists and the URL is not an auth callback, there is nothing
 * for the client to restore — so a guest never pays for the 207KB chunk.
 *
 * Deliberately fail-open: every ambiguous case returns true and loads the SDK.
 * The storage key is a supabase-js implementation detail, so if it ever changes
 * the worst outcome is that we load the client exactly as we did before — never
 * that someone silently stops being signed in.
 */
export function mayHaveSession() {
  if (!isAuthConfigured()) return false;
  if (typeof window === 'undefined') return true;

  // Auth callback (pending credential or error) — client must load to finish
  // or so the UI can explain the failure. Fail-open: keep loading the SDK.
  if (authCallbackKind() !== null) return true;

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key) && localStorage.getItem(key)) return true;
    }
    return false;
  } catch {
    // localStorage unavailable (private mode) — cannot rule a session out.
    return true;
  }
}

const NOT_CONFIGURED = { error: { message: 'Sign-in is not available right now.' } };

/** Map Supabase/auth errors to short human copy — never surface raw SDK text. */
export function humanAuthError(error) {
  if (!error) return '';
  const raw = `${error.message || ''} ${error.code || ''} ${error.error_description || ''}`;
  const msg = raw.toLowerCase();
  if (error.status === 429 || /rate.?limit|too many|over_email_send_rate_limit/.test(msg)) {
    return 'Too many attempts — try again in a minute.';
  }
  if (/expired|otp_expired|token has expired|email link is invalid/.test(msg)) {
    return 'That code expired — resend.';
  }
  return 'Something went wrong — try again.';
}

export async function signInWithMagicLink(email) {
  const c = await getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

/**
 * Start the Google OAuth round trip. `redirectTo` is window.location.origin —
 * deliberately the same value signInWithMagicLink passes as emailRedirectTo,
 * so both flows need one allow-list entry per environment instead of two.
 *
 * The flag is checked here as well as in the UI: a stale tab left open across
 * a deploy that switched Google off must not be able to start a flow into a
 * provider that is no longer configured.
 */
export async function signInWithGoogle() {
  if (!isGoogleAuthConfigured()) return NOT_CONFIGURED;
  const c = await getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function verifyCode(email, token) {
  const c = await getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.verifyOtp({ email, token, type: 'email' });
}

/**
 * Ask Supabase to move this account to `email`.
 *
 * Nothing changes yet. Supabase mails a confirmation, and under "Secure email
 * change" — the default — it mails BOTH the current address and the new one,
 * and the change lands only once both are confirmed. That dual confirmation is
 * the real control on this flow: an attacker holding a stolen session still
 * cannot move the account without reaching the ORIGINAL mailbox.
 *
 * Deliberately NOT proxied through our own API. `auth.admin.updateUserById`
 * would let the server do it with the service-role key, but that skips the
 * confirmation emails entirely — trading the strongest control here for the
 * ability to run a server-side gate. The client call is the safer one.
 */
export async function requestEmailChange(email) {
  const c = await getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
}

/**
 * Confirm ONE side of an email change with the code from that inbox.
 *
 * `type: 'email_change'`, not `'email'` — the sign-in verifier's type would be
 * rejected for these codes. Which address the code came from decides what to
 * pass as `email`: the old address confirms the release, the new one confirms
 * the claim, and under secure email change both are required in either order.
 */
export async function verifyEmailChange(email, token) {
  const c = await getClient();
  if (!c) return NOT_CONFIGURED;
  return c.auth.verifyOtp({ email, token, type: 'email_change' });
}

export async function signOut() {
  const c = await getClient();
  // No client → already effectively signed out; report success, not an error
  // (unlike signIn/verify, which genuinely cannot proceed).
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
    let active = true;
    let unsubscribe = null;

    const attach = (c) => {
      // The effect can be torn down while the client chunk is still in flight.
      if (!active || !c || unsubscribe) return;
      c.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setStatus(data.session ? 'authenticated' : 'anonymous');
      });
      const { data: sub } = c.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next);
        setStatus(next ? 'authenticated' : 'anonymous');
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    };

    if (mayHaveSession()) {
      getClient().then((c) => {
        if (!active) return;
        if (!c) setStatus('anonymous');
        else attach(c);
      });
    } else {
      // Guest: settle immediately without fetching the Supabase chunk. If they
      // then sign in, that loads the client and this listener attaches, so the
      // UI still reacts to the new session.
      setStatus('anonymous');
      clientReadyListeners.add(attach);
    }

    return () => {
      active = false;
      clientReadyListeners.delete(attach);
      // Null when teardown beat the import; the `active` guard above then stops
      // the subscription from ever being created.
      unsubscribe?.();
    };
  }, []);

  return { session, user: session?.user ?? null, status };
}

/**
 * The Supabase client, or null when auth is not configured.
 * Returns a promise — the client is code-split, so callers must await it.
 */
export function getSupabase() {
  return getClient();
}

/** Returns the current session's JWT, or null if not signed in. */
export async function getAccessToken() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.access_token ?? null;
}
