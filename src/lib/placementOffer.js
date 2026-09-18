// One-shot invite to retake placement after N curated decks are completed.
// PURE decision + blob persistence. No DOM. The CEFR write itself stays in
// placement.js; this module only records whether the Home banner has been
// shown or dismissed so it cannot nag every session.
//
// Completed-deck arithmetic lives in deckProgress.js — this file does not
// re-derive it. Storage is additive on deutsch-app-state-v1 (no new key).

import { loadState, saveState } from './storage.js';
import { stampSettings } from './settingsStamp.js';

export const PLACEMENT_OFFER_THRESHOLD = 3;

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
 * Start showing the Home banner? True only the first time the count crosses
 * the threshold. `shownAt` or `dismissedAt` means the invite has already
 * been used for this profile — Settings still opens placement.
 *
 * @param {{ completedCount?: number, offer?: object | null }} args
 * @returns {boolean}
 */
export function shouldStartPlacementOffer({ completedCount = 0, offer = null } = {}) {
  if (!Number.isFinite(completedCount) || completedCount < PLACEMENT_OFFER_THRESHOLD) {
    return false;
  }
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
    milestone: PLACEMENT_OFFER_THRESHOLD,
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
