// Origin allow-list (mandatory in production via the ALLOWED_ORIGINS env var,
// unset elsewhere). A present-but-unlisted Origin is rejected; an absent
// Origin passes — non-browser clients can omit or spoof it, so per-identity
// rate limiting remains the real abuse control.

export function parseAllowedOrigins(raw) {
  return (raw || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function originAllowed(req, allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS)) {
  const origin = req.headers.origin;
  if (allowed.length === 0 || !origin) return true;
  return allowed.includes(origin);
}
