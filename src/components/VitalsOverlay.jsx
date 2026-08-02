import { useEffect, useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../lib/theme';
import { startVitals, rate } from '../lib/vitalsProbe';

// Debug-only readout of live Core Web Vitals, mounted solely when the URL
// carries `?vitals=1`. It is loaded through a dynamic import in main.jsx, so
// none of this reaches users who did not ask for it.
//
// The metric that matters for "the app feels jammed" is INP: how long the page
// took to show a response to a tap. It only becomes meaningful after you have
// interacted, so it reads "—" until then, by design.

const TINT = {
  good: COLORS.green,
  'needs-improvement': COLORS.gold,
  poor: COLORS.red,
  unknown: COLORS.mute,
};

const ms = (v) => (v == null ? '—' : `${Math.round(v)}ms`);

function Row({ label, value, tint, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2], lineHeight: 1.5 }}>
      <span style={{ color: COLORS.mute, minWidth: 74 }}>{label}</span>
      <strong style={{ color: tint }}>{value}</strong>
      {hint && <span style={{ color: COLORS.mute, fontSize: FONT_SIZE.tag }}>{hint}</span>}
    </div>
  );
}

export default function VitalsOverlay() {
  const [v, setV] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => startVitals(setV), []);

  if (!v) return null;

  const summary = [
    `INP ${ms(v.inp)} (worst ${ms(v.worstInteraction)}, ${v.interactionCount} interactions)`,
    `LCP ${ms(v.lcp)} · FCP ${ms(v.fcp)} · TTFB ${ms(v.ttfb)}`,
    `CLS ${v.cls.toFixed(3)} · TBT ${ms(v.tbt)} over ${v.longTasks} long tasks (worst ${ms(v.longestTask)})`,
    `device: ${v.device.cores ?? '?'} cores · ${v.device.memoryGB ?? '?'}GB · ${v.device.network ?? '?'} · dpr ${v.device.dpr} · ${v.device.viewport}`,
    `ua: ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      // Not a landmark and not part of the app — keep it out of the a11y tree
      // and out of the way of every tap except its own copy button.
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: SPACE[2],
        bottom: SPACE[2],
        zIndex: 9999,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 16px)',
        background: COLORS.card,
        color: COLORS.ink,
        border: `1px solid ${COLORS.ink}`,
        borderRadius: RADIUS.md,
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        opacity: 0.94,
      }}
    >
      <Row
        label="INP"
        value={ms(v.inp)}
        tint={TINT[rate('inp', v.inp)]}
        hint={
          v.interactionCount
            ? `worst ${ms(v.worstInteraction)} · n=${v.interactionCount}`
            : 'tap something'
        }
      />
      <Row
        label="TBT"
        value={ms(v.tbt)}
        tint={TINT[rate('tbt', v.tbt)]}
        hint={`${v.longTasks} tasks`}
      />
      <Row label="LCP" value={ms(v.lcp)} tint={TINT[rate('lcp', v.lcp)]} />
      <Row label="FCP" value={ms(v.fcp)} tint={TINT[rate('fcp', v.fcp)]} />
      <Row label="CLS" value={v.cls.toFixed(3)} tint={TINT[rate('cls', v.cls)]} />
      <Row
        label="device"
        value={`${v.device.cores ?? '?'}c/${v.device.memoryGB ?? '?'}GB`}
        tint={COLORS.ink}
        hint={v.device.network ?? ''}
      />
      <button
        type="button"
        onClick={copy}
        // The wrapper is aria-hidden, so this must not be reachable by keyboard
        // — a focusable node inside aria-hidden is a genuine a11y defect, and
        // this overlay should never appear in the app's tab order.
        tabIndex={-1}
        style={{
          pointerEvents: 'auto',
          marginTop: SPACE[2],
          width: '100%',
          background: COLORS.ink,
          color: COLORS.paper,
          border: 'none',
          borderRadius: RADIUS.sm,
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          padding: `${SPACE[1]}px ${SPACE[2]}px`,
          cursor: 'pointer',
        }}
      >
        {copied ? 'copied' : 'copy report'}
      </button>
    </div>
  );
}
