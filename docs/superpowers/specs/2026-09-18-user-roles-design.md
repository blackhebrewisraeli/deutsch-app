# User roles + admin v1

- **Date:** 2026-09-18
- **Status:** implemented
- **Author:** Cursor (cloud agent), from a locked product brief
- **Scope:** identity-based admin permission, system-account classification, feedback inbox, read-only user list, block user. No shared-content management, no full permissions UI, no AI-quota change, no stats/league exclusion.

---

## 1 · Ground truth (verified 2026-09-18)

Verified against this repo's `main` (`e1db354`, including merged #281–#287) and a **read-only** look at production (`xcnnlczvxmuwcqwychox`). No production writes were made.

### 1.1 Auth is passwordless; identity is email

`src/lib/auth.js` wires magic link / email OTP and Google OAuth. There is no password. `requireAuth` (`api/_lib/auth-middleware.js`) calls `auth.getUser(jwt)` via the service role and currently returns `{ userId, email }` — it does **not** inspect `email_confirmed_at` or `identities`.

Google and magic-link can mint **different `auth.users` rows** for the same mailbox if they were never linked. Authority must therefore key on **verified email**, not on `user.id`. Linking (same user, two identities) must yield the same result: every verified identity email is considered.

### 1.2 Profiles are not an authorization store

Production `public.profiles` columns: `user_id`, `display_name`, `created_at`, `handle`, `avatar_path`. No role, no block flag.

Authenticated clients already have `GRANT UPDATE` on the whole table plus `update own profile` RLS. **Any new privilege column on `profiles` that authenticated can UPDATE is a self-promotion hole.** Admin must not be stored as a client-writable field. `user_metadata` / `app_metadata` / request `isAdmin` are untrusted.

### 1.3 Feedback is insert-only for clients

Production `public.feedback` exists (1 row at inspection). Columns match `20260916183000_feedback.sql`. **No `status`.** RLS: insert-own (including guest `user_id` NULL) for `anon` + `authenticated`; no select/update/delete policies. `service_role` has full access. Learners cannot read reports, including their own.

`docs/BACKLOG.md` still listed that migration as **Pending merge**. Production already has the table — the backlog entry is stale.

### 1.4 Account API pattern

Hobby cap is 12 serverless functions; the project currently deploys 10. Account logic lives in `api/_lib/accountEndpoints.js` behind `createAccountHandler` (method → origin → IP rate → `requireAuth` → identity rate → optional re-auth → `serviceClient` → `run`). AI lives in `api/_lib/aiEndpoints.js` and **does not authenticate**; quotas are per client IP. Admin role must not skip those quotas.

### 1.5 Guest path

`FeedbackButton` has no auth gate. Welcome / trial / local-only learning do not go through the account lane. Unchanged.

### 1.6 Stats and leagues

No filter today excludes an email, a role, or a “system” flag. Product decision: **do not add one.**

---

## 2 · Two concepts

| Concept | What it is | What it is not |
| --- | --- | --- |
| **Admin permission** | May call admin APIs: list/view/handle/delete feedback, read users, block/unblock | Does not raise AI quotas, does not hide the user from stats/leagues, is not stored in `localStorage` / `profiles` / JWT app metadata as source of truth |
| **System-account classification** | Label on the user list so the owner can see which identities are the system mailbox | Does not exclude from stats, leagues, XP, or historical data. Does not by itself grant admin |

v1 allowlists (exact match after trim + lowercase; no plus-address aliasing):

| Email | Admin | System account |
| --- | --- | --- |
| `esterkinshimon712@gmail.com` | yes | yes |
| `blackhebrewisraeli@gmail.com` | no | no |
| everyone else | no | no |

The lists are separate constants so they can diverge later without a redesign.

---

## 3 · Identity rule (server)

On every authenticated request the server runs `classifyAuthUser(user)` against the **Supabase user returned by `getUser`**, never against the request body.

**Verified emails** are the set of:

1. `user.email` when `user.email_confirmed_at` is set
2. Each `user.identities[]` entry whose email is verified:
   - `identity_data.email_verified === true` (Google)
   - `provider === 'email'` (magic-link / OTP identity exists only after verification)

Unverified addresses never grant admin, even if they match the allowlist.

Ignored: `user_metadata`, `app_metadata`, `user.role`, `req.body.isAdmin`, `profiles.*`, `localStorage`.

**Same identity, same authority.** A Google session and a magic-link session that both present the verified mailbox `esterkinshimon712@gmail.com` both classify as admin + system, whether they share a `user.id` (linked) or not (two rows).

---

## 4 · Data

Migration file only — **the owner applies it after merge.** Agents must not `db push` / `db pull` / `reset` / `migration repair` / MCP `apply_migration`.

### 4.1 `feedback`

- `status text not null default 'open'` with check `open | handled`
- `handled_at timestamptz`
- `handled_by uuid references auth.users(id) on delete set null`
- index `(status, created_at desc)`

