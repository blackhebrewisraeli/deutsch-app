import { useState } from 'react';
import { BORDER, COLORS, FONT_SIZE, FONTS, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import { Row, Stack } from '../ui/Layout';
import { Body, Meta } from '../ui/Text';

const THUMB = {
  minWidth: SPACE[12],
  minHeight: SPACE[12],
  boxSizing: 'border-box',
};

/**
 * Stub conversational prompt for `{ type: 'chat', payload }`.
 * Payload guidance: `{ initialMessage, persona }`.
 * Spec §5.3 lists `{ scenarioId, taskId }` for pack-backed chat — this stub
 * is presentation-only and renders a local thread from `initialMessage`.
 * Local draft state only — no fetch, no tutor reply, no progress write.
 */
export default function ChatExercise({ payload }) {
  const [draft, setDraft] = useState('');
  const [replies, setReplies] = useState([]);
  const { initialMessage, persona } = payload && typeof payload === 'object' ? payload : {};
  const opening = typeof initialMessage === 'string' ? initialMessage : '';
  const name = typeof persona === 'string' ? persona : '';

  function send() {
    const text = draft.trim();
    if (!text) return;
    setReplies((prev) => [...prev, text]);
    setDraft('');
  }

  return (
    <Stack gap={5} style={{ width: '100%', overflowX: 'hidden' }}>
      <Stack
        as="ul"
        gap={3}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          width: '100%',
        }}
      >
        {opening ? (
          <Bubble key="opening" speaker={name || 'Tutor'}>
            {opening}
          </Bubble>
        ) : null}
        {replies.map((text, index) => (
          <Bubble key={`reply-${index}`} speaker="You" align="end">
            {text}
          </Bubble>
        ))}
      </Stack>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          paddingBottom: `calc(${SPACE[3]}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <Row gap={3} wrap={false} align="center" style={{ width: '100%' }}>
          <input
            aria-label="Message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a reply"
            style={{
              ...THUMB,
              flex: 1,
              minWidth: 0,
              background: COLORS.surface,
              border: BORDER.panel,
              borderRadius: RADIUS.md,
              boxShadow: SHADOW.inset,
              padding: `0 ${SPACE[4]}px`,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.lg,
              color: COLORS.ink,
            }}
          />
          <Button type="submit" variant="go" disabled={!draft.trim()} style={THUMB}>
            Send
          </Button>
        </Row>
      </form>
    </Stack>
  );
}

function Bubble({ speaker, align = 'start', children }) {
  const isUser = align === 'end';
  return (
    <li
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        minWidth: 0,
      }}
    >
      <Stack gap={1} align={isUser ? 'end' : 'start'} style={{ maxWidth: '85%', minWidth: 0 }}>
        {speaker ? <Meta>{speaker}</Meta> : null}
        <div
          style={{
            background: isUser ? COLORS.ink : COLORS.gold,
            color: isUser ? COLORS.paper : COLORS.accentOn,
            borderRadius: RADIUS.xl,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <Body style={{ color: 'inherit', overflowWrap: 'anywhere' }}>{children}</Body>
        </div>
      </Stack>
    </li>
  );
}
