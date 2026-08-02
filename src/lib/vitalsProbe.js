/**
 * On-device Core Web Vitals probe.
 *
 * Vercel Speed Insights collects this in the field, but it has no public read
 * API and its dashboard aggregates over time — too slow a loop when you are
 * standing there with a phone that feels wrong *now*. This reports the same
 * metrics live, on the device, so a subjective "it feels laggy" becomes a
 * number from the hardware that actually feels it.
 *
 * Uses the platform observers directly rather than adding a `web-vitals`
 * dependency — the point of the exercise is to stop shipping bytes we do not
 * need, and this is debug-only code.
 *
 * Nothing here runs unless `?vitals=1` is present; see main.jsx.
 */

/**
 * INP per spec: the longest interaction, discarding the worst one per 50
 * interactions. With few interactions that is simply the worst one, which is
 * the number you want while poking at a page by hand.
 *
 * @param {number[]} durations one entry per interaction (its longest event)
 * @returns {number | null}
 */
export function computeInp(durations) {
  if (!durations.length) return null;
  const sorted = [...durations].sort((a, b) => b - a);
  const index = Math.min(sorted.length - 1, Math.floor(durations.length / 50));
  return sorted[index];
}

/**
 * CLS per spec: the largest *session window*, where a window ends after a 1s
 * gap between shifts or once it has run for 5s. Summing every shift instead
 * (the common shortcut) overstates long-lived pages badly.
 *
 * @param {{ startTime: number, value: number }[]} shifts in time order
 */
export function computeCls(shifts) {
  let max = 0;
  let current = 0;
  let windowStart = 0;
  let previous = 0;

  for (const shift of shifts) {
    const startsNewWindow =
      current > 0 && (shift.startTime - previous > 1000 || shift.startTime - windowStart > 5000);
    if (startsNewWindow) {
      max = Math.max(max, current);
      current = 0;
    }
    if (current === 0) windowStart = shift.startTime;
    previous = shift.startTime;
    current += shift.value;
  }
  return Math.max(max, current);
}

/** Rating bands straight from web.dev, so the colours mean something. */
export const THRESHOLDS = {
  inp: [200, 500],
  lcp: [2500, 4000],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
  cls: [0.1, 0.25],
  tbt: [200, 600],
};

/** @returns {'good' | 'needs-improvement' | 'poor' | 'unknown'} */
export function rate(metric, value) {
  const band = THRESHOLDS[metric];
  if (!band || value == null) return 'unknown';
  if (value <= band[0]) return 'good';
  if (value <= band[1]) return 'needs-improvement';
  return 'poor';
}

/** What device are we actually on? Answers "is this a slow phone?". */
export function deviceProfile() {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const conn = nav.connection ?? {};
  return {
    cores: nav.hardwareConcurrency ?? null,
    memoryGB: nav.deviceMemory ?? null,
    network: conn.effectiveType ?? null,
    downlinkMbps: conn.downlink ?? null,
    dpr: typeof window === 'undefined' ? null : window.devicePixelRatio,
    viewport: typeof window === 'undefined' ? null : `${window.innerWidth}x${window.innerHeight}`,
  };
}

/**
 * Start observing. Calls `onUpdate(snapshot)` whenever a metric changes.
 * @returns {() => void} stop function
 */
export function startVitals(onUpdate) {
  const shifts = [];
  // One entry per interaction: an interaction fires several events (pointerdown,
  // pointerup, click) sharing an interactionId, and INP takes the longest.
  const interactions = new Map();

  const snapshot = {
    inp: null,
    worstInteraction: null,
    interactionCount: 0,
    lcp: null,
    fcp: null,
    ttfb: null,
    cls: 0,
    tbt: 0,
    longTasks: 0,
    longestTask: 0,
    device: deviceProfile(),
  };

  const emit = () => onUpdate({ ...snapshot });
  const observers = [];

  const observe = (type, handler, extra = {}) => {
    try {
      const po = new PerformanceObserver((list) => {
        handler(list.getEntries());
        emit();
      });
      po.observe({ type, buffered: true, ...extra });
      observers.push(po);
    } catch {
      /* unsupported entry type — that metric stays null rather than breaking */
    }
  };

  observe(
    'event',
    (entries) => {
      for (const e of entries) {
        if (!e.interactionId) continue;
        const prev = interactions.get(e.interactionId) ?? 0;
        interactions.set(e.interactionId, Math.max(prev, e.duration));
      }
      const durations = [...interactions.values()];
      snapshot.interactionCount = durations.length;
      snapshot.inp = computeInp(durations);
      snapshot.worstInteraction = durations.length ? Math.max(...durations) : null;
    },
    { durationThreshold: 16 }
  );

  observe('largest-contentful-paint', (entries) => {
    snapshot.lcp = entries[entries.length - 1]?.startTime ?? snapshot.lcp;
  });

  observe('paint', (entries) => {
    const fcp = entries.find((e) => e.name === 'first-contentful-paint');
    if (fcp) snapshot.fcp = fcp.startTime;
  });

  observe('layout-shift', (entries) => {
    for (const e of entries) {
      // Shifts within 500ms of an interaction are the user's doing, not jank.
      if (e.hadRecentInput) continue;
      shifts.push({ startTime: e.startTime, value: e.value });
    }
    snapshot.cls = computeCls(shifts);
  });

  observe('longtask', (entries) => {
    for (const e of entries) {
      snapshot.longTasks += 1;
      snapshot.tbt += Math.max(0, e.duration - 50);
      snapshot.longestTask = Math.max(snapshot.longestTask, e.duration);
    }
  });

  const navEntry =
    typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] : null;
  if (navEntry) snapshot.ttfb = navEntry.responseStart;

  emit();
  return () => observers.forEach((po) => po.disconnect());
}
