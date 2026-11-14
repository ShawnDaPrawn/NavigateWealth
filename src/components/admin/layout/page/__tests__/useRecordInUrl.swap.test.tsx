import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { useRecordInUrl } from '../useRecordInUrl';

function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

/** Two record pages on one screen, like Applications' review and on-behalf pages. */
function TwoPages() {
  const [review, setReview] = useState<string | null>('app-1');
  const [behalf, setBehalf] = useState<string | null>(null);
  useRecordInUrl('application', review, {
    ready: true,
    openFromUrl: (id) => {
      setReview(id);
      return 'opened';
    },
    closeFromUrl: () => setReview(null),
  });
  useRecordInUrl('behalf', behalf, {
    ready: true,
    openFromUrl: (id) => {
      setBehalf(id);
      return 'opened';
    },
    closeFromUrl: () => setBehalf(null),
  });
  return (
    <>
      <button
        onClick={() => {
          setReview(null);
          setBehalf('app-1');
        }}
      >
        Complete on behalf
      </button>
      <span data-testid="open">{`${review ?? '-'}|${behalf ?? '-'}`}</span>
      <Search />
    </>
  );
}

describe('useRecordInUrl', () => {
  it('swaps one record page for another in a single address change', async () => {
    render(
      <MemoryRouter initialEntries={['/admin?application=app-1']}>
        <TwoPages />
      </MemoryRouter>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Complete on behalf' }).click();
    });
    expect(screen.getByTestId('search').textContent).toBe('?behalf=app-1');
    // The review must not reopen from a stale `application` key.
    expect(screen.getByTestId('open').textContent).toBe('-|app-1');
  });
});
