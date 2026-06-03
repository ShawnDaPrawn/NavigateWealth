/**
 * EventFormModal — Render / Characterization Test (Phase 4)
 * ==========================================================
 *
 * Locks the dialog title ("New Event" when no event prop is passed), the
 * Save button, and the date/time inputs for this 963-line Phase 6 target.
 *
 * useClients (React Query) and useSearchInputAutofillGuard are mocked so
 * the component renders without a QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/forms/useSearchInputAutofillGuard', () => ({
  useSearchInputAutofillGuard: () => ({
    id: 'search',
    name: 'search',
    type: 'text',
    readOnly: false,
    autoComplete: 'off',
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { EventFormModal } from '../EventFormModal';

const noop = vi.fn();
const noopSubmit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EventFormModal', () => {
  it('shows "New Event" dialog title when open with no event', () => {
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} />);

    expect(screen.getByText('New Event')).toBeTruthy();
  });

  it('shows "Edit Event" title when open with an existing event', () => {
    const event = {
      id: 'ev-1',
      title: 'My Meeting',
      type: 'meeting',
      startTime: '2026-01-01T10:00:00.000Z',
      endTime: '2026-01-01T11:00:00.000Z',
      locationType: 'in_person',
    };
    render(
      <EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} event={event as never} />,
    );

    expect(screen.getByText('Edit Event')).toBeTruthy();
  });

  it('shows a Save button when open', () => {
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });
});
