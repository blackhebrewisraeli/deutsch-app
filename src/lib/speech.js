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

/**
 * Is the Web Speech *recognition* API present? Recognition is Chrome-family
 * only, so this is a real branch, not a formality.
 *
 * Guarded for Node/SSR/jsdom: reading `window` where it does not exist throws a
 * ReferenceError rather than returning undefined, which is why this is a
 * function and not a module-level constant.
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Is speech *synthesis* present? Far more widely supported than recognition,
 * but absent in jsdom and in any server render.
 * @returns {boolean}
 */
export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.speechSynthesis) && typeof window.speechSynthesis.speak === 'function';
}

/**
 * The best available voice for the pack's language, resolving the async case.
 *
 * `getVoices()` returns `[]` on first call in Chrome — the list is populated
 * later and announced via `onvoiceschanged`. The synchronous call in `speak()`
 * therefore misses on a cold first utterance and silently falls back to the
 * platform default, which on macOS is how a novelty voice reads a drill.
 *
 * Selection is delegated to `pickVoice`, deliberately: matching German voices
 * by name (Anna, Petra, …) does not survive a localised OS, where macOS renames
 * the standard voice while novelty voices keep their English names. The pack's
 * name list is step 1 of `pickVoice`'s chain and the novelty denylist is step 2
 * — the step that actually fires on those systems. See NOVELTY_VOICES above.
 *
 * @param {number} [timeoutMs] give up waiting and answer with what we have
 * @returns {Promise<SpeechSynthesisVoice | null>} null when unsupported or none match
 */
export function getGermanVoice(timeoutMs = 2000) {
  if (!isSpeechSynthesisSupported()) return Promise.resolve(null);

  const synth = window.speechSynthesis;
  const base = activePack.meta.locale.split('-')[0];
  const choose = () => pickVoice(synth.getVoices() ?? [], base, activePack.meta.voicePreference);

  const immediate = choose();
  if (immediate) return Promise.resolve(immediate);

  // Voices not loaded yet. Wait for the event, but never hang: a browser that
  // has no voices at all never fires onvoiceschanged, and an un-settled promise
  // here would stall every caller that awaits it.
  return new Promise((resolve) => {
    let done = false;
    const finish = (voice) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', onChange);
      } else {
        synth.onvoiceschanged = null;
      }
      resolve(voice ?? null);
    };
    const onChange = () => finish(choose());
    const timer = setTimeout(() => finish(choose()), timeoutMs);

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onChange);
    } else {
      synth.onvoiceschanged = onChange;
    }
  });
}

export const speak = (text, lang = activePack.meta.locale, rate = 0.9) => {
  // Guard window: ChatTab schedules speak() on a timeout that can fire after
  // jsdom teardown when the suite is slow (unhandled ReferenceError → red hook).
  if (!isSpeechSynthesisSupported()) return;
  // Synthesis is a nicety on every screen that uses it — a card still reads, a
  // chat message still shows. A driver that throws (Linux with no speech-
  // dispatcher, a revoked autoplay permission, a mid-teardown call) must not
  // take the surrounding render or handler down with it.
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voice = pickVoice(
      window.speechSynthesis.getVoices() ?? [],
      lang.split('-')[0],
      activePack.meta.voicePreference
    );
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    // best-effort: the caller has already rendered the text being spoken
  }
};

// Pre-load voices on module import (some browsers load async)
if (isSpeechSynthesisSupported()) {
  try {
    window.speechSynthesis.getVoices();
  } catch {
    // a throwing driver must not break module import
  }
}
