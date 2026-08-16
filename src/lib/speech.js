// Web Speech API: text-to-speech in the active pack's locale.
import { activePack } from '../packs';

// macOS ships a set of comedy voices in every language. They are unusable for
// a listening drill and wrong for a tutor, and `.find` hits them first because
// they sort early. Matching by name is crude but it is the only handle the Web
// Speech API gives — there is no quality or category flag.
//
// A DENYLIST rather than an allowlist, learned the hard way: the standard German
// voice is named "Anna" on an English system but "אנה" on a Hebrew one, because
// macOS localises it. The novelty voices keep their English proper names. So
// naming the ones to avoid works across OS locales where naming the one to want
// does not.
const NOVELTY_VOICES = [
  'Albert',
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Deranged',
  'Eddy',
  'Flo',
  'Good News',
  'Grandma',
  'Grandpa',
  'Hysterical',
  'Jester',
  'Junior',
  'Kathy',
  'Organ',
  'Ralph',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox',
];

const isNovelty = (name = '') => NOVELTY_VOICES.some((n) => name.startsWith(n));

/**
 * The voice to use for a language, best first:
 *   1. a name the pack asked for — works where voice names are not localised,
 *   2. any voice that is not a known novelty one,
 *   3. a voice the platform flags as default,
 *   4. the first match — the behaviour before this existed.
 *
 * Every step is a hint that degrades. Step 2 is what actually fires on a
 * non-English system; step 1 is kept because it is exact where it applies.
 */
function pickVoice(voices, base, preference = []) {
  const forLang = voices.filter((v) => v.lang?.startsWith(base));
  for (const name of preference) {
    const hit = forLang.find((v) => v.name === name);
    if (hit) return hit;
  }
  return forLang.find((v) => !isNovelty(v.name)) ?? forLang.find((v) => v.default) ?? forLang[0];
}

export const speak = (text, lang = activePack.meta.locale, rate = 0.9) => {
  // Guard window: ChatTab schedules speak() on a timeout that can fire after
  // jsdom teardown when the suite is slow (unhandled ReferenceError → red hook).
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(
    window.speechSynthesis.getVoices(),
    lang.split('-')[0],
    activePack.meta.voicePreference
  );
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
};

// Pre-load voices on module import (some browsers load async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
