import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CardFace from './CardFace';
import { FONT_SIZE, SPACE } from '../../lib/theme';

const noun = { id: 'das Brot', de: 'das Brot', en: 'bread' };

describe('CardFace', () => {
  it('shows the headword and nothing optional it was not given', () => {
    render(<CardFace card={noun} learned={false} mobile={false} />);
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.queryByText(/^PL:/)).not.toBeInTheDocument();
    expect(screen.queryByText('✓ LEARNED')).not.toBeInTheDocument();
  });

  it('shows the learned badge only once the card is learned', () => {
    const { rerender } = render(<CardFace card={noun} learned={false} mobile={false} />);
    expect(screen.queryByText('✓ LEARNED')).not.toBeInTheDocument();
    rerender(<CardFace card={noun} learned mobile={false} />);
    expect(screen.getByText('✓ LEARNED')).toBeInTheDocument();
  });

  it('renders IPA, plural and the first example when the entry carries them', () => {
    render(
      <CardFace
        card={{
          ...noun,
          ipa: '/bʁoːt/',
          plural: 'die Brote',
          examples: [{ de: 'Ich esse Brot.' }, { de: 'never shown' }],
        }}
        learned={false}
        mobile={false}
      />
    );
    expect(screen.getByText('/bʁoːt/')).toBeInTheDocument();
    expect(screen.getByText('PL: die Brote')).toBeInTheDocument();
    expect(screen.getByText('Ich esse Brot.')).toBeInTheDocument();
    // Only the first example — a card is not a concordance.
    expect(screen.queryByText('never shown')).not.toBeInTheDocument();
  });

  it('lets a long compound break instead of forcing the page wider', () => {
    // German compounds are unbreakable by default, so the word sets the card's
    // min-content width and drags the layout past the viewport.
    render(
      <CardFace
        card={{ ...noun, de: 'Donaudampfschifffahrtsgesellschaft' }}
        learned={false}
        mobile
      />
    );
    const word = screen.getByText('Donaudampfschifffahrtsgesellschaft');
    expect(word).toHaveStyle({ overflowWrap: 'anywhere', maxWidth: '100%' });
  });

  it('steps the display size and padding down on mobile', () => {
    const { container, rerender } = render(<CardFace card={noun} learned={false} mobile />);
    expect(screen.getByText('das Brot')).toHaveStyle({ fontSize: FONT_SIZE['5xl'] });
    expect(container.firstChild).toHaveStyle({ padding: `${SPACE[5]}px` });

    rerender(<CardFace card={noun} learned={false} mobile={false} />);
    expect(screen.getByText('das Brot')).toHaveStyle({ fontSize: FONT_SIZE['6xl'] });
    expect(container.firstChild).toHaveStyle({ padding: `${SPACE[12]}px` });
  });

  it('conceals fields a drill is asking for', () => {
    // The plural drill would otherwise print "PL: Brote" directly under the
    // question asking for it — the same defect as showing "das Jahr" above a
    // der/die/das row.
    const card = { ...noun, plural: 'Brote', ipa: '/bʁoːt/' };
    const { rerender } = render(<CardFace card={card} learned={false} mobile={false} />);
    expect(screen.getByText('PL: Brote')).toBeInTheDocument();

    rerender(<CardFace card={card} learned={false} mobile={false} conceal={['plural']} />);
    expect(screen.queryByText('PL: Brote')).not.toBeInTheDocument();
    // and conceals nothing it was not asked to
    expect(screen.getByText('/bʁoːt/')).toBeInTheDocument();
  });
});
