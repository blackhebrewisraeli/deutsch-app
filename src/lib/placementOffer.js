// One-shot invite to take (or retake) placement once a learner has earned
// PLACEMENT_OFFER_XP. PURE decision + blob persistence. No DOM. The CEFR write
// itself stays in placement.js; this module only records whether the Home
// banner has been shown or dismissed so it cannot nag every session.
//
// Why XP and not a first-run wall: placement is optional. A learner who skips
// it starts at the default band, and by a few hundred XP they know whether that
// band is too easy — which is exactly when a nudge is useful rather than in the
// way. (This used to fire after 3 completed decks; XP counts every tab, where
// decks counted only Vocab.)
//
// XP arithmetic lives in gamification.js (totalXp) — this file does not
// re-derive it. Storage is additive on deutsch-app-state-v1 (no new key).

import { loadState, saveState } from './storage.js';
import { stampSettings } from './settingsStamp.js';

export const PLACEMENT_OFFER_XP = 500;

/**
 * @param {unknown} offer
 * @returns {{ milestone?: number, shownAt?: number, dismissedAt?: number } | null}
 */
export function normalizePlacementOffer(offer) {
  if (!offer || typeof offer !== 'object' || Array.isArray(offer)) return null;
  const out = {};
  if (Number.isFinite(offer.milestone)) out.milestone = offer.milestone;
  if (Number.isFinite(offer.shownAt)) out.shownAt = offer.shownAt;
  if (Number.isFinite(offer.dismissedAt)) out.dismissedAt = offer.dismissedAt;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Start showing the Home banner? True only the first time lifetime XP reaches
 * the threshold. `shownAt` or `dismissedAt` means the invite has already been
 * used for this profile — Settings still opens placement.
 *
 * @param {{ xp?: number, offer?: object | null }} args
 * @returns {boolean}
 */
export function shouldStartPlacementOffer({ xp = 0, offer = null } = {}) {
  if (!Number.isFinite(xp) || xp < PLACEMENT_OFFER_XP) return false;
  const record = normalizePlacementOffer(offer);
  if (record?.shownAt || record?.dismissedAt) return false;
  return true;
}

/** @returns {{ milestone?: number, shownAt?: number, dismissedAt?: number } | null} */
export function readPlacementOffer() {
  return normalizePlacementOffer(loadState()?.placementOffer);
}

/**
 * Merge a patch onto the blob and stamp settings LWW. Additive; never a
 * replacement of the rest of the state.
 *
 * @param {object} patch
 * @param {{ now?: number }} [opts]
 * @returns {object | null}
 */
export function writePlacementOffer(patch, { now = Date.now() } = {}) {
  const current = loadState() ?? {};
  const next = {
    milestone: PLACEMENT_OFFER_XP,
    ...normalizePlacementOffer(current.placementOffer),
    ...normalizePlacementOffer(patch),
  };
  saveState({ ...current, placementOffer: next });
  stampSettings(now);
  return next;
}

/** First time Home actually showed the banner. Idempotent. */
export function recordPlacementOfferShown({ now = Date.now() } = {}) {
  const current = readPlacementOffer() ?? {};
  if (Number.isFinite(current.shownAt)) return current;
  return writePlacementOffer({ shownAt: now }, { now });
}

/** Not now, or Retake from the banner. Settings remains the standing path. */
export function recordPlacementOfferDismissed({ now = Date.now() } = {}) {
  return writePlacementOffer({ dismissedAt: now }, { now });
}
