import { useState } from 'react';
import { AlertTriangle, Check, Mail } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Button from '../ui/Button';
import StatusNote from '../ui/StatusNote';
import { getAccessToken, requestEmailChange, verifyEmailChange } from '../../lib/auth.js';
import { isRecentAuth, REAUTH_MAX_AGE_SEC } from '../../lib/authClaims.js';

// Changing the address the account is reachable at.
//
// TWO CONFIRMATIONS, NOT ONE. Under Supabase's "Secure email change" (the
// default) a code goes to the current address AND the new one, and the account
// moves only when both are confirmed. The UI has to say so, or a learner who
// enters the code from their new inbox and sees nothing happen will read a
// working flow as broken.
//
// It also has to cope with the setting being OFF, where one confirmation is
// enough. Rather than encode which mode the project is in — a value this
// component cannot see and which an admin can change without a deploy — every
// verification asks the same question of the RESULT: does the session's email
// now equal the address we asked for? That is true after the last required
// confirmation in either configuration.
//
// THE RE-AUTH GATE, AND WHAT IT IS ACTUALLY FOR. Dual confirmation defeats a
// remote attacker with a stolen token, because they cannot read the original
// mailbox. It does nothing about the case where someone has the DEVICE — there
// the mailbox is usually open in the next tab. A recency check is what covers
// that: it demands a fresh sign-in, which is knowledge rather than possession.
// The two controls are complementary, which is why this has both.
//
// It is a UX gate, not enforcement — the real call happens in Supabase and a
// determined holder of the session could make it from a console. It is here to
// stop the opportunistic case, and it is labelled as such rather than being
// mistaken for a security boundary later.

const CODE_LENGTH = 6;

/** The two inboxes a confirmation can arrive in, in the order they are asked for. */
const CONFIRMATIONS = [
  { key: 'current', label: 'Code from your current address' },
  { key: 'next', label: 'Code from your new address' },
];

const fieldStyle = {
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.base,
  padding: `${SPACE[1]}px ${SPACE[2]}px`,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.mute}`,
  background: 'transparent',
  color: COLORS.ink,
  width: '100%',
};

const labelStyle = {
  display: 'block',
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  color: COLORS.mute,
  marginBottom: SPACE[1],
};

export default function EmailSection({
  user,
  onToast,
  onReauth,
  // Injected so tests drive the flow without a Supabase client, matching how
  // ProfileSection takes its `save`.
  request = requestEmailChange,
  verify = verifyEmailChange,
  readToken = getAccessToken,
}) {
  const [stage, setStage] = useState('idle'); // idle | editing | confirming
  const [next, setNext] = useState('');
  const [pending, setPending] = useState(null); // the address awaiting confirmation
  const [codes, setCodes] = useState({ current: '', next: '' });
  const [done, setDone] = useState({ current: false, next: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  if (!user) return null;

  const start = async () => {
    setError(null);
    // Asked at the moment of intent, not on mount: a session that was fresh
    // when Settings opened can age out while it sits there.
    const token = await readToken();
    if (!isRecentAuth(token, REAUTH_MAX_AGE_SEC)) {
      setNeedsReauth(true);
      return;
    }
    setNeedsReauth(false);
    setNext('');
    setStage('editing');
  };

  const send = async () => {
    const address = next.trim();
    if (!address || address === user.email) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = (await request(address)) ?? {};
      if (err) throw new Error(err.message ?? 'Could not start the change.');
      setPending(address);
      setCodes({ current: '', next: '' });
      setDone({ current: false, next: false });
      setStage('confirming');
    } catch (e) {
      setError(e?.message ?? 'Could not start the change.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (which) => {
    const code = codes[which].trim();
    if (code.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      // The address the code was mailed to is the one that verifies it.
      const address = which === 'current' ? user.email : pending;
      const { data, error: err } = (await verify(address, code)) ?? {};
      if (err) throw new Error(err.message ?? 'That code did not work.');

      // The result decides completion, not a count of confirmations — see the
      // header: this is what makes the component correct whether or not secure
      // email change is switched on.
      if (data?.user?.email === pending) {
        onToast?.('Email updated');
        setStage('idle');
        setPending(null);
        return;
      }
      setDone((prev) => ({ ...prev, [which]: true }));
    } catch (e) {
      setError(e?.message ?? 'That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setStage('idle');
    setPending(null);
    setError(null);
  };

  return (
    <Stack gap={3}>
      <div>
        <span style={labelStyle}>Email</span>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.md }}>{user.email}</div>
      </div>

      {needsReauth && (
        <StatusNote tone="error" icon={AlertTriangle}>
          For your security, sign in again before changing your email.
        </StatusNote>
      )}
      {needsReauth && (
        <div>
          <Button variant="secondary" onClick={onReauth}>
            Sign in again
          </Button>
        </div>
      )}

      {stage === 'idle' && !needsReauth && (
        <div>
          <Button variant="secondary" onClick={start}>
            Change email
          </Button>
        </div>
      )}

      {stage === 'editing' && (
        <>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>New email</span>
            <input
              type="email"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="you@example.com"
              style={fieldStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: SPACE[2] }}>
            <Button onClick={send} disabled={!next.trim() || next.trim() === user.email || busy}>
              {busy ? 'Sending…' : 'Send codes'}
            </Button>
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {stage === 'confirming' && (
        <>
          <StatusNote icon={Mail}>
            {`We sent a code to ${user.email} and to ${pending}. Enter both to finish — the change
              needs confirming from your current address as well as the new one.`}
          </StatusNote>

          {CONFIRMATIONS.map((c) => (
            <div key={c.key}>
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{c.label}</span>
                <input
                  inputMode="numeric"
                  value={codes[c.key]}
                  onChange={(e) => setCodes((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  disabled={done[c.key]}
                  style={fieldStyle}
                />
              </label>
              <div style={{ marginTop: SPACE[1] }}>
                {done[c.key] ? (
                  <StatusNote icon={Check}>Confirmed</StatusNote>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => confirm(c.key)}
                    disabled={codes[c.key].trim().length !== CODE_LENGTH || busy}
                  >
                    Confirm
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div>
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {error && (
        <StatusNote tone="error" icon={AlertTriangle}>
          {error}
        </StatusNote>
      )}
    </Stack>
  );
}
