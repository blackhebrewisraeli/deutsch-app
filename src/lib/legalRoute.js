/**
 * The two compliance routes.
 *
 * Path-based (`/privacy`, `/terms`) because a legal document gets linked to
 * from outside the app and a bare path is what people paste. The hash forms
 * are accepted as well so a deep link still resolves where the host has no
 * SPA rewrite and `/privacy` would 404 on a cold load — in-app navigation
 * uses pushState and never touches the server either way.
 *
 * Pure and dependency-free so both the router and its tests can read it.
 */
export const LEGAL_ROUTES = {
  '/privacy': 'privacy',
  '/terms': 'terms',
};

/** @returns {'privacy'|'terms'|null} the route for a location, or null. */
export function legalRouteFor({ pathname = '', hash = '' } = {}) {
  // Trailing slashes are equivalent: /privacy and /privacy/ are one route.
  const path = pathname.replace(/\/+$/, '') || '/';
  if (LEGAL_ROUTES[path]) return LEGAL_ROUTES[path];
  const fromHash = hash.replace(/^#/, '').replace(/\/+$/, '');
  if (LEGAL_ROUTES[fromHash]) return LEGAL_ROUTES[fromHash];
  return null;
}

/** The current route, read from `window`. Null outside a browser. */
export function currentLegalRoute() {
  if (typeof window === 'undefined') return null;
  return legalRouteFor(window.location);
}
