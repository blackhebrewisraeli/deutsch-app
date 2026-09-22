import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import InteractiveCard from './ui/InteractiveCard';
import StatusNote from './ui/StatusNote';
import { activePack } from '../packs';
import { ListChecks } from 'lucide-react';

// Compact row padding for Home list pills. InteractiveCard's default SPACE[4]
// (16) is a deck-tile inset; on a full-width mission/quest row that reads as
// empty vertical padding. SPACE[2]/SPACE[3] keeps the same control, shorter.
const ROW_PADDING = `${SPACE[2]}px ${SPACE[3]}px`;

// The open-tasks board on Home.
//
// Rows are InteractiveCard, never a Surface with onClick: it guarantees a real
// <button>, which is what fourteen league rows shipped as `<li onClick>` were
// not — unreachable by Tab and invisible to a screen reader, through a green
// 1,600-test suite.
//
// Copy comes from the pack. This component knows mission IDS and nothing about
// German, which is what keeps src/components language-blind.
export default function MissionBoard({ missions = [], onGo }) {
  const copy = activePack.content.missions ?? {};
  const chrome = activePack.content.missionsChrome ?? {};

  return (
    <section aria-labelledby="missions-heading">
      <h2
        id="missions-heading"
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE.lg,
          fontWeight: FONT_WEIGHT.bold,
          lineHeight: 1.2,
          color: COLORS.ink,
          margin: `0 0 ${SPACE[3]}px`,
        }}
      >
        {chrome.heading}
      </h2>

      {missions.length === 0 ? (
        <StatusNote tone="empty" icon={ListChecks}>
          {chrome.emptyTitle} — {chrome.emptyBody}
        </StatusNote>
      ) : (
        // A real list, so a screen reader announces how many tasks are open.
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <Stack gap={1} as="div">
            {missions.map((mission) => {
              const entry = copy[mission.id];
              if (!entry) return null;
              const label = entry.text(mission);
              const destination = chrome.tabNames?.[mission.tab] ?? mission.tab;
              return (
                <li key={mission.id}>
                  <InteractiveCard
                    onClick={() => onGo?.(mission.tab, mission)}
                    style={{ width: '100%', textAlign: 'left', padding: ROW_PADDING }}
                    // The visible row reads "⏰ 12 cards are due · Vokabeln",
                    // but an icon-only glyph carries no name, so the control
                    // gets an explicit one naming where it goes.
                    aria-label={`${label} — go to ${destination}`}
                  >
                    <div
                      style={{
                        display: 'grid',
                        // minmax(0, 1fr), never a bare 1fr: a 1fr track keeps
                        // min-width auto and pushes the page wider than the
                        // viewport instead of letting the text shrink.
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        alignItems: 'start',
                        columnGap: SPACE[2],
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: FONT_SIZE.md, marginTop: 2 }}>
                        {entry.icon}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <span
                          data-testid="mission-copy"
                          style={{
                            display: 'block',
                            minWidth: 0,
                            fontFamily: FONTS.body,
                            fontSize: FONT_SIZE.base,
                            lineHeight: 1.4,
                            color: COLORS.ink,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {label}
                        </span>
                        <span
                          data-testid="mission-destination"
                          aria-hidden="true"
                          style={{
                            display: 'block',
                            marginTop: SPACE[1],
                            fontFamily: FONTS.mono,
                            fontSize: FONT_SIZE.tag,
                            color: COLORS.mute,
                          }}
                        >
                          {destination} →
                        </span>
                      </div>
                    </div>
                  </InteractiveCard>
                </li>
              );
            })}
          </Stack>
        </ul>
      )}
    </section>
  );
}
