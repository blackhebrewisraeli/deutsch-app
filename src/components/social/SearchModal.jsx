import Modal from '../ui/Modal';
import UserSearch from './UserSearch';

/**
 * The header's search affordance. UserSearch itself is unchanged — it was
 * already a self-contained `<section>` when it lived inline in the Profile
 * tab (see StatsTab.jsx), so moving it here is only a change of container.
 */
export default function SearchModal({ onClose, mobile = false }) {
  return (
    <Modal label="Search people" onClose={onClose} maxWidth={440}>
      <UserSearch mobile={mobile} />
    </Modal>
  );
}
