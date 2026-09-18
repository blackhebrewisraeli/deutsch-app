# Pre-beta owner checklist

**Owner-only.** Manual dashboard steps for when the owner is back. Nothing
here can be finished from the repo: each item needs the Supabase, Vercel,
GitHub, or Google Cloud console. Agents must not apply production
migrations, rotate keys, disable Google auth, or delete users.

Companion runbooks:

- Magic Link template + redirect URLs → `docs/AUTH_EMAIL_TEMPLATE_RUNBOOK.md`
- Google OAuth provider → `docs/AUTH_GOOGLE_OAUTH_RUNBOOK.md`
- Recurring owner actions that stay queued → `docs/BACKLOG.md`

Do **not** paste secret values into chat, tickets, or commit messages. Confirm
presence and last-rotated date only.

---

## 1. Confirm or rotate the Supabase secret / service_role key

Only if a leak is confirmed (secret-scanning alert, paste in a ticket, or a
`VITE_`-prefixed copy in Vercel).

1. Supabase → project **Sprachschule** → **Settings → API Keys**.
2. Rotate the **secret** / legacy **service_role** key. Do not create a new
   key *named* `service_role` — that name is reserved.
3. Vercel → project → **Settings → Environment Variables** → update
   **`SUPABASE_SERVICE_ROLE_KEY`** on Production and Preview.
   - **Never** `VITE_SUPABASE_SERVICE_ROLE_KEY`. Vite inlines every `VITE_*`
     var into the public bundle.
4. Redeploy. The functions read this at runtime; a dashboard edit without a
   new deploy is enough for serverless, but Preview branches that were built
   with a stale value still need a rebuild if anything baked it in.

If no leak is confirmed, skip rotation. Presence of the key in Vercel is
expected.

## 2. Review GitHub secret-scanning alerts

GitHub → **Security → Secret scanning**. Open every alert.

- A real cloud service_role / secret key, Anthropic key, or Sentry write
  token → treat as a leak and rotate (step 1 / the matching provider).
- A false positive from a placeholder (`your_local_service_role_key_here`)
  → dismiss with a note. `.env.example` already uses a non-triggering
  placeholder for the local service-role key for this reason.

## 3. Magic Link template + redirect URLs

Hosted Auth does not pick up `supabase/templates/magic_link.html` by itself.

1. Follow `docs/AUTH_EMAIL_TEMPLATE_RUNBOOK.md` — paste the repo template
   into **Authentication → Email Templates → Magic Link**.
2. **Authentication → URL Configuration**:
   - Site URL → `https://deutsch-app-dusky.vercel.app`
   - Redirect URLs → production origin, `http://localhost:5173`,
     `http://127.0.0.1:5173` (exact match, no wildcards for the local pair)

Send one real magic-link email and confirm both the 6-digit code and the
link still sign in.

## 4. Auth custom domain / Google OAuth branding

Google's consent screen and redirect currently show
`xcnnlczvxmuwcqwychox.supabase.co` (see
`docs/AUTH_GOOGLE_OAUTH_RUNBOOK.md` §4). That hostname is the public API
subdomain, not a secret, but it looks like an unverified third party.

Decide and, if shipping, do both:

1. Supabase → **Authentication → Custom Domains** (or Auth Hooks / URL
   config, depending on plan) — put Auth behind a first-party host.
2. Google Cloud → **Clients** → authorized redirect URI must become the
   **new** `/auth/v1/callback`, not the old `*.supabase.co` URL. Leaving
   the old URI is the usual `redirect_uri_mismatch`.

Do **not** disable the Google provider while doing this. The live flag
`VITE_GOOGLE_AUTH_ENABLED` stays on.

## 5. Registration policy (optional email allowlist)

Google signup is currently **open**. That is how `fateevvl@gmail.com` got an
account. The repo now has an optional allowlist so you can lock signup for
beta **without a code change and without touching the Google provider**.

**Default (do nothing):** `SIGNUP_EMAIL_ALLOWLIST` and
`VITE_SIGNUP_EMAIL_ALLOWLIST` unset or empty → current behaviour. Anyone
who completes Google or magic-link can keep a session. Production stays
open until you set these.

**To close signup for beta:**