Existing rows become `open`. Clients still have no select/update/delete policies; status changes go through the admin API (service role).

### 4.2 `profiles.blocked_at`

- `blocked_at timestamptz` (NULL = not blocked)
- Column-level grants: authenticated may UPDATE only `display_name`, `handle`, `avatar_path`. They may INSERT only learner fields. They cannot write `blocked_at`.
- Trigger: reject `blocked_at` changes unless `auth.role() = 'service_role'`.
- Trigger on `feedback` BEFORE INSERT: if `NEW.user_id` is a blocked profile, raise `42501`. Guests (`user_id` NULL) still insert.

No `is_admin` / `role` column. Classification is computed.

### 4.3 Block semantics (v1)

Enforced:

- Admin APIs other than `me` require admin permission (403 otherwise)
- `createAccountHandler` rejects blocked callers on profile PATCH and progress events/daily (403)
- Feedback INSERT from a blocked signed-in user (trigger)
- Client cannot clear `blocked_at` via PostgREST or `PATCH /api/v1/account/profile` (not in `EDITABLE_FIELDS`)

Deliberately unchanged:

- AI lane stays unauthenticated + IP-quota; admin JWT / `isAdmin` in the body does not skip the limiter
- Export and delete stay available to a blocked account (export-my-data / right to erasure)
- League join/refresh are not on `createAccountHandler`; v1 does not retouch them
- Guest path, local-only learning, trial wall

Unblock is the inverse of block (`blocked_at = null`). A one-way block with no undo is not operable. Admin identities cannot be blocked (would lock the only privileged mailbox out of the inbox).

---

## 5 · API

One new serverless file, `api/v1/admin.js` (11 / 12 Hobby functions). Dispatch on `req.query.op`, same pattern as `api/v1/ai.js`. Built with `createAccountHandler` so origin + rate + JWT checks are not re-invented.

| op | method | who | does |
| --- | --- | --- | --- |
| `me` | GET | any authenticated, including blocked | `{ isAdmin, isSystemAccount, blocked }` from server classification + `profiles.blocked_at` |
| `feedback` | GET | admin | list, newest first, optional `status`, limit 100. Full row including `item_label` (owner-only; that field is the concealed answer) |
| `feedback` | PATCH | admin | `{ id, status: 'open' \| 'handled' }` — sets/clears `handled_at` / `handled_by` |
| `feedback` | DELETE | admin | `{ id }` or `?id=` |
| `users` | GET | admin | read-only list: `userId`, `email`, `handle`, `createdAt`, `blockedAt`, `isAdmin`, `isSystemAccount`, `providers` |
| `block` | POST | admin | `{ userId, blocked?: boolean }` default `blocked: true` |

401 without a valid JWT. 403 for a valid non-admin JWT. Request fields never grant permission.

Pretty URLs via `vercel.json` rewrites (optional aliases). The client calls `/api/v1/admin?op=…` so the function works without a rewrite.

---

## 6 · Client

- `useAdminSession(user)` fetches `me` when `user?.id` is set; **synchronously** clears `{ me: null }` when `user` is null. Does not read or write `localStorage` for permission.
- Sign-out already hard-reloads via `signOutAndReset`. Account switch changes `user.id` and refetches.
- Settings gains an **Admin** section only after `me.isAdmin === true`. Guest / other accounts see no chrome and no data.
- Inbox: list, status filter, mark handled / reopen, delete (two-step confirm).
- Users: read-only rows, system/admin labels, Block / Unblock (two-step). Cannot target an admin identity.
- Blocked non-admin: a banner in Settings; no admin chrome.
- Inline styles, tokens from `src/lib/theme.js`. Grid tracks `minmax(0, 1fr)`. No new storage keys, no font changes.

---

## 7 · AI quotas

`createAiHandler` is not modified. Tests pin that an `Authorization` header and `body.isAdmin` do not raise the chat quota. `userTierOf` does not treat `isAdmin` as `pro`.

---

## 8 · Tests (the denial suite)

Must prove:

1. Unverified allowlist email → not admin
2. Verified `esterkinshimon712@gmail.com` via primary email **or** Google identity **or** email identity → admin + system
3. Verified `blackhebrewisraeli@gmail.com` → neither
4. `user_metadata` / `app_metadata` / `body.isAdmin` cannot elevate
5. Non-admin JWT → 403 on feedback list/patch/delete, users, block
6. Profile PATCH ignores `blocked_at` / `role` / `isAdmin`
7. Admin role does not skip AI rate limits
8. Sign-out / `user=null` hides admin UI
9. `stats.js` and `leagueLogic.js` do not import the role module
10. RLS (local stack, `npm run test:rls`): client cannot UPDATE `blocked_at`; client cannot SELECT/UPDATE/DELETE feedback; blocked user cannot INSERT feedback

---

## 9 · Out of scope

Shared content management, a general permissions UI, phone OTP, excluding system/test activity from stats or leagues, unlimited AI for admins, storage-key renames, applying the migration from this agent, mutating production data.
