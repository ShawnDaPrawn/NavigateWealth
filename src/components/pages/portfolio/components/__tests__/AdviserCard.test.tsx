import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdviserCard } from '../AdviserCard';

const mockAdviser = {
  name: 'John Doe',
  email: 'john@navigatewealth.co.za',
  phone: '+27 82 000 0000',
  fspReference: 'FSP12345',
};

describe('AdviserCard', () => {
  it('renders adviser name', () => {
    render(<AdviserCard adviser={mockAdviser} onBookMeeting={() => {}} />);
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('renders adviser email', () => {
    render(<AdviserCard adviser={mockAdviser} onBookMeeting={() => {}} />);
    expect(screen.getByText('john@navigatewealth.co.za')).toBeDefined();
  });

  it('renders adviser phone', () => {
    render(<AdviserCard adviser={mockAdviser} onBookMeeting={() => {}} />);
    expect(screen.getByText('+27 82 000 0000')).toBeDefined();
  });

  it('calls onBookMeeting when book meeting button is clicked', () => {
    const onBookMeeting = vi.fn();
    render(<AdviserCard adviser={mockAdviser} onBookMeeting={onBookMeeting} />);
    fireEvent.click(screen.getByText(/Book a Meeting/i));
    expect(onBookMeeting).toHaveBeenCalledOnce();
  });

  it('renders default adviser without crashing', () => {
    const defaultAdviser = {
      ...mockAdviser,
      name: 'Your Navigate Wealth Adviser',
    };
    const { container } = render(<AdviserCard adviser={defaultAdviser} onBookMeeting={() => {}} />);
    expect(container.firstChild).toBeDefined();
  });
});
