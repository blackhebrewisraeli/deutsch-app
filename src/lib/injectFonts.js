/**
 * Inject Google Fonts <link> tags from pack theme.font.families.
 * Called at theme boot — before React mounts — so discovery is not gated
 * on the first component paint. Does not self-host; that is a later mission.
 *
 * @param {Array<{ name: string, weights?: number[], axes?: string }>} families
 */
export function injectFonts(families) {
  if (typeof document === 'undefined' || !Array.isArray(families) || families.length === 0) {
    return;
  }
  if (document.getElementById('deutsch-fonts')) return;

  const head = document.head;

  const ensurePreconnect = (href, crossOrigin) => {
    const id = `deutsch-preconnect-${href.replace(/[^a-z]/gi, '')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'preconnect';
    link.href = href;
    if (crossOrigin) link.crossOrigin = 'anonymous';
    head.appendChild(link);
  };

  ensurePreconnect('https://fonts.googleapis.com');
  ensurePreconnect('https://fonts.gstatic.com', true);

  const stylesheet = document.createElement('link');
  stylesheet.id = 'deutsch-fonts';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = buildGoogleFontsUrl(families);
  head.appendChild(stylesheet);
}

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
