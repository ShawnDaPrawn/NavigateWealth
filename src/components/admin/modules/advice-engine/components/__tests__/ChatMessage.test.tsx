import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock functions declared BEFORE vi.mock calls (hoisting requirement)
const mockFormatTimestamp = vi.fn(() => '10:00 AM');

vi.mock('../../../../shared/MessageRenderer', () => ({
  MessageRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('../utils', () => ({
  formatTimestamp: (...args: unknown[]) => mockFormatTimestamp(...args),
}));

import { ChatMessage } from '../ChatMessage';

const baseTimestamp = new Date('2024-01-01T10:00:00');

describe('ChatMessage', () => {
  it('renders a user message', () => {
    render(
      <ChatMessage message={{ role: 'user', content: 'Hello there', timestamp: baseTimestamp }} />,
    );
    expect(screen.getByText('Hello there')).toBeDefined();
  });

  it('renders an assistant message', () => {
    render(
      <ChatMessage
        message={{ role: 'assistant', content: 'How can I help?', timestamp: baseTimestamp }}
      />,
    );
    expect(screen.getByText('How can I help?')).toBeDefined();
  });

  it('displays formatted timestamp', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Hi', timestamp: baseTimestamp }} />);
    expect(screen.getByText('10:00 AM')).toBeDefined();
  });

  it('shows copy button for assistant messages when onCopy is provided', () => {
    const onCopy = vi.fn();
    render(
      <ChatMessage
        message={{ role: 'assistant', content: 'Response text', timestamp: baseTimestamp }}
        onCopy={onCopy}
      />,
    );
    const copyBtn = screen.getByTitle('Copy message');
    expect(copyBtn).toBeDefined();
  });

  it('calls onCopy when copy button is clicked', () => {
    const onCopy = vi.fn();
    render(
      <ChatMessage
        message={{ role: 'assistant', content: 'Copy this', timestamp: baseTimestamp }}
        onCopy={onCopy}
      />,
    );
    const copyBtn = screen.getByTitle('Copy message');
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledWith('Copy this');
  });

  it('does not show copy button for user messages', () => {
    const onCopy = vi.fn();
    render(
      <ChatMessage
        message={{ role: 'user', content: 'User message', timestamp: baseTimestamp }}
        onCopy={onCopy}
      />,
    );
    expect(screen.queryByTitle('Copy message')).toBeNull();
  });
});
