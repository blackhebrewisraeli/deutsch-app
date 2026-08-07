# Auth email template — owner runbook

**Owner-only.** The sign-in template is version-controlled under
`supabase/templates/magic_link.html` and wired for local GoTrue via
`supabase/config.toml` (`[auth.email.template.magic_link]`). The **hosted**
Supabase project does **not** pick that file up automatically — Auth email
templates there are dashboard settings. Paste once after any template change
so production emails stay in sync with the repo.

Companion to Phase C of
`docs/superpowers/specs/2026-08-02-auth-overhaul-design.md`.

## Why this exists

B2 designed every sign-in email to carry **both** a magic link
(`{{ .ConfirmationURL }}`) and a 6-digit code (`{{ .Token }}`). When the
template lived only in the dashboard, it drifted: users sometimes got a link,
sometimes a code. The repo copy is the source of truth; this runbook is the
one-time (and on-change) sync into production.

## One-time / on-change: paste into the hosted dashboard

1. Open the production Supabase project → **Authentication** → **Email
   Templates**.
2. Select the **Magic Link** template (used for email OTP / magic-link
   sign-in).
3. Set the **Subject** to match `supabase/config.toml`:

   `Your sign-in code for Deutsch · Sprachschule`

4. Replace the **Body** with the full contents of
   `supabase/templates/magic_link.html` (HTML source). Confirm both of these
   GoTrue placeholders remain:

   - `{{ .Token }}` — 6-digit code (primary for the installed PWA)
   - `{{ .ConfirmationURL }}` — magic link (browser convenience)

5. Save.

## Verify (do not skip)

1. From the production app, request a sign-in email to a real inbox you
   control.
2. Confirm the message shows the **6-digit code** and a working **link**.
3. Enter the code in the installed PWA; separately open the link in a
   browser — both should sign in.
4. Optional: the uptime auth monitor still only asserts the OTP round trip;
   it does **not** scrape email bodies. Body checks stay manual until that
   is extended.

## Local development

`supabase start` loads the template from `config.toml` automatically. No
dashboard step for local GoTrue. Redirect URLs for local Vite are documented
alongside `site_url` in `supabase/config.toml` (Phase C Task 4).

## Out of scope here

- Resend / SMTP credentials (already wired in B2.3).
- Google OAuth (Phase D) and phone/SMS OTP (Phase E).
- Guest trial wall (separate mission after Phase C).
