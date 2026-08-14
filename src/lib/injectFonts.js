/**
 * Link the pack's self-hosted font stylesheets.
 *
 * Called at theme boot — before React mounts — so discovery is not gated on the
 * first component paint. The files live under public/fonts/, vendored by
 * `npm run vendor:fonts`, and are precached by the service worker (vite.config
 * already globs woff2). Nothing here touches a CDN: the app used to fetch these
 * from fonts.googleapis.com at runtime, which meant an "offline-capable" PWA
 * whose typography depended on the browser's HTTP cache — a cache the service
 * worker does not control and cannot refill.
 *
 * There is deliberately no <link rel="preload"> for the woff2 files. Preloading
 * needs each file's exact name, which is generated output; reading it at runtime
 * would cost the very round trip the preload is meant to save, and hardcoding it
 * would silently 404 the day a font is revendored. `font-display: swap` paints
 * text immediately in the fallback face, and after the first visit the precache
 * serves the fonts locally anyway.
 *
 * @param {Array<{ name: string }>} families
 */
export function injectFonts(families) {
  if (typeof document === 'undefined' || !Array.isArray(families) || families.length === 0) {
    return;
  }

  for (const family of families) {
    if (!family?.name) continue;
    const slug = familySlug(family.name);
    const id = `deutsch-font-${slug}`;
    if (document.getElementById(id)) continue;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `/fonts/${slug}/face.css`;
    document.head.appendChild(link);
  }
}

/**
 * Directory name for a family: 'JetBrains Mono' → 'jetbrains-mono'.
 * Must match scripts/vendor-fonts/googleFontsUrl.js — the script writes these
 * directories and this reads them. src/lib/fontCoverage.test.js fails if the
 * two ever disagree.
 *
 * @param {string} name
 */
export function familySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
