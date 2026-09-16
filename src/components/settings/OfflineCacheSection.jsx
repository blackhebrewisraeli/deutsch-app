import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
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
      <p
        style={{
          fontFamily: FONTS.body,
          fontSize: FONT_SIZE.base,
          color: COLORS.inkSoft,
          margin: 0,
          marginBottom: SPACE[3],
          overflowWrap: 'break-word',
        }}
      >
        Clears this device's offline copies of the app shell and lexicon. Progress, theme, and
        account data stay. Use this if Vocab still looks stale after a deploy.
      </p>
      <Button
        variant="secondary"
        onClick={handleClear}
        busy={busy}
        aria-label="Clear offline cache"
      >
        Clear offline cache
      </Button>
      {status && (
        <p
          role="status"
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            color: COLORS.mute,
            margin: 0,
            marginTop: SPACE[2],
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
}
