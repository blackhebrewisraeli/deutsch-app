import { useState } from 'react';
import { FONTS, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import { Body } from '../ui/Text';
import { clearAppCaches } from '../../lib/clearAppCaches';
import { __resetCache } from '../../packs/lexiconStore';

// Device-level Cache Storage wipe. Lives in Settings, not AccountSection:
// guests hit sticky lexicon-json too, and AccountSection is hidden when auth
// is unconfigured. Progress / theme / localStorage are untouched.

export default function OfflineCacheSection({
  onToast,
  clearCaches = clearAppCaches,
  resetLexicon = __resetCache,
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const handleClear = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await clearCaches();
      if (!result.available) {
        const message = 'Offline cache is not available in this browser.';
        setStatus(message);
        onToast?.(message);
        return;
      }
      if (!result.ok) {
        const message = 'Could not clear the offline cache.';
        setStatus(message);
        onToast?.(message);
        return;
      }
      resetLexicon();
      const message =
        result.deleted.length === 0 ? 'No offline caches to clear.' : 'Offline cache cleared.';
      setStatus(message);
      onToast?.(message);
    } catch {
      const message = 'Could not clear the offline cache.';
      setStatus(message);
      onToast?.(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <Body size="sm" tone="soft" style={{ marginBottom: SPACE[3], overflowWrap: 'break-word' }}>
        Clears this device&apos;s offline copies of the app shell and lexicon. Progress, theme, and
        account data stay. Use this if Vocab still looks stale after a deploy.
      </Body>
      <Button
        variant="secondary"
        onClick={handleClear}
        busy={busy}
        aria-label="Clear offline cache"
      >
        Clear offline cache
      </Button>
      {/* The outcome of an action the learner just took, phrased as a
          sentence — so it is set as prose, not as a 10px mono label. */}
      {status && (
        <Body role="status" size="sm" tone="soft" style={{ marginTop: SPACE[2] }}>
          {status}
        </Body>
      )}
    </div>
  );
}
