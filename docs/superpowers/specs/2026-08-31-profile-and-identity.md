# Profile & Identity Overhaul — the Learning Passport

- **Date:** 2026-08-31
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Related:** `2026-08-29-dashboard-and-settings-design.md` (#190–#193) built Settings;
  `social-leagues` (#93–#96, live 2026-06-27) built `profiles.handle` / `avatar_emoji`.

---

## 1 · What this is

Three phases: identity and settings, an uploaded-avatar system on Supabase Storage, and a rich
profile card.

**Five of the brief's premises did not survive verification, and one of them changes what Phase 1
is.** They are recorded in §2 before any design, because in each case the design that follows only
makes sense once the premise is corrected.

---

## 2 · Ground truth (verified 2026-08-31, against code and the production database)

### 2.1 There is no password to update

The brief asks for "Supabase Auth flows for updating email and password." **The app has no password
authentication of any kind.** `src/lib/auth.js` wires exactly three calls:

| | |
| --- | --- |
| `signInWithOtp` | magic link / 6-digit email code |
| `signInWithOAuth` | Google |
| `verifyOtp` | code confirmation |

A repo-wide search for `signInWithPassword`, `resetPasswordForEmail`, `type="password"` and
`newPassword` across `src/` and `api/` returns **nothing**. `AuthSheet` offers email-or-Google and
has no password field.

So "update your password" is not a settings screen. It is **adding password authentication to a
deliberately passwordless product** — a new sign-in method, a reset flow, a breach-exposure
surface, and a credential-stuffing target, in exchange for no capability the learner lacks today.

**Decision D1: do not add passwords.** Email change is real and unwired, and it is specified below
(§4.2). If passwords are wanted anyway, that is a standalone epic with its own security review, not
a line item inside a profile overhaul.

### 2.2 Settings is already sectioned; the actual defect is duplication

`SettingsRoute.jsx` already renders four labelled sections — **Profil, Lernen, Darstellung,
Konto** — in German, from the pack. It is not unstructured.

The real problem is that **identity is editable in two places at once**:

| file | edits |
| --- | --- |
| `ProfileSection.jsx` | `display_name`, `handle`, `avatar_emoji` (via `updateHandle`) |
| `AccountSection.jsx` | `handle` again, its own field and its own `updateHandle` call |

Two controls, two local states, one server row. That is a genuine bug surface — and it is invisible
in a screenshot, which is why "add tabs" was the instinct.

### 2.3 There is nothing to put in a Notifications tab

The brief proposes tabs "e.g. Account, Preferences, Notifications." A repo-wide search for
`Notification`, `PushManager`, and `requestPermission` finds exactly one hit: the `aria-label` on
the Toast dismiss button.

**The app has no notification feature, no push subscription, and no preference to store.** A
Notifications tab would ship empty. Building notifications is a real epic; it is not part of this
one.

### 2.4 An avatar system already ships

`profiles` already carries `handle` and `avatar_emoji`, and the emoji avatar is already rendered in
three places:

| site | fallback used |
| --- | --- |
| `IdentityStrip.jsx:43` | `🦊` |
| `ProfileCard.jsx:156` | `🙂` |
| `ProfileSection.jsx:26` | `🦊` (placeholder) |

So Phase 2 is not "add avatars." It is "add an *uploaded image* tier above an emoji tier that
already works" — **and unify a fallback that currently disagrees with itself** (🦊 vs 🙂).

Storage itself is genuinely greenfield: `storage.buckets` is **empty (0 buckets, 0 objects)**.

### 2.5 `ProfileCard` shows OTHER players, and cannot see three of the five requested fields

`ProfileCard.jsx` is a **modal opened from a league row**, fetching `/api/v1/league/profile?userId=`
— which is authorization-gated by an RPC (`shares_league`) and returns 403 for anyone outside your
league. It is not the learner's own card.

Against the five fields the brief asks for:

| field | available for another player? |
| --- | --- |
| Avatar | ✅ `avatar_emoji` is returned today |
| Lifetime XP | ✅ `total_xp`, already summed server-side from `stats_daily` |
| Join Year | ⚠️ `profiles.created_at` exists but the endpoint does not `select` it |
| League Wins | ⚠️ derivable from `league_members` (rank = 1) — but see below |
| Badges | ❌ the endpoint hard-codes `achievements: []` |

And the trap: **`state.stats.leagueWins` never syncs.** `settingsToRow` is an explicit allowlist —
`goal, soundOn, achievements, lastGoalMet, frozenDays, bestStreak, lastReconcileDay, learnedWords,
level, levelUpdatedAt, settingsUpdatedAt` — and `stats` is not in it. The client's league-win count
is device-local and always has been. **The server is the only correct source for this field**, which
is fortunate, because `league_members` already records `rank`.

### 2.6 `display_name` is populated nowhere, but it is not dead

0 of 1 profile rows have a `display_name`. It is nonetheless **read** —
`IdentityStrip.jsx:26` uses it first in a `display_name ?? handle ?? email-local-part` chain. So it
is a live read path with no data, not dead code. Worth deciding on (§4.3), not deleting reflexively.

### 2.7 Summary

| Brief premise | Verified |
| --- | --- |
| Update email *and password* | **No password exists.** Email yes, password no (§2.1, D1). |
| Restructure Settings into tabs | Already 4 sections; real defect is duplicated identity editing (§2.2). |
| Notifications tab | **Nothing exists to put in it** (§2.3). |
| Implement avatars | Emoji avatars already ship; Storage is greenfield (§2.4). |
| Upgrade ProfileCard with 5 fields | It renders *other players*; 3 of 5 fields need server work (§2.5). |

---

## 3 · Phase 2 — Storage, because it is the part with real security surface

Specified first: it is the only phase that can leak data if it is wrong.

### 3.1 Bucket

| setting | value | why |
| --- | --- | --- |
| id / name | `avatars` | |
| `public` | **true** | leaderboards render other players' avatars; a signed URL per row would mean N round trips per leaderboard paint |
| `file_size_limit` | **262144** (256 KB) | enforced by the storage API, not by the client — a client-side check is a courtesy, not a control |
| `allowed_mime_types` | `image/webp`, `image/png`, `image/jpeg` | no SVG — see D3 |

**D2: the path is `{user_id}/{random-uuid}.webp`.** The user id must be the **first** path segment,
because that is the only thing `storage.foldername(name)[1]` can compare against `auth.uid()`. The
random second segment matters independently: with a public bucket and a guessable path, knowing
someone's user id would yield their avatar URL directly. The uuid makes the URL unguessable even
though the bucket is public.

**D3: never allow `image/svg+xml` in a public bucket.** An SVG is a script container; served from
the project's own origin it is a stored-XSS vector. This is the single most important line in the
bucket config.

### 3.2 RLS on `storage.objects`

```sql
-- Public read: leaderboards show other players.
create policy "avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

-- Write only inside your own folder.
create policy "insert own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

**D4: the UPDATE policy needs BOTH `using` and `with check`.** `using` decides which rows you may
act on; `with check` decides what the row may look like afterwards. With `using` alone, a user can
`update` their own object and **rename it into someone else's folder**, overwriting that user's
avatar. This is the same asymmetry the `decks` tombstone migration called out, and it is the
mistake worth staging a red test against.

### 3.3 Two lifecycle gaps that no policy covers

1. **Replacing an avatar orphans the old object.** The path carries a random uuid, so a new upload
   never overwrites the old one. The client must delete the previous object after a successful
   upload, and the plan must decide what happens when that delete fails (leave it; a reaper is a
   later concern at this scale).
2. **Account deletion does not remove storage objects.** `profiles.user_id` cascades on
   `auth.users` deletion, which handles every Postgres row — **`storage.objects` is not in that
   graph**. Without an explicit step, a deleted account's avatar stays publicly readable forever.
   The existing `api/v1/account/delete.js` must remove the user's folder, and this belongs in the
   same PR as the bucket, not a follow-up.

### 3.4 Client-side processing before upload

Downscale to 256×256 and re-encode to WebP on a canvas before uploading. Three reasons, in order of
importance:

1. **It strips EXIF.** A phone photo carries GPS coordinates. Uploading one unmodified to a
   **public** bucket publishes the learner's location. This is a privacy defect, not an
   optimisation.
2. It keeps every object well under the 256 KB ceiling.
3. Re-encoding through a canvas discards any non-image payload smuggled in the file.

### 3.5 The column

One migration: `alter table public.profiles add column if not exists avatar_path text;`

Store the **object path**, not a full URL — the public base URL is environment-dependent and should
be composed at render time. `PROFILE_COLUMNS` in `src/lib/profile.js` is an explicit list and must
be updated in the same change, or the column will be invisible to every existing read.

---

## 4 · Phase 1 — Identity & Settings

### 4.1 Restructure: fix the duplication, and be honest about tabs

**D5: remove handle editing from `AccountSection`.** `ProfileSection` owns identity; `AccountSection`
owns the account (export, delete, sign-out). One writer per field, matching the single-writer
discipline the state layer already follows.

**D6 (recommended): keep sections, do not convert to tabs.** Four labelled sections on one scrollable
page are already scannable, are linkable, and need no roving-tabindex implementation. Tabs hide
three quarters of Settings behind a click and add a real a11y contract
(`role="tablist"`/`tab`/`tabpanel`, arrow-key navigation, `aria-selected`) for a screen with four
groups. If tabs are wanted regardless, that contract is mandatory and testable — and it is worth
noting that this codebase has already shipped one keyboard trap where selection-follows-focus made
a control unreachable through 1,570 green tests.

Either way: **section and tab labels are copy, and copy lives in `src/packs/de/`** — never in
`src/lib` or a component. The current labels are already German.

**No Notifications tab** (§2.3).

### 4.2 Email change

`supabase.auth.updateUser({ email })`. Three things the plan must handle rather than discover:

1. Supabase's default is **secure email change**: confirmation goes to *both* the old and the new
   address, and the change commits only when both are confirmed. The UI must say "check both
   inboxes," or it will look broken.
2. The confirmation lands on the **Supabase Site URL**, not wherever the user was. `AuthCallbackLanding`
   already exists and already handles this class of redirect; it needs an `email_change` case.
3. **Gate it on recent authentication.** Changing the email on an account is exactly the action that
   lets a stolen session become permanent account takeover. The re-auth gate must read
   **`amr[].timestamp`, never `iat`** — `iat` is reissued on every token refresh, so a session
   stolen weeks ago looks minutes old. **`isRecentAuth` in `api/_lib/authTime.js` already implements
   this** (PR #192, already guarding account deletion via `accountHandler.js`) and must be reused
   rather than reimplemented. It already fails closed when `amr` is absent.

### 4.3 `display_name`

It is read but never written (§2.6). Two coherent options — **decide, don't leave both**:

- **(a) Drop it from the form**, keep the read chain, and let `handle` be the one name. Simplest,
  and `handle` is already unique and already denormalised onto `league_members`.
- **(b) Keep it** as a display name distinct from the league handle.

**Recommend (a).** Two name fields on one form, one of which nothing has ever populated, is a
question the learner should not have to answer.

---

## 5 · The avatar fallback

Three tiers, resolved in order:

```
uploaded image  →  avatar_emoji  →  generated identicon
```

### 5.1 DiceBear, with one hard constraint

**D7: if DiceBear is used, it must be the npm package generating SVG locally — never the HTTP API.**

`https://api.dicebear.com/…?seed=<user_id>` would send **every user's UUID to a third party on every
render**, including other players' ids while a leaderboard paints. That is user data leaving the
product to a service the learner never agreed to, and it re-introduces exactly the CDN dependency
this project deliberately removed when it self-hosted its fonts.

There is no CSP configured today (`vercel.json` and `index.html` carry no
`Content-Security-Policy`), so nothing would *block* the request — which makes this a decision to
make deliberately rather than a wall to hit.

### 5.2 Measure the bundle before adopting it

`@dicebear/core` plus a collection is not free, and this project has a precedent for pricing exactly
this trade (self-hosted fonts: 178 KB variable vs 870 KB pinned). **The plan must measure the added
bundle bytes and compare against a ~30-line local generator** — hash the user id to a hue and a
small geometric pattern, rendered as inline SVG at zero dependency cost.

Recommend measuring first and defaulting to the local generator unless DiceBear's visual quality
justifies its measured weight. Do not adopt a dependency on the strength of its name.

### 5.3 Unify the existing disagreement

`🦊` and `🙂` are both shipping as the "no avatar" fallback (§2.4). Whatever tier 3 becomes, all
three call sites must resolve through **one** helper, and a test should assert there is no second
hard-coded fallback glyph left in the tree.

Seeding must be **stable**: the same user always gets the same identicon, on every device, forever.
Seed from `user_id`, not from `handle` — a handle can be changed, and an avatar that changes when
you rename yourself is a bug.

---

## 6 · Phase 3 — the rich ProfileCard

### 6.1 Self and other are two different cards

This is the design decision the phase turns on. `ProfileCard` is authorization-gated to league-mates
(§2.5), so it cannot be reused as-is for the learner's own passport.

**D8: extend the endpoint for shared fields; render the learner's own extras from local state.**
`total_xp` and `longest_streak` already come from the server for both cases, which keeps the two
cards consistent where it matters.

### 6.2 Endpoint additions

| field | source | note |
| --- | --- | --- |
| Join Year | `profiles.created_at` | already a column; add to the `select`, return the **year only** — a full join date is unnecessary precision about a stranger |
| League Wins | `count(*) from league_members where user_id = ? and rank = 1` | **not** the client's `stats.leagueWins`, which never syncs (§2.5) |
| Badges | see §6.3 | |

### 6.3 Badges for another player are not free

`ACHIEVEMENTS` in `src/lib/gamification.js` is a list of predicates over a **client** context. Some
are computable from data the server already has (`stats_daily` → XP, streaks); others depend on
settings that are not public.

**D9: expose only the server-computable subset**, and say so in the response shape rather than
returning a partial list that silently looks complete. The alternative — syncing every learner's
achievement list to a publicly readable table — publishes more than a leaderboard needs.

For the learner's **own** card, the full list is already in local state and needs no endpoint.

---

## 7 · What this epic does NOT need

- **No password authentication** (D1).
- **No Notifications tab** (§2.3) — nothing exists to configure.
- **No new table.** One column (`avatar_path`), one bucket, four storage policies.
- **No sync/merge change.** Profile fields live in `profiles`, not in the offline blob, and are
  written through an authenticated endpoint. Nothing here touches LWW or union semantics.
- **No change to `settingsToRow`.** League wins move to the server (§2.5) rather than being added to
  the allowlist.

---

## 8 · Explicitly out of scope

- **Notifications / push** — its own epic (§2.3).
- **Passwords** — its own epic, with a security review (D1).
- **Avatar moderation.** A public bucket of user-uploaded images is a moderation surface. At one
  user it is theoretical; before any real signup growth it is not. Flagged, not solved.
- **Cropping UI.** Centre-crop to a square on upload; an interactive cropper is a feature of its own.
- **Profile privacy controls** (hiding XP from league-mates).
- **Animated avatars / GIF.**

---

## 9 · Testing

- **RLS, with the negative case staged red.** Prove a user *cannot* insert into another user's
  folder, and — the one people miss — that they cannot `update` an object's `name` to move it into
  another user's folder (D4). Write it against a policy with `using` but no `with check` and watch
  it pass, or the test proves nothing. `npm run test:rls` already exists as the home for this, and
  **RLS Policy Tests is one of the four required checks on `main`** — so a policy regression blocks
  the merge rather than reaching production.
- **The MIME allow-list actually rejects SVG** (D3) at the storage API, not just in the client.
- **The size limit is enforced server-side** — upload something over 256 KB with the client check
  bypassed.
- **EXIF is gone after canvas re-encode** (§3.4): assert on a fixture that genuinely *has* EXIF, or
  the fixture cannot express the failure.
- **Account deletion removes storage objects** (§3.3) — the gap that no cascade covers.
- **Fallback resolution is a single helper**: uploaded → emoji → identicon, with a guard test that
  no second hard-coded fallback glyph exists.
- **Identicon stability**: same user id → identical SVG across runs; changing the *handle* does not
  change the avatar (§5.3).
- **The email-change re-auth gate reads `amr`, not `iat`**, and fails closed when absent.
- **One writer per field**: after D5, a test that `AccountSection` renders no handle input.
- **Bundle budget**: assert the measured delta from §5.2 against a recorded number, so a later
  dependency bump cannot quietly double it.

---

## 10 · Phasing

| # | PR | Migration | Visible |
| --- | --- | --- | --- |
| 1a | Settings de-duplication (D5) + `display_name` decision (§4.3) | none | yes |
| 1b | Email change + `amr` re-auth gate + `AuthCallbackLanding` case | none | yes |
| 2a | Bucket, RLS policies, `avatar_path` column, deletion cleanup | **yes** | no |
| 2b | Upload UI, canvas downscale/EXIF strip, unified fallback helper | none | yes |
| 2c | Identicon (after the §5.2 measurement decides which) | none | yes |
| 3a | Endpoint: join year, league wins, server-computable badges | none | no |
| 3b | ProfileCard layout, self vs other | none | **yes** |

2a lands before 2b — the policies must exist and be proven before anything can upload. 1a is
independent and can go first regardless.

---

## 11 · Open questions

1. **Tabs or sections?** D6 recommends sections and explains the cost of tabs. This is a product
   call, and the spec should not pretend otherwise.
2. **DiceBear or a local generator?** §5.2 — decided by a bundle measurement that has not been taken
   yet.
3. **Is a public avatar bucket the right default?** It is what leaderboards want. The alternative is
   signed URLs and a per-row fetch. Public + unguessable path (D2) is the recommendation, but it
   does mean an avatar is world-readable to anyone holding the URL.
4. **Should `display_name` survive at all?** §4.3 recommends dropping it from the form.
5. **What happens to `avatar_emoji` once uploads exist?** Recommend keeping it as tier 2 — it costs
   nothing, it already works, and it is a better default than a generated shape for a learner who
   just wants a fox.
