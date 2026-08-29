import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import InteractiveCard from './ui/InteractiveCard';
import StatusNote from './ui/StatusNote';
import { activePack } from '../packs';
import { ListChecks } from 'lucide-react';

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
      <div
        id="missions-heading"
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
          marginBottom: SPACE[3],
        }}
      >
        {chrome.heading}
      </div>

      {missions.length === 0 ? (
        <StatusNote tone="empty" icon={ListChecks}>
          {chrome.emptyTitle} — {chrome.emptyBody}
        </StatusNote>
      ) : (
        // A real list, so a screen reader announces how many tasks are open.
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <Stack gap={2} as="div">
            {missions.map((mission) => {
              const entry = copy[mission.id];
              if (!entry) return null;
              const label = entry.text(mission);
              const destination = chrome.tabNames?.[mission.tab] ?? mission.tab;
              return (
                <li key={mission.id}>
                  <InteractiveCard
                    onClick={() => onGo?.(mission.tab, mission)}
                    style={{ width: '100%', textAlign: 'left' }}
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
                        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                        alignItems: 'center',
                        gap: SPACE[3],
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: FONT_SIZE.md }}>
                        {entry.icon}
                      </span>
                      <span
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: FONT_SIZE.base,
                          color: COLORS.ink,
                        }}
                      >
                        {label}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: FONT_SIZE.tag,
                          color: COLORS.mute,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {destination} →
                      </span>
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
