import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

vi.mock('../../hooks', () => ({
  useFeedback: () => ({
    data: [
      {
        id: 'f1',
        rating: 'positive',
        messageContent: 'Our offices are open Monday to Friday',
        sessionId: 'session-1',
        createdAt: '2026-11-06T08:00:00.000Z',
      },
      {
        id: 'f2',
        rating: 'negative',
        messageContent: 'Our advice fee is agreed with you upfront',
        comment: 'I wanted the actual percentage.',
        sessionId: 'session-2',
        createdAt: '2026-11-05T08:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
  useHandoffs: () => ({
    data: [
      {
        id: 'h1',
        name: 'Karabo Sithole',
        email: 'karabo@example.com',
        topic: 'Retirement planning',
        status: 'new',
        createdAt: '2026-11-06T08:00:00.000Z',
      },
      {
        id: 'h2',
        name: 'Grant Fourie',
        email: 'grant@example.com',
        topic: 'Medical aid',
        status: 'contacted',
        createdAt: '2026-11-05T08:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
  useUpdateHandoffStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FeedbackReview } from '../FeedbackReview';
import { HandoffQueue } from '../HandoffQueue';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(ui: React.ReactNode, url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <Search />
    </MemoryRouter>,
  );
}

describe('Feedback tab', () => {
  it('shows the figures as cards and keeps the rating filter in the address', () => {
    renderAt(<FeedbackReview />, '/admin?module=ai-management&tab=feedback');
    expect(screen.getByText('Total feedback')).toBeDefined();

    const negative = screen.getByRole('tab', { name: 'Negative' });
    fireEvent.mouseDown(negative);
    fireEvent.click(negative);
    expect(screen.getByTestId('search').textContent).toContain('rating=negative');
    expect(screen.queryByText(/Our offices are open/)).toBeNull();
    expect(screen.getByText(/Our advice fee/)).toBeDefined();
  });

  it('opens on the rating named in the address', () => {
    renderAt(<FeedbackReview />, '/admin?module=ai-management&tab=feedback&rating=positive');
    expect(screen.getByRole('tab', { name: 'Positive' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByText(/Our advice fee/)).toBeNull();
  });
});

describe('Leads tab', () => {
  it('filters by a status card and keeps it in the address', () => {
    renderAt(<HandoffQueue />, '/admin?module=ai-management&tab=leads');
    fireEvent.click(screen.getByRole('button', { name: /^Contacted/ }));
    expect(screen.getByTestId('search').textContent).toContain('stage=contacted');
    expect(screen.queryByText('Karabo Sithole')).toBeNull();
    expect(screen.getByText('Grant Fourie')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getByTestId('search').textContent).not.toContain('stage=');
    expect(screen.getByText('Karabo Sithole')).toBeDefined();
  });

  it('opens on the status named in the address', () => {
    renderAt(<HandoffQueue />, '/admin?module=ai-management&tab=leads&stage=new');
    expect(screen.getByRole('button', { name: /^New/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Grant Fourie')).toBeNull();
  });
});
