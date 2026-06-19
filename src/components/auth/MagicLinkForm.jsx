import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, BORDER } from '../../lib/theme';
import { signInWithMagicLink, verifyCode } from '../../lib/auth.js';
import Button from '../ui/Button';

// Two-state passwordless form: email entry → inbox/code entry. The email
// carries both a magic link (opens whatever browser) and a 6-digit code
// (typed here — the installed-PWA path). onSuccess fires after verifyOtp.
export default function MagicLinkForm({ heading, onSuccess }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // BORDER.standard = "2px solid #16110b" — no .width property exists in theme.
  const input = {
    width: '100%',
    padding: '12px 14px',
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.md,
    border: BORDER.standard,
    borderRadius: RADIUS.md,
    marginBottom: 12,
    boxSizing: 'border-box',
  };

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const { error: e } = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (e) setError(e.message);
    else setSent(true);
  };

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const { error: e } = await verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (e) setError(e.message);
    else onSuccess();
  };

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', fontFamily: FONTS.body }}>
      <h2 style={{ fontFamily: FONTS.display }}>{heading}</h2>
      {!sent ? (
        <>
          <label htmlFor="ml-email" style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag }}>
            Email
          </label>
          <input
            id="ml-email"
            type="email"
            style={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={send} disabled={busy || !email.includes('@')}>
            Send me a sign-in link
          </Button>
        </>
      ) : (
        <>
          <p>Check your inbox — tap the link, or enter the 6-digit code here.</p>
          <label htmlFor="ml-code" style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag }}>
            Code
          </label>
          <input
            id="ml-code"
            inputMode="numeric"
            style={input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button onClick={verify} disabled={busy || code.length < 6}>
            Verify code
          </Button>
        </>
      )}
      {error && (
        <p role="alert" style={{ color: COLORS.red, fontSize: FONT_SIZE.tag }}>
          {error}
        </p>
      )}
    </div>
  );
}
