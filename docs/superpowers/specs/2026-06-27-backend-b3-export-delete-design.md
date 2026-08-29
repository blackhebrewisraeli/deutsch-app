# B3 — Account Export & Delete Design

- **Date:** 2026-06-27
- **Status:** Approved
- **Author:** Claude Code (brainstormed with Semion)

---

## Scope

B3 delivers data-rights hygiene for signed-in users: a full data export and a
permanent account deletion, each behind a server endpoint and surfaced in the
Stats-tab `AccountSection`. Google OAuth and account linking are explicitly
out of scope for this phase — deferred to the Social Platform arc.

---

## Two server endpoints

Both endpoints live under `api/v1/account/`. Both require a valid Supabase
JWT in the `Authorization: Bearer <token>` header. The server validates the
token with `supabase.auth.getUser(token)` (using the service-role client so
the check is authoritative); a missing or invalid token returns `401
unauthorized`.

### `GET /api/v1/account/export`

Returns a JSON object the browser downloads as `sprachschule-export.json`.

**Response shape (200):**

```json
{
  "email": "user@example.com",
  "exportedAt": "2026-06-27T10:00:00.000Z",
  "data": {
    "srs": { /* all rows from srs_state for this user */ },
    "daily": { /* all rows from stats_daily for this user */ },
    "settings": { /* the settings row for this user, or null */ }
  }
}
```

The server fetches each table via the service-role client (bypasses RLS for
a clean single-pass read). The client receives the JSON blob and triggers a
`<a download>` click to save it.

> **Payload amended 2026-08-30.** The shape above omitted `decks`, a user-owned
> table holding custom decks the learner built. The cascade deleted it on account
> deletion while the export left it out, so "export my data" returned less than
> the account actually held — for two months, silently, because nothing compared
> the exported set against the user-owned set. `data.decks` is now part of the
> payload.
>
> `api/v1/account/export.js` now declares `EXPORTED_TABLES` and `EXCLUDED_TABLES`,
> and `export.test.js` asserts their union equals every user-owned table. A table
> must be classified as one or the other; being in neither is what happened here.
>
> `profiles` and `league_members` remain excluded **deliberately** rather than by
> omission, each with a stated reason — both are payload-shape decisions still
> open, not oversights.

### `DELETE /api/v1/account`

Permanently removes all user data.

**Server sequence (must be atomic enough that a partial failure leaves a
useful error — no silent half-deletes):**

1. Validate JWT → get `userId`.
2. Delete all rows in `srs_state` where `user_id = userId`.
3. Delete all rows in `stats_daily` where `user_id = userId`.
4. Delete the settings row in `settings` where `user_id = userId`.
5. Delete the auth user via `supabase.auth.admin.deleteUser(userId)`.
6. Return `204 No Content`.

If any step throws, return `500 server_error` — the client does NOT clear
local state on a non-2xx response.

**Client sequence (only on 204):**

1. Clear all localStorage keys (wipe local data — the user is gone).
2. Call `signOut()` from `src/lib/auth.js`.

---

## UI — `AccountSection` changes

Signed-in state gains two new affordances below the existing email +
"Last synced" + "Sign out" row:

### Export button

A secondary button: **"Export my data"**. On click:

1. Fetches `GET /api/v1/account/export` with the session JWT.
2. On success: creates a `Blob`, triggers a download named
   `sprachschule-export.json`.
3. On failure: shows an error toast "Export failed — try again."
4. Button shows a brief "Exporting…" disabled state while the request is
   in flight.

### Danger Zone

A clearly demarcated section below the export button:

- Red-bordered box (using `COLORS.red` / `COLORS.rust` from `theme.js`).
- Small-caps label **"DANGER ZONE"** in `FONTS.mono`.
- One line of explanatory copy: *"Permanently delete your account and all
  data. This cannot be undone."*
- A **"Delete account"** button (`BUTTON.danger` style — red background).

Clicking "Delete account" reveals an **inline confirmation** (no modal —
expands in place):

- Warning line: *"Are you sure? This will erase all your progress."*
- Two buttons side by side: **"Yes, delete everything"** (red) and
  **"Cancel"** (secondary).

Only clicking "Yes, delete everything" fires the `DELETE` request. "Cancel"
collapses the confirmation back to the single button.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| JWT missing / invalid | `401` from server; client shows toast "Please sign in again." |
| Export fetch fails | Toast "Export failed — try again." |
| Delete server error | Toast "Could not delete account — try again." Local data unchanged. |
| Delete succeeds | localStorage cleared → `signOut()` → user lands on guest state. |

---

## Testing

### Server endpoints (`api/v1/account/export.test.js`, `api/v1/account/delete.test.js`)

- Returns `405` for wrong HTTP method.
- Returns `401` when `Authorization` header is absent.
- Returns `401` when token is invalid (mock `getUser` returns error).
- Export: returns `200` with correct JSON shape (mock service client reads).
- Export: returns `500` when service client throws.
- Delete: returns `204` and calls delete + admin.deleteUser in order.
- Delete: returns `500` when a delete step throws (does not call deleteUser).

### `AccountSection` component (`AccountSection.test.jsx`)

- Signed-in: renders "Export my data" button.
- Signed-in: renders Danger Zone section with "Delete account" button.
- Clicking "Delete account" reveals the inline confirmation.
- Clicking "Cancel" hides the confirmation.
- Clicking "Yes, delete everything" calls the provided `onDelete` prop.
- Guest state: neither button rendered.

---

## Files touched

| File | Action |
|---|---|
| `api/v1/account/export.js` | Create |
| `api/v1/account/export.test.js` | Create |
| `api/v1/account/delete.js` | Create |
| `api/v1/account/delete.test.js` | Create |
| `src/components/stats/AccountSection.jsx` | Modify |
| `src/components/stats/AccountSection.test.jsx` | Modify |
| `src/lib/auth.js` | Modify (add `getSession` helper for JWT retrieval) |

---

## Conventions reminder

- Vitest `globals: false` — every test imports `{ describe, it, expect, vi }` from `'vitest'`.
- Inline styles only, tokens from `src/lib/theme.js`.
- Server endpoints use `sendError` from `api/_lib/respond.js` and
  `serviceClient` from `api/_lib/supabase.js`.
- Pre-commit hook runs full test suite — never bypass with `--no-verify`.
- Land via PR; never commit directly to `main`.
