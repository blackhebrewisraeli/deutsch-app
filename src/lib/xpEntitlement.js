// Whether the current visitor earns the per-level XP multiplier — an account
// benefit, so guests earn flat XP.
//
// Module-level state rather than a parameter because recordEvent is called from
// eight sites across five components, none of which knows about auth; and
// rather than a field on `deutsch-app-state-v1`, because that blob syncs and an
// entitlement derived from the local session must not travel between devices.
// Same shape as setSoundEnabled in lib/sound.js.
//
// Defaults to false so a guest — and any test that forgets to opt in — gets
// flat XP rather than a silent bonus.
let enabled = false;

/** @param {boolean} on */
export function setLevelBoostEnabled(on) {
  enabled = !!on;
}

/** @returns {boolean} */
export function isLevelBoostEnabled() {
  return enabled;
}
