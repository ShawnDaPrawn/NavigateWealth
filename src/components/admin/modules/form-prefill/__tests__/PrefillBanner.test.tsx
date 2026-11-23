import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { PrefillBanner } from '../PrefillBanner';

describe('PrefillBanner', () => {
  it('counts the matches waiting for review and names them on the button', () => {
    const onReview = vi.fn();
    render(<PrefillBanner matchCount={11} resolverVersion="1.0.0" onReview={onReview} />);
    expect(screen.getByText('11 values found in the client record.')).toBeTruthy();
    // The resolver version is kept for support, not shown to the adviser.
    expect(screen.queryByText(/v1\.0\.0/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review 11 matches' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('says how many fields were prefilled once applied', () => {
    render(<PrefillBanner matchCount={3} appliedCount={1} onReview={vi.fn()} />);
    expect(screen.getByText('Prefilled 1 field from the client record.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review matches' })).toBeTruthy();
  });

  it('shows a working state while matching', () => {
    render(<PrefillBanner loading onReview={vi.fn()} />);
    expect(screen.getByText('Matching client data…')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Review matches' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
