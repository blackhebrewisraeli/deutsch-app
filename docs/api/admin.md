# Admin API (v1)

Owner-only operations. Spec:
`docs/superpowers/specs/2026-09-18-user-roles-design.md`.

One serverless function: `api/v1/admin.js`, Hobby-cap safe. Dispatch is
`req.query.op` (same pattern as `/api/v1/ai`). Pretty paths are rewrites.

**Auth:** Bearer JWT via `requireAuth`. Permission is computed from **verified
emails** on the Supabase user (`api/_lib/roles.js`). Request bodies,
`user_metadata`, `app_metadata`, and `profiles` columns cannot grant admin.

**Roles are two concepts.** `isAdmin` is permission. `isSystemAccount` is a
label. v1 both map to `esterkinshimon712@gmail.com`. System classification
does not exclude anyone from stats or leagues. Admin does not raise AI quotas.

## Endpoints

Base: `/api/v1/admin?op=<op>`

| op | method | who | body / query | success |
| --- | --- | --- | --- | --- |
| `me` | GET | any signed-in user, including blocked | — | `{ isAdmin, isSystemAccount, blocked }` |
| `feedback` | GET | admin | optional `status=open\|handled` | `{ items: FeedbackRow[] }` newest first, max 100 |
| `feedback` | PATCH | admin | `{ id, status }` | the stored row |
| `feedback` | DELETE | admin | `{ id }` or `?id=` | 204 |
| `users` | GET | admin | — | `{ items: UserRow[] }` |
| `block` | POST | admin | `{ userId, blocked?: boolean }` | `{ userId, blockedAt }` |

`me` is the only op a non-admin may call. A missing/invalid JWT is `401
unauthorized`. A valid non-admin JWT on any other op is `403 forbidden`.

Admin identities cannot be blocked (`400`).

## FeedbackRow

`id`, `user_id`, `surface`, `cefr_level`, `deck_id`, `item_id`, `item_label`,
`category`, `message`, `created_at`, `status`, `handled_at`, `handled_by`.

`item_label` can be the concealed answer of a drill. It is owner-only; learners
have no SELECT on `feedback`.

## UserRow

`userId`, `email`, `handle`, `createdAt`, `blockedAt`, `isAdmin`,
`isSystemAccount`, `providers` (e.g. `['google']`, `['email']`).

Read-only. The only mutation is `block`.

## Errors

Same envelope as the rest of `/api/v1/` (`docs/api/README.md`).
