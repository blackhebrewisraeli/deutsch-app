import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionGuardContext, useSessionGuardValue, useDirtySession } from './sessionGuard';

// A tab that claims a session while mounted, exactly as TranslateTab does.
function Practice({ label }) {
  useDirtySession(label);
  return <div>practising</div>;
}

// Stands in for the header control: reads the registry on demand.
function Reader() {
  const [seen, setSeen] = useState('—');
  return (
    <SessionGuardContext.Consumer>
      {(guard) => (
        <>
          <button type="button" onClick={() => setSeen(guard.activeSession() ?? 'none')}>
            read
          </button>
          <div data-testid="seen">{seen}</div>
        </>
      )}
    </SessionGuardContext.Consumer>
  );
}

function Harness({ mounted = true, label = 'exercise 4 of 10' }) {
  const guard = useSessionGuardValue();
  return (
    <SessionGuardContext.Provider value={guard}>
      <Reader />
      {mounted && <Practice label={label} />}
    </SessionGuardContext.Provider>
  );
}

const read = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'read' }));
  return screen.getByTestId('seen').textContent;
};

describe('sessionGuard', () => {
  it('reports the label a mounted consumer claims', async () => {
    render(<Harness />);
    expect(await read()).toBe('exercise 4 of 10');
  });

  it('reports nothing when the consumer claims nothing', async () => {
    render(<Harness label={null} />);
    expect(await read()).toBe('none');
  });

  // The reason this is a registry rather than a flag handed up to App:
  // TranslateTab unmounts on every tab switch AND on every level change
  // (it is keyed by level), so a pushed-up flag would strand a stale claim.
  it('drops the claim when the consumer unmounts', async () => {
    const { rerender } = render(<Harness mounted />);
    expect(await read()).toBe('exercise 4 of 10');
    rerender(<Harness mounted={false} />);
    expect(await read()).toBe('none');
  });

  it('follows the label as it changes', async () => {
    const { rerender } = render(<Harness label="exercise 2 of 10" />);
    expect(await read()).toBe('exercise 2 of 10');
    rerender(<Harness label="exercise 7 of 10" />);
    expect(await read()).toBe('exercise 7 of 10');
    rerender(<Harness label={null} />);
    expect(await read()).toBe('none');
  });

  // Two claimants must not cancel each other out.
  it('still reports a claim while any consumer holds one', async () => {
    function Two() {
      const guard = useSessionGuardValue();
      return (
        <SessionGuardContext.Provider value={guard}>
          <Reader />
          <Practice label={null} />
          <Practice label="exercise 3 of 10" />
        </SessionGuardContext.Provider>
      );
    }
    render(<Two />);
    expect(await read()).toBe('exercise 3 of 10');
  });

  it('is inert outside a provider, so a component can render standalone', () => {
    expect(() => render(<Practice label="exercise 4 of 10" />)).not.toThrow();
    expect(screen.getByText('practising')).toBeInTheDocument();
  });
});
