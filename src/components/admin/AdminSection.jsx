import { useState } from 'react';
import { Stack, Row } from '../ui/Layout';
import Button from '../ui/Button';
import { Body } from '../ui/Text';
import FeedbackInbox from './FeedbackInbox';
import UserList from './UserList';

/**
 * Owner tools. Mount only after the server said isAdmin — the APIs still
 * 403 a forged client, but the chrome must not appear for anyone else.
 */
export default function AdminSection({ me }) {
  const [tab, setTab] = useState('feedback');
  if (!me?.isAdmin) return null;

  return (
    <Stack gap={5}>
      {me.isSystemAccount ? (
        <Body style={{ overflowWrap: 'anywhere' }}>
          Signed in as a system account. Classification does not hide this identity from stats or
          leagues, and it does not raise AI quotas.
        </Body>
      ) : null}
      <Row gap={2} wrap>
        <Button
          variant={tab === 'feedback' ? 'primary' : 'secondary'}
          aria-pressed={tab === 'feedback'}
          onClick={() => setTab('feedback')}
        >
          Feedback
        </Button>
        <Button
          variant={tab === 'users' ? 'primary' : 'secondary'}
          aria-pressed={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
        </Button>
      </Row>
      {tab === 'feedback' ? <FeedbackInbox /> : <UserList />}
    </Stack>
  );
}
