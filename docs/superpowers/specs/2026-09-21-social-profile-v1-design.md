# Social Profile v1

- **Date:** 2026-09-21
- **Status:** approved for implementation planning
- **Scope:** a real in-app social profile, backed by follower relationships
- **Branch:** `codex/social-profile-v1`

## 1. Outcome

The existing **Profile** navigation item becomes a dedicated social profile
surface rather than a selector for Stats, Leagues, and Settings. The learner's
own profile and the profile shown for another learner share one presentation
model and one data contract.

Stats and Leagues move to Home under the separately approved dashboard
redesign. Settings remains a distinct `#/settings` destination opened from the
account control; it is not duplicated inside the social profile.

Version 1 includes real follower relationships and Follow/Unfollow actions.
It does not display invented counters or a non-functional social shell.

## 2. Navigation and routing

- Rename the internal navigation id from `stats` to `profile`; the visible
  label remains **Profile**.
- Selecting Profile renders `UserProfile` directly.
- `#/settings` continues to render `SettingsRoute`, reached from
  `AccountChip` and from a quiet **Edit profile** action on the learner's own
  profile.
- Remove `StatsTab` as the Stats/Leagues/Settings multiplexer once its Stats
  and Leagues children have moved to Home.
- Update destinations that currently route league-related work to `stats` so
  they route to the new Home league section instead.

This is an in-app public profile. Profile reads require an authenticated
session in v1; the work does not introduce indexable or anonymous web profile
URLs.

## 3. Public profile read model

Use one authenticated endpoint for self and other profiles:

`GET /api/v1/profile?userId=<uuid>`

The response is deliberately shaped for presentation rather than exposing raw
database rows:

```text
{
  display_name,
  handle,
  avatar_path,
  join_year,
  followers_count,
  following_count,
  is_self,
  is_following,
  progress: {
    total_xp,
    cefr_level,
    longest_streak
  },
  league: null | {
    tier,
    rank,
    cohort_size,
    weekly_xp
  },
  league_wins,
  achievements
}
```

The endpoint may read the existing private activity and settings rows to derive
the approved public summary, but it returns none of those source rows. Email,
answer history, goals, interests, model choices, learned-word lists, sync
metadata, and account state remain private.

The existing league passport endpoint should delegate to the same profile read
model or remain as a compatibility wrapper during migration. It must not become
a second definition of public profile fields.

## 4. Follower data model

Add `public.profile_follows`:

| Column | Contract |
| --- | --- |
| `follower_id` | `uuid`, required, FK to `auth.users(id)` with delete cascade |
| `followed_id` | `uuid`, required, FK to `auth.users(id)` with delete cascade |
| `created_at` | `timestamptz`, required, defaults to `now()` |

The pair `(follower_id, followed_id)` is the primary key, so following is
idempotent. A check constraint forbids self-following.

The primary-key index serves queries and cascades by `follower_id`. A separate
index on `followed_id` serves follower counts and the second foreign-key
cascade. No redundant standalone `follower_id` index is added.

The table is in the exposed `public` schema, so RLS is enabled immediately.
The browser receives no direct grants. Only `service_role` receives the exact
`select`, `insert`, and `delete` privileges used by authenticated server
endpoints. This also handles Supabase's 2026 change under which new public
tables are not necessarily exposed to the Data API by default.

The migration is committed for review only. It must not be applied, pushed, or
repaired against the linked production project by an agent.

## 5. Follow API

`POST /api/v1/profile/follow`

- Requires a valid authenticated user.
- Accepts a target user id.
- Rejects self-following and a missing/nonexistent target.
- Inserts idempotently; a repeated request returns the same following state.

`DELETE /api/v1/profile/follow`

- Requires a valid authenticated user.
- Deletes only the caller's relationship to the supplied target.
- Is idempotent when no relationship exists.

Both responses return the resulting relationship state and updated counts so
the client does not need a second round trip. The service-role key remains
server-only.

## 6. Component architecture

