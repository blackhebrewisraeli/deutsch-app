// Every /api call goes through here. On the web VITE_API_BASE_URL is unset and
// paths stay relative (same origin as the page). The native build sets it,
// because a Capacitor webview is served from capacitor://localhost or
// https://localhost, where a relative /api path resolves to nothing.
// Read per call, not at import, so tests can stub the env.
export function apiUrl(path) {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '') + path;
}
