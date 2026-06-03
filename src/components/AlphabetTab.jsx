import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from '../lib/theme';
import { speak } from '../lib/speech';
import { ALPHABET } from '../data/content';
import { Hero } from './UI';

export default function AlphabetTab() {
  const [selected, setSelected] = useState(null);

  const handleTap = (letter) => {
    setSelected(letter);
    speak(letter.l + '. ' + letter.w);
  };

  return (
    <div>
      <Hero
        kicker="Section 02"
        title="Das Alphabet"
        sub="Twenty-six letters plus four. Tap any letter to hear it spoken and see an example word."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, border: `2px solid ${COLORS.ink}`, marginTop: 32 }}>
        {ALPHABET.map((letter, i) => {
          const isActive = selected?.l === letter.l;
          const isSpecial = ['Ä', 'Ö', 'Ü', 'ß'].includes(letter.l);
          return (
            <button
              key={letter.l}
              onClick={() => handleTap(letter)}
              style={{
                aspectRatio: '1',
                background: isActive ? COLORS.red : (isSpecial ? COLORS.paperDeep : COLORS.paper),
                color: isActive ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderRight: (i + 1) % 6 === 0 ? 'none' : `2px solid ${COLORS.ink}`,
                borderBottom: i >= ALPHABET.length - (ALPHABET.length % 6 || 6) ? 'none' : `2px solid ${COLORS.ink}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 8, left: 10,
                fontFamily: FONT_MONO,
                fontSize: 10,
                opacity: 0.5,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}>{letter.l}</span>
              <span style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontStyle: 'italic',
                marginTop: 4,
                opacity: 0.8,
              }}>{letter.w}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="slide-up" style={{
          marginTop: 32,
          padding: 32,
          background: COLORS.ink,
          color: COLORS.paper,
          display: 'grid',
          gridTemplateColumns: '200px 1fr auto',
          gap: 32,
          alignItems: 'center',
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 180,
            fontWeight: 900,
            lineHeight: 0.8,
            letterSpacing: '-0.06em',
            color: COLORS.red,
          }}>
            {selected.l}
          </div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.2em', opacity: 0.6, marginBottom: 8 }}>
              EXAMPLE WORD
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {selected.w}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontStyle: 'italic', fontSize: 18, opacity: 0.7 }}>
              &quot;{selected.e}&quot;
            </div>
          </div>
          <button
            onClick={() => speak(selected.w)}
            style={{
              width: 80, height: 80,
              background: COLORS.red,
              border: 'none',
              color: COLORS.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Volume2 size={32} />
          </button>
        </div>
      )}
    </div>
  );
}