```text
UserProfile
├── ProfileIdentity
│   ├── Avatar
│   ├── display name
│   └── @handle · member since
├── SocialCounts
│   ├── Followers
│   └── Following
├── ProfileLeagueCard
│   ├── tier shield
│   ├── league name
│   └── live rank / cohort size
├── ProfileProgress
│   ├── total XP
│   └── CEFR level
├── ProfileBadges
└── Edit profile | Follow/Following
```

`UserProfile` owns loading, error/retry, guest, and mutation state. Pure
presentation belongs in a shared profile body extracted from `PassportBody`.
`ProfileCard` keeps only its modal responsibilities: scrim, focus entry, focus
trap, Escape handling, and opener restoration. It renders the same shared body
as the Profile tab.

Reuse the existing `Avatar`, `Surface`, `Heading`, `Body`, `Meta`, `Button`, and
`StatusNote` primitives, plus `TIER_NAMES` and the existing achievement
metadata. Do not create parallel button, card, avatar, or badge systems.

## 7. Identity fields

The explicit display-name requirement supersedes the earlier decision to leave
the existing `profiles.display_name` column unused.

- Restore `display_name` to the Settings profile editor.
- Add it to the account profile patch allowlist and own-profile read.
- Trim and validate it server-side; v1 permits 1-40 visible characters or
  `null`.
- Render `display_name`, falling back to `handle`, then the existing anonymous
  label.
- Keep `handle` as the unique social identifier and leaderboard identity.

The optional bio remains out of scope for v1. No unused bio column is added.

## 8. Visual design

The page is a centered learning passport, not a settings form or a generic
analytics grid.

- Avatar: approximately 112px on mobile and 144px on desktop, centered.
- Identity: Fraunces for the display name, Plus Jakarta Sans for body copy, and
  JetBrains Mono for labels and compact metrics, matching the vendored theme.
- Social counts: two equal `minmax(0, 1fr)` tracks separated by one structural
  divider.
- League: the single expressive element, using a `Shield` icon, the existing
  tier names, theme tokens, and live `#rank of cohort` copy.
- Progress: compact XP and CEFR summaries; do not duplicate the dense
  `LevelCard` layout.
- Self profile: secondary **Edit profile** action.
- Other profile: primary **Follow** / **Following** action.

All colors, radii, spacing, shadows, and typography come from `theme.js`.
There are no hardcoded design values where a token exists, no Tailwind layer,
and no new typeface.

At 320px and 375px, the count and progress bands remain two-column grids whose
tracks can shrink. Long display names and handles wrap or ellipsize within the
card rather than widening the viewport. Desktop content uses a restrained
maximum width of roughly 720-800px.

## 9. Interaction and accessibility

- Guests see an explanatory empty state and a sign-in action; they never see
  fabricated profile data.
- Follow is optimistic for immediacy, with rollback and an announced error if
  the request fails.
- Counts update with the relationship state from the mutation response.
- Buttons use native semantics and the shared focus treatment.
- Profile loading and mutation feedback is announced without replacing the
  entire page.
- The modal profile retains its existing focus trap and restores focus to the
  leaderboard row that opened it.
- Reduced-motion behavior continues to come from the shared global styles.

## 10. Testing and delivery

Implementation follows red-green-refactor. Coverage includes:

- self, guest, and other-user rendering;
- display-name fallback and hostile long strings;
- loading, error, retry, and no-current-league states;
- Follow, Unfollow, optimistic update, and rollback;
- self-follow rejection and idempotent API operations;
- correct follower/following counts and cascade-safe schema indexes;
- public response allowlisting and absence of private fields;
- live league rank and CEFR/XP summaries;
- navigation to Profile and Settings;
- 320px and 375px layout contracts.

Before completion, run `npm test`, `npm run lint`, and
`npm run format:check`. The RLS suite is additional when Docker and the local
Supabase stack are available; it is not replaced by production writes.

## 11. Out of scope

- Bio, activity feed, notifications, blocks, private accounts, recommendations,
  and follower/following list screens.
- Anonymous public web profiles.
- Applying the migration to production.
- Merging the implementation branch without owner approval.
