// Builds the Google Fonts css2 request for a pack's font.families.
//
// This used to live in src/lib/injectFonts.js and run in the browser on every
// boot. It is build-time only now: `npm run vendor:fonts` calls it, downloads
// what it points at, and the runtime never talks to Google again.

/** @param {Array<{ name: string, weights?: number[], axes?: string }>} families */
export function buildGoogleFontsUrl(families) {
  const parts = families.map((f) => {
    const name = encodeURIComponent(f.name).replace(/%20/g, '+');
    if (f.axes) return `family=${name}:${f.axes}`;
    const weights = (f.weights?.length ? f.weights : [400]).join(';');
    return `family=${name}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** Directory name for a family: 'JetBrains Mono' → 'jetbrains-mono'. */
export function familySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
