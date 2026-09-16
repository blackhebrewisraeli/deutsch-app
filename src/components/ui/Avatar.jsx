import { avatarFor } from '../../lib/avatar.js';

// The ONE place an avatar is drawn.
//
// Every call site used to inline its own fallback, and they disagreed: 🦊 in
// the Home identity row, 🙂 in ProfileCard. Same absence, two different pictures,
// because "what does no avatar look like" was answered separately each time.
// avatarFor() decides the tier; this decides how to paint it.
//
// Decorative by default. An avatar beside a name that is already on screen adds
// nothing for a screen reader, so alt is empty unless a caller passes a label —
// which it should only do where the avatar stands ALONE as the identification.
export default function Avatar({ profile, userId, size = 40, label = '', style }) {
  const resolved = avatarFor({ profile, userId });

  return (
    <img
      data-avatar={resolved.kind}
      src={resolved.src}
      alt={label}
      width={size}
      height={size}
      // Square by contract: the upload path centre-crops to a square, and the
      // identicon is generated square, so nothing here has to letterbox.
      style={{ borderRadius: '50%', flexShrink: 0, display: 'block', ...style }}
    />
  );
}
