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

## 5. Registration policy

Google signup is currently open. That is how `fateevvl@gmail.com` got an
account.

Decide one of:

- Keep open signup (anyone with a Google account can join).
- Allowlist (Supabase Auth hooks / disable provider for unknown emails —
  needs a short spec; do not invent this in the dashboard without one).
- Disable public signup and issue invites only.

Record the decision here or in `docs/BACKLOG.md` once it is made. Do not
flip `enable_signup` in production as a drive-by.

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

## 8. Apply pending migrations from the security-hardening PR

Repo file: `supabase/migrations/20260918200000_revoke_is_league_member_execute.sql`.

Moves `is_league_member` to schema `private` (not in PostgREST's exposed
schemas) and points both league RLS policies at it. `authenticated` keeps
`EXECUTE` there — PostgreSQL checks that privilege when evaluating RLS,
so revoking it in `public` 42501'd every league SELECT. Dropping the
public function is what closes `/rpc/is_league_member`.

1. Open the production SQL editor for Sprachschule.
2. Paste the file **verbatim**. Run it.
3. Do **not** `supabase migration repair`, `db push`, `db pull`, or
   `db reset`. Do not apply via MCP.
4. Smoke-test leagues: sign in, open Stats → Ligen, confirm standings
   load. A 42501 on that SELECT means the private-schema grants did not
   land; do not recreate `public.is_league_member`.
5. Confirm Migration Drift (`.github/workflows/migration-drift.yml`) sees
   the new name. Ignore a red **Supabase Preview** check — that asks the
   inverse question and is stale on `main` on purpose (`AGENTS.md`).

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
