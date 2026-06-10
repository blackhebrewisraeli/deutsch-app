import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import MessageList from './MessageList';

const messages = [
  { role: 'assistant', de: 'Hallo! Wie geht es dir?', en: 'Hello! How are you?' },
  { role: 'user', de: 'Mir geht es gut.' },
];

describe('MessageList', () => {
  it('renders a bubble for every message', () => {
    render(<MessageList messages={messages} thinking={false} endRef={createRef()} />);
    expect(screen.getByText('Hallo! Wie geht es dir?')).toBeInTheDocument();
    expect(screen.getByText('Mir geht es gut.')).toBeInTheDocument();
  });

  it('shows the typing indicator while Anna is thinking', () => {
    render(<MessageList messages={messages} thinking endRef={createRef()} />);
    expect(screen.getByText('Anna tippt')).toBeInTheDocument();
  });

  it('hides the typing indicator when not thinking', () => {
    render(<MessageList messages={messages} thinking={false} endRef={createRef()} />);
    expect(screen.queryByText('Anna tippt')).not.toBeInTheDocument();
  });

  it('renders an empty conversation without crashing and attaches the scroll anchor', () => {
    const endRef = createRef();
    render(<MessageList messages={[]} thinking={false} endRef={endRef} />);
    expect(endRef.current).toBeInstanceOf(HTMLElement);
  });
});
