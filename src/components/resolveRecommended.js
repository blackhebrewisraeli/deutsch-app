import { activePack } from '../packs';

/**
 * Promote the two most urgent open missions into large quick-action cards,
 * padding with pack-authored fallbacks when fewer than two are open.
 *
 * Copy is resolved here, not in lib/missions.js: the engine returns ids and
 * counts, and a German sentence in src/lib would be exactly the regression
 * the pack extraction was built to prevent.
 *
 * @param {Array<{id: string, tab: string, count?: number}>} missions
 * @param {number} [cap]
 * @returns {{ cards: Array<{id: string, icon: string, text: string, tab: string, mission: object}>, remaining: object[] }}
 */
export function resolveRecommended(missions = [], cap = 2) {
  const copy = activePack.content.missions ?? {};
  const chrome = activePack.content.homeChrome ?? {};
  const fallbacks = Array.isArray(chrome.recommendedFallbacks) ? chrome.recommendedFallbacks : [];

  const fromMissions = missions.filter((m) => copy[m?.id]).slice(0, cap);
  const promoted = new Set(fromMissions.map((m) => m.id));
  const cards = fromMissions.map((m) => ({
    id: m.id,
    icon: copy[m.id].icon,
    text: copy[m.id].text(m),
    tab: m.tab,
    mission: m,
  }));

  for (const fallback of fallbacks) {
    if (cards.length >= cap) break;
    if (!fallback?.id || promoted.has(fallback.id)) continue;
    cards.push({
      id: fallback.id,
      icon: fallback.icon,
      text: fallback.text,
      tab: fallback.tab,
      mission: { id: fallback.id, tab: fallback.tab },
    });
  }

  return {
    cards,
    remaining: missions.filter((m) => !promoted.has(m.id)),
  };
}
