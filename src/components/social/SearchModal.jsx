import { useState } from 'react';
import Modal from '../ui/Modal';
import ProfileCard from '../stats/ProfileCard';
import UserSearch from './UserSearch';

/**
 * The header's search affordance. Tapping a result opens that person's public
 * passport (ProfileCard) OVER the search, so closing it returns to the same
 * results. While it is open the search's own Escape/scrim dismissal is
 * disarmed, so one Escape closes only the top layer.
 */
export default function SearchModal({ onClose, mobile = false }) {
  const [viewing, setViewing] = useState(null);
  return (
    <>
      <Modal label="Search people" onClose={viewing ? undefined : onClose} maxWidth={440}>
        <UserSearch mobile={mobile} onOpenProfile={(row) => setViewing(row.user_id)} />
      </Modal>
      {viewing && <ProfileCard userId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
