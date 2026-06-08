import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxStats } from '../InboxStats';

describe('InboxStats', () => {
  it('renders total count', () => {
    render(<InboxStats total={10} unread={3} important={2} />);
    expect(screen.getByText('10')).toBeDefined();
  });

  it('renders unread count', () => {
    render(<InboxStats total={10} unread={3} important={2} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('renders important count', () => {
    render(<InboxStats total={10} unread={3} important={2} />);
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders Overview heading', () => {
    render(<InboxStats total={0} unread={0} important={0} />);
    expect(screen.getByText('Overview')).toBeDefined();
  });
});
