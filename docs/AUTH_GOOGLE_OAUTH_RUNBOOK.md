# Google OAuth ("Continue with Google") — owner runbook

**Owner-only.** Every step below is a dashboard action in Google Cloud,
Supabase or Vercel. None of them can be done from the repo, and nothing in the
codebase can verify them — the code ships dark until they are complete.

Companion to Phase D of
`docs/superpowers/specs/2026-08-02-auth-overhaul-design.md`.

## State today

The button, `signInWithGoogle()`, and the callback copy are all merged and
inert. `isGoogleAuthConfigured()` is `isAuthConfigured() && VITE_GOOGLE_AUTH_ENABLED === 'true'`,
and `GoogleButton` renders `null` when that is false — so with the flag off
there is no Google affordance anywhere and no way to start a flow.

Turning it on takes **two** things, and neither works without the other:

1. The provider config in steps 1–6 below.
2. `VITE_GOOGLE_AUTH_ENABLED=true` **plus a redeploy** (step 7).

## 1 · Google Cloud — OAuth consent screen

1. <https://console.cloud.google.com> → create or select a project.
2. **APIs & Services → OAuth consent screen**.
3. User type: **External**. (Internal requires a Google Workspace org.)
4. Fill in:
   - **App name** — `Deutsch · Sprachschule`
   - **User support email** — your address
   - **Developer contact information** — your address
5. Save and continue through Scopes and Test users. The default scopes
   (`openid`, `email`, `profile`) are all Supabase needs — do not add more.

**Optional, and fine to defer:** uploading a logo and verifying the domain.
Both are only required to leave "Testing" mode and remove the unverified-app
interstitial. While in Testing, only accounts listed under **Test users** can
complete sign-in — add your own address there before verifying in step 8.

## 2 · Google Cloud — create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name it something recognisable (`deutsch-app web`).

## 3 · Authorized JavaScript origins

Add both:

- `https://deutsch-app-dusky.vercel.app` (production)
- `http://localhost:5173` (Vite dev server)

## 4 · Authorized redirect URI — the step people get wrong

Add **exactly** this:

```
https://xcnnlczvxmuwcqwychox.supabase.co/auth/v1/callback
```

**This is Supabase's callback, not the app's.** Google redirects to
*Supabase*, which completes the exchange and only then sends the browser on to
the app. Pasting the app's own origin here is the single most common mistake
and produces a `redirect_uri_mismatch` error at Google before Supabase is ever
reached.

The project ref (`xcnnlczvxmuwcqwychox`) is the one already in `.env.example`.

Then **Create**, and keep the **Client ID** and **Client secret** on screen for
the next step.

## 5 · Supabase — enable the Google provider

1. Supabase dashboard → the production project → **Authentication** →
   **Providers** → **Google**.
2. Toggle **Enable Sign in with Google**.
3. Paste the **Client ID** and **Client secret** from step 4.
4. Save.

## 6 · Supabase — URL configuration

Same allow-list Phase C documented (`docs/AUTH_EMAIL_TEMPLATE_RUNBOOK.md`).
Google needs no additional entries, because `signInWithGoogle()` passes the
same `redirectTo` that the magic link passes as `emailRedirectTo` —
`window.location.origin` — deliberately, so there is one entry per environment
rather than two.

**Authentication → URL Configuration → Redirect URLs** must include:

- `https://deutsch-app-dusky.vercel.app`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

## 7 · Vercel — the flag, then a redeploy

1. Vercel project → **Settings → Environment Variables**.
2. Add `VITE_GOOGLE_AUTH_ENABLED` = `true` to **Preview** and **Production**.
3. **Redeploy.**

> **Setting the variable is not enough.** Vite inlines `import.meta.env.*` at
> **build** time, so the value is baked into the bundle. Until a new build
> runs, the deployed app still contains `undefined` and the button stays
> hidden. This is the same trap that applies to `VITE_SYNC_ENABLED` and
> `VITE_LEAGUES_ENABLED`.

To try it locally first: put `VITE_GOOGLE_AUTH_ENABLED=true` in `.env.local`
(git-ignored) and restart `npm run dev`.

## 8 · Verify (do not skip)

Run these against the deployed app, in a fresh browser profile.

- [ ] **Happy path.** Sign-in surface shows **Continue with Google** above the
      email form. Tap it → Google consent → land back in the app signed in,
      with the account chip showing your address.
- [ ] **Cancellation.** Start again and press **Cancel** / back out at the
      consent screen. The app must show **"Sign-in cancelled" — "No problem —
      you can try again whenever you like."** If it says *"That link
      expired"*, the callback reason is being misclassified — report it, do
      not work around it.
- [ ] **Email still works.** The 6-digit code flow is unchanged and still
      signs in.
- [ ] **Flag off is clean.** With the flag off (or before the redeploy) there
      is no Google button and no stray "or" divider on any surface.

### The auto-link check — the one worth doing carefully

- [ ] Sign in with an **email code** first. Note the progress on the account.
- [ ] Sign out.
- [ ] Sign in with **Google, using the same email address**.
- [ ] Confirm you land in **one** account — same user id, same progress — and
      not a second empty one.

**This is unverified from the repo.** The spec's §4 claim that Supabase links a
Google identity to an existing email user with a matching address depends on
the hosted project's identity-linking settings, which nothing in this
codebase can read. Treat it as an assumption until this check passes.

If it produces **two** accounts, the flag should go back to `false` while it
is sorted out: Supabase's account-linking behaviour is configured under
**Authentication → Providers** / identity linking, and merging two real
accounts after the fact is far more painful than preventing the split.

## Rollback

Set `VITE_GOOGLE_AUTH_ENABLED=false` (or remove it) and redeploy. The button
disappears, `signInWithGoogle()` refuses even if a stale tab calls it, and
every surface returns to the email-only rendering. Nothing else in the app
depends on Google, and no stored data changes.

## Cost

None. Google Cloud OAuth clients and consent screens are free, and Supabase's
Google provider is included in the free tier. This was Decision 6 in the spec:
no paid component before the first public version.
