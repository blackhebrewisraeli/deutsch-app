/**
 * The commit a bundle was built from, stamped into Sentry as the `release`.
 *
 * Without it every error in Sentry is attributable to "production" and nothing
 * finer, so a regression cannot be tied to the deploy that introduced it — which
 * is most of the value of having the errors at all.
 *
 * Resolution order: an explicit override, then Vercel's build-time commit var,
 * then GitHub Actions'. Empty string when none resolve, which `observability.js`
 * turns back into `undefined` so Sentry records no release rather than a literal
 * "unknown" that would group every such build together.
 *
 * Environment only — this deliberately does NOT shell out to git. It used to
 * fall back to `execFileSync('git', ['rev-parse', 'HEAD'])` for `npm run build`
 * on a developer box, which Sonar raises as S4036: the binary is resolved
 * through PATH, so a shadowed entry runs arbitrary code on a machine that is
 * mid-build. That fallback also bought nothing — Sentry is configured for
 * Preview and Production only, so a local build's stamp was never read by
 * anything, and both of those environments set one of the vars above.
 *
 * The alternatives were worse. An absolute path breaks across macOS, Linux and
 * containers; reading .git by hand is worse still in this repo, which uses
 * worktrees, where .git is a file and refs live in the common dir.
 *
 * It lives here rather than inline in vite.config.js so it can be tested without
 * importing the whole config — which would pull in the PWA and Sentry plugins
 * for the sake of one string.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {string} the release, or '' when nothing resolves
 */
export function resolveRelease(env = process.env) {
  return env.VITE_SENTRY_RELEASE || env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || '';
}
