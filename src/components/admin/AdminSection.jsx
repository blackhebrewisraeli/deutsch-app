import { useState } from 'react';
import { BORDER, COLORS, SPACE } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import { Body } from '../ui/Text';
import { AdminRail } from './AdminRail';
import FeedbackInbox from './FeedbackInbox';
import UserList from './UserList';
import GodMode from './GodMode';

const PANEL_ID = 'admin-panel';

const TABS = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'users', label: 'Users' },
  { key: 'god', label: 'God mode' },
];

const PANELS = {
  feedback: FeedbackInbox,
  users: UserList,
  god: GodMode,
};

/**
 * Owner tools. Mount only after the server said isAdmin — the APIs still
 * 403 a forged client, but the chrome must not appear for anyone else.
 *
 * Only the active panel is mounted. Each one fetches on mount, so rendering all
 * three and hiding two would fire three admin requests to show one list.
 */
export default function AdminSection({ me }) {
  const [tab, setTab] = useState('feedback');
  if (!me?.isAdmin) return null;

  const Panel = PANELS[tab] ?? FeedbackInbox;

  return (
    <Stack gap={5}>
      {me.isSystemAccount ? (
        <Body
          tone="muted"
          size="sm"
          style={{
            // A rule in the margin rather than a bordered callout box. The note
            // is context for the whole panel, not an alert, and giving it a card
            // made it the loudest thing on a screen whose job is the list below.
            borderLeft: BORDER.panel,
            borderLeftColor: COLORS.borderStrong,
            paddingLeft: SPACE[3],
            overflowWrap: 'anywhere',
          }}
        >
          Signed in as a system account. Classification does not hide this identity from stats or
          leagues, and it does not raise AI quotas.
        </Body>
      ) : null}
      <AdminRail
        items={TABS}
        activeKey={tab}
        onPick={setTab}
        ariaLabel="Admin sections"
        panelId={PANEL_ID}
      />
      <div
        role="tabpanel"
        id={`${PANEL_ID}-${tab}`}
        aria-labelledby={`${PANEL_ID}-tab-${tab}`}
        // Focusable so the keyboard lands somewhere meaningful after the rail,
        // and because a tabpanel holding a scrollable list needs to be reachable
        // without tabbing through every control inside it.
        tabIndex={0}
        data-ui="admin-panel"
        style={{ minWidth: 0, paddingTop: SPACE[1] }}
      >
        <Panel />
      </div>
    </Stack>
  );
}
