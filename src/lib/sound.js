// Synthesized sound effects via Web Audio — no asset files. No-op unless enabled
// and an AudioContext is available (so it's safe in jsdom / SSR / muted state).
let enabled = false;
let ctx = null;

export function setSoundEnabled(on) {
  enabled = !!on;
}

function audioCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function playNotes(notes) {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime;
    for (const n of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  } catch {
    /* ignore audio errors */
  }
}

export const playCorrect = () =>
  playNotes([
    { freq: 660, start: 0, dur: 0.12 },
    { freq: 880, start: 0.08, dur: 0.14 },
  ]);
export const playLevelUp = () =>
  playNotes([
    { freq: 523, start: 0, dur: 0.16 },
    { freq: 659, start: 0.12, dur: 0.16 },
    { freq: 784, start: 0.24, dur: 0.28 },
  ]);
export const playAchievement = () =>
  playNotes([
    { freq: 784, start: 0, dur: 0.16 },
    { freq: 1047, start: 0.12, dur: 0.3 },
  ]);
export const playGoalMet = () =>
  playNotes([
    { freq: 587, start: 0, dur: 0.16 },
    { freq: 880, start: 0.12, dur: 0.26 },
  ]);