1. Vercel → project → **Settings → Environment Variables**.
2. Add **`SIGNUP_EMAIL_ALLOWLIST`** (server, not `VITE_`) on Production
   and Preview, comma-separated. Example:
   `esterkinshimon712@gmail.com,friend@example.com`
   - Exact match after trim + lowercase. No plus-address aliasing.
   - Always include `esterkinshimon712@gmail.com` or you lock yourself out
     of account/admin APIs.
3. Add **`VITE_SIGNUP_EMAIL_ALLOWLIST`** with the **same list**. Vite
   inlines `VITE_*` at build time; this is the client UX so a rejected
   user sees "This email isn't invited" instead of a generic failure.
   Server enforcement still holds if you only set the non-`VITE_` var
   (privileged `/api/v1/*` calls 403 `signup_not_allowed`), but the
   session can look signed-in until they hit an API.
4. **Redeploy.** Env edits do not rebuild the client bundle on their own.
5. Smoke-test: sign in as the admin mailbox (must work). Try a second
   Google account that is not on the list — the app must sign that
   session out and explain closed beta. Guests (Continue without account)
   must still work. Google itself stays enabled.

Do **not** flip `enable_signup` in the Supabase dashboard. Do **not**
disable the Google provider. Do **not** delete users from an agent
session. Existing Auth users (including `fateevvl@gmail.com`) stay in
`auth.users`; they simply cannot keep a session while the list is on
unless you add them. Remove both vars and redeploy to re-open signup.

The gate lives in `requireAuth` (`api/_lib/auth-middleware.js`), which
every account / league / progress / admin handler already calls. Guests
never present a JWT.

## 6. Decision on `fateevvl@gmail.com`

An unexpected Google signup. Options: **block** (admin v1,
`profiles.blocked_at`), **delete** (B3 export/delete), or **keep**.

Do **not** delete the user from an agent session. If blocking, use the
admin UI as the owner. Note the choice next to this item.

## 7. Enable leaked-password protection

Supabase advisor WARN `auth_leaked_password_protection` is currently
firing: Auth is not checking passwords against HaveIBeenPwned.

Dashboard: **Authentication → Attack Protection** (or **Providers → Email**
password security) → enable **Leaked password protection**.

This is a hosted Auth setting. Editing `supabase/config.toml` only affects
local `supabase start`.

## 8. Apply pending security-hardening migrations

Two files, in this order. Open the production SQL editor for Sprachschule.
Paste each file **verbatim**. Run it. Do **not** `supabase migration
repair`, `db push`, `db pull`, or `db reset`. Do not apply via MCP.

### 8a. `#290` — `is_league_member` off the PostgREST surface

Repo file: `supabase/migrations/20260918200000_revoke_is_league_member_execute.sql`.

Still unapplied as of 2026-09-18. Moves `is_league_member` to schema
`private` (not in PostgREST's exposed schemas) and points both league RLS
policies at it. `authenticated` keeps `EXECUTE` there — PostgreSQL checks
that privilege when evaluating RLS, so revoking it in `public` 42501'd
every league SELECT. Dropping the public function is what closes
`/rpc/is_league_member`.

After it runs: sign in, open Stats → Ligen, confirm standings load. A
42501 on that SELECT means the private-schema grants did not land; do not
recreate `public.is_league_member`.

### 8b. Advisor 0008 — deny-all policies on server-only tables

Repo file: `supabase/migrations/20260918213000_server_only_rls_deny_policies.sql`.

Apply **after** 8a. Adds deny-all RLS policies (`USING false` /
`WITH CHECK false`) for `anon` and `authenticated` on `rate_limits` and
`progress_events_seen`. RLS stays enabled. No client grants. `service_role`
keeps `GRANT ALL` (it bypasses RLS). Learners never hit these tables;
there is no UI smoke test. Confirm advisor INFO `rls_enabled_no_policy`
clears for both tables, and Migration Drift sees the new name.

Ignore a red **Supabase Preview** check — that asks the inverse question
and is stale on `main` on purpose (`AGENTS.md`).

## 9. Merge the outstanding docs PR if it is still open

`#289` (`chore(docs): mark user roles + admin as shipped`) landed on
`main` 2026-09-18. If another docs-only PR is open when you return, merge
or close it so `docs/BACKLOG.md` owner-action rows do not fork.

---

## Out of scope (do not do from this list)

- Applying migrations from Cursor / Claude Code / MCP.
- Disabling Google auth in production.
- Deleting users.
- Touching Chat redesign (`ChatTab`, `src/components/chat/**`,
  chat-redesign specs) — Piccolo owns that.
