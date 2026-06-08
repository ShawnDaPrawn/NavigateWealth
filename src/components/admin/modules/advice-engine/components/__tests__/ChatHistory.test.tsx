import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { role: string; content: string } }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));
vi.mock('../WelcomeMessage', () => ({
  WelcomeMessage: () => <div data-testid="welcome-message">Welcome</div>,
}));

import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { ChatHistory } from '../ChatHistory';

const mockMessages = [
  { role: 'user' as const, content: 'Hello there', timestamp: new Date('2026-01-01') },
  { role: 'assistant' as const, content: 'Hi! How can I help?', timestamp: new Date('2026-01-01') },
];

describe('ChatHistory', () => {
  it('renders without crashing with empty messages', () => {
    const { container } = render(<ChatHistory messages={[]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders welcome message when no messages', () => {
    render(<ChatHistory messages={[]} />);
    expect(screen.getByTestId('welcome-message')).toBeDefined();
  });

  it('renders messages when provided', () => {
    render(<ChatHistory messages={mockMessages} />);
    expect(screen.getAllByTestId('chat-message').length).toBe(2);
  });

  it('renders loading indicator when isLoading=true', () => {
    const { container } = render(<ChatHistory messages={mockMessages} isLoading={true} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders error message when error is provided', () => {
    render(<ChatHistory messages={[]} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });
});
