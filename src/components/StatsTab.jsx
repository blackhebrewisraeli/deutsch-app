import { useState, useEffect } from 'react';
import { SPACE } from '../lib/theme';
import { loadState } from '../lib/storage';
import {
  todayKey,
  getTodaySnapshot,
  getHeatmapData,
  getPerTabBreakdown,
  getAccuracyByLevel,
  getReviewItems,
} from '../lib/stats';
import { Hero, SectionLabel } from './UI';
import TodaySnapshot from './stats/TodaySnapshot';
import Heatmap, { HeatmapLegend } from './stats/Heatmap';
import PerTabBars from './stats/PerTabBars';
import AccuracyByLevel from './stats/AccuracyByLevel';
import ReviewFeed from './stats/ReviewFeed';
import VocabSrsWidget from './stats/VocabSrsWidget';

// Section 05 — practice dashboard. Reads the forward-only event log from
// storage and composes six widgets (A–F). All aggregation lives in lib/stats
// + lib/srs; the widgets are pure presentation.
export default function StatsTab({ mobile = false, onReview }) {
  // Pull state from storage every render so today's counters reflect events
  // from the other tabs without app-wide state plumbing.
  const [state, setState] = useState(() => loadState() ?? {});

  // Re-read on focus so switching tabs picks up new events.
  useEffect(() => {
    const onFocus = () => setState(loadState() ?? {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const daily = state.daily ?? {};
  const items = state.items ?? {};
  const srs = state.srs ?? {};
  const stats = state.stats ?? { streak: 0, learnedCount: 0 };

  const today = todayKey();
  const nowMs = Date.now();
  const snap = getTodaySnapshot(daily, stats, today);
  const heatmap = getHeatmapData(daily, new Date(), 365);
  const perTab = getPerTabBreakdown(daily);
  const accByLevel = getAccuracyByLevel(daily);
  const review = getReviewItems(items, 10);

  return (
    <div>
      <Hero
        kicker="Section 05"
        title="Statistik"
        sub="A picture of your practice. Today's snapshot, the year so far, and how your effort breaks down across the four sections."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8], marginTop: SPACE[8] }}>
        <section>
          <SectionLabel num="A" text="Today" />
          <TodaySnapshot snap={snap} />
        </section>

        <section>
          <SectionLabel num="B" text="Last 12 months" />
          <Heatmap data={heatmap} mobile={mobile} />
          <HeatmapLegend />
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
            gap: SPACE[8],
          }}
        >
          <section>
            <SectionLabel num="C" text="By section" />
            <PerTabBars breakdown={perTab} />
          </section>

          <section>
            <SectionLabel num="D" text="Accuracy by level" />
            <AccuracyByLevel byLevel={accByLevel} />
          </section>
        </div>

        <section>
          <SectionLabel num="E" text="Review — tap to re-attempt" />
          <ReviewFeed items={review} onReview={onReview ?? (() => {})} />
        </section>

        <section>
          <SectionLabel num="F" text="Vocab review queue" />
          <VocabSrsWidget srs={srs} now={nowMs} />
        </section>
      </div>
    </div>
  );
}
