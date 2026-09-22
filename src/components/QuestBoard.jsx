import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import InteractiveCard from './ui/InteractiveCard';
import { activePack } from '../packs';

// Compact row padding — same recipe as MissionBoard. InteractiveCard's default
// SPACE[4] is a tile inset; on a full-width quest row it is empty height.
const ROW_PADDING = `${SPACE[2]}px ${SPACE[3]}px`;

// The daily-quest board on Home.
//
// A SIBLING of MissionBoard, not an extension of it. Missions rank by urgency
// under a shared cap, and folding quests into that list would let "practise in
// three sections" push `srs-due` off the board — strictly worse. Two
// derivations, two boards, one visual language.
//
// Rows are InteractiveCard for the same reason MissionBoard's are: it
// guarantees a real <button>, which is what fourteen league rows shipped as
// `<li onClick>` were not.
//
// Copy comes from the pack. This component knows quest IDS and nothing about
// German.
export default function QuestBoard({ quests = [], onGo }) {
  const copy = activePack.content.quests ?? {};
  const chrome = activePack.content.questsChrome ?? {};

  if (quests.length === 0) return null;

  const allDone = quests.every((q) => q.done);

  return (
    <section aria-labelledby="quests-heading">
      <h2
        id="quests-heading"
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

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <Stack gap={1} as="div">
          {quests.map((quest) => {
            const entry = copy[quest.id];
            if (!entry) return null;
            const label = entry.text(quest);
            const destination = chrome.tabNames?.[quest.tab] ?? quest.tab;
            // The visible row shows "3 / 7"; a screen reader gets the sentence,
            // because a bare ratio read aloud is not a progress report.
            const progressText =
              chrome.progressLabel?.(quest) ?? `${quest.progress}/${quest.target}`;

            return (
              <li key={quest.id}>
                <InteractiveCard
                  onClick={() => onGo?.(quest.tab, quest)}
                  style={{ width: '100%', textAlign: 'left', padding: ROW_PADDING }}
                  aria-label={
                    quest.done
                      ? `${label} — ${chrome.doneLabel ?? 'done'}`
                      : `${label} — ${progressText} — go to ${destination}`
                  }
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
                      {quest.done ? '✅' : entry.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span
                        data-testid="quest-copy"
                        style={{
                          display: 'block',
                          minWidth: 0,
                          fontFamily: FONTS.body,
                          fontSize: FONT_SIZE.base,
                          lineHeight: 1.4,
                          color: quest.done ? COLORS.mute : COLORS.ink,
                          textDecoration: quest.done ? 'line-through' : 'none',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {label}
                      </span>
                      <span
                        aria-hidden="true"
                        data-testid="quest-progress"
                        style={{
                          display: 'block',
                          marginTop: SPACE[1],
                          fontFamily: FONTS.mono,
                          fontSize: FONT_SIZE.tag,
                          color: quest.done ? COLORS.green : COLORS.mute,
                        }}
                      >
                        {quest.progress} / {quest.target}
                      </span>
                    </div>
                  </div>

                  {/* A bounded bar, never a per-unit strip: a target scales with
                      the learner's activity, so a dot per card would grow
                      without limit — the same overflow that dragged the deck
                      progress row 54x wider than the viewport. */}
                  <div
                    aria-hidden="true"
                    style={{
                      marginTop: SPACE[1],
                      height: 4,
                      borderRadius: RADIUS.pill,
                      background: COLORS.track,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round((quest.progress / Math.max(1, quest.target)) * 100)}%`,
                        height: '100%',
                        // accentRed is the "the app is asking you for
                        // something" fill — not COLORS.red, which now means
                        // only *wrong*. There is no COLORS.accent.
                        background: quest.done ? COLORS.green : COLORS.accentRed,
                      }}
                    />
                  </div>
                </InteractiveCard>
              </li>
            );
          })}
        </Stack>
      </ul>

      {allDone && (
        <div
          style={{
            marginTop: SPACE[2],
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.tag,
            color: COLORS.mute,
          }}
        >
          {chrome.allDoneTitle} — {chrome.allDoneBody}
        </div>
      )}
    </section>
  );
}
