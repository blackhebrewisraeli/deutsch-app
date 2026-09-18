# User roles + admin v1 — implementation plan

**Goal:** Ship identity-based admin (feedback inbox + read-only users + block) with system-account classification as a separate label, enforced only on the server.

**Spec:** `docs/superpowers/specs/2026-09-18-user-roles-design.md`

**Tech stack:** existing React 18 + Vite 5 + Vitest, `createAccountHandler`, one new Vercel function under the Hobby cap, one unapplied SQL migration.

## Global constraints

- Branch from up-to-date `main`. Land via PR. Never `--no-verify`. Never commit to `main`.
- `npm install --legacy-peer-deps`. Done = `npm test`, `npm run lint`, `npm run format:check`.
- Inline styles + `src/lib/theme.js` tokens. Grid tracks `minmax(0, 1fr)`.
- No storage-key rename. No font change. No German literals in `src/lib/*` / `api/*`.
- **Do not apply the migration.** Do not `supabase db push|pull|reset`, `migration repair`, or MCP `apply_migration`. Production is live.
- System/test activity stays in stats and leagues. Admin does not raise AI quotas.
- Guest path unchanged.

## File list

| File | Action | Responsibility |
| --- | --- | --- |
| `docs/superpowers/specs/2026-09-18-user-roles-design.md` | Create | Locked design |
| `docs/superpowers/plans/2026-09-18-user-roles.md` | Create | This plan |
| `docs/api/admin.md` | Create | Admin API contract |
| `docs/api/data.md` | Modify | `feedback.status*`, `profiles.blocked_at`; note feedback migration is applied |
| `docs/BACKLOG.md` | Modify | Mark feedback migration applied; queue roles migration for the owner |
| `supabase/migrations/20260918153000_user_roles.sql` | Create | status + handled columns; `blocked_at`; column grants; protect + reject-blocked triggers |
| `supabase/tests/rls/roles.test.js` | Create | client cannot write `blocked_at`; blocked cannot insert feedback |
| `supabase/tests/rls/feedback.test.js` | Modify | cannot patch `status` via PostgREST |
| `supabase/tests/rls/policies.test.js` | Modify | own-row update still works; `blocked_at` not writable |
| `api/_lib/roles.js` | Create | allowlists, verified-email extraction, `classifyAuthUser` |
| `api/_lib/roles.test.js` | Create | identity matrix + ignore metadata |
| `api/_lib/auth-middleware.js` | Modify | return `user` from `getUser` |
| `api/_lib/auth-middleware.test.js` | Modify | assert `user` is passed through |
| `api/_lib/accountHandler.js` | Modify | classify; optional `requireAdmin`; default block check; injectable `readBlockedAt` |
| `api/_lib/accountHandler.test.js` | Modify | 403 non-admin; 403 blocked; inject `readBlockedAt` |
| `api/_lib/accountEndpoints.js` | Modify | export/delete `allowBlocked: true`; profile allowlist already excludes new fields |
| `api/v1/account/profile.test.js` | Modify | ignore `blocked_at` / `role` / `isAdmin` |
| `api/v1/progress/events.test.js` | Modify | mock `profiles.blocked_at` read |
| `api/_lib/adminEndpoints.js` | Create | `me` / feedback / users / block handlers |
| `api/_lib/adminEndpoints.test.js` | Create | access-denial suite |
| `api/v1/admin.js` | Create | dispatcher |
| `api/v1/admin.test.js` | Create | unknown op / method |
| `vercel.json` | Modify | rewrites for `/api/v1/admin/*` |
| `src/lib/adminApi.js` | Create | client fetchers |
| `src/lib/adminApi.test.js` | Create | URL/method/body; 403 surfaces |
| `src/lib/useAdminSession.js` | Create | fetch `me` keyed on `user.id`; clear on null |
| `src/lib/useAdminSession.test.js` | Create | sign-out clears; no localStorage |
| `src/components/admin/AdminSection.jsx` | Create | Feedback / Users panels |
| `src/components/admin/AdminSection.test.jsx` | Create | hidden unless `isAdmin`; actions call API |
| `src/components/admin/FeedbackInbox.jsx` | Create | list, status, delete |
| `src/components/admin/FeedbackInbox.test.jsx` | Create | render + handle/delete |
| `src/components/admin/UserList.jsx` | Create | read-only list + block |
| `src/components/admin/UserList.test.jsx` | Create | block calls API; admin row has no block |
| `src/components/settings/SettingsRoute.jsx` | Modify | Admin section + blocked banner |
| `src/components/settings/SettingsRoute.test.jsx` | Modify | guest/other hidden; admin shown |
| `src/lib/ai-routing/preference.test.js` | Modify | `isAdmin` is not `pro` |
| `api/v1/ai/chat.test.js` | Modify | admin JWT / `isAdmin` body still rate-limited |

## Acceptance criteria

- [ ] Verified `esterkinshimon712@gmail.com` (Google **or** magic-link identity) is admin + system on the server
- [ ] `blackhebrewisraeli@gmail.com` and other users are not
- [ ] Unverified email matching the allowlist is not admin
- [ ] Every admin action 403s for a non-admin JWT; 401 without a JWT
- [ ] `localStorage` / profile fields / `user_metadata` / request fields cannot elevate
- [ ] Guest path unchanged
- [ ] Admin UI gone when `user` is null (sign-out / switch)
- [ ] Admin role does not unlock AI quotas
- [ ] System accounts are not filtered out of stats/leagues
- [ ] Migration file present; PR tells the owner to apply it; agent made no production data changes
- [ ] `npm test`, `npm run lint`, `npm run format:check` green
