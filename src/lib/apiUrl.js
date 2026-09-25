// Every /api call goes through here. On the web VITE_API_BASE_URL is unset and
// paths stay relative (same origin as the page). The native build sets it,
// because a Capacitor webview is served from capacitor://localhost or
// https://localhost, where a relative /api path resolves to nothing.
// Read per call, not at import, so tests can stub the env.
export function apiUrl(path) {
  // Six of the ten callers attach the session's bearer token, so the target
  // must be our API and nothing else. A path starting '/api/' can be neither
  // absolute ('https://host') nor protocol-relative ('//host'), and the only
  // host that ever goes in front of it is our own base.
  if (typeof path !== 'string' || !path.startsWith('/api/')) {
    throw new TypeError(`apiUrl: not an /api path: ${String(path).slice(0, 80)}`);
  }
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return (base.endsWith('/') ? base.slice(0, -1) : base) + path;
}
