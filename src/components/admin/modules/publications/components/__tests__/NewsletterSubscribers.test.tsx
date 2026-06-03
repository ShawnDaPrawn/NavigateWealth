/**
 * NewsletterSubscribers — Render / Characterization Test (Phase 4)
 * =================================================================
 *
 * Locks the "Newsletter Subscribers" heading and the always-visible action
 * buttons (Refresh, Add Subscriber) for this 1,041-line Phase 6 target.
 *
 * Newsletter hooks are mocked so no React Query context is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

const mutStub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });

vi.mock('@/components/admin/modules/publications/hooks/useNewsletterSubscribers', () => ({
  useNewsletterSubscribers: () => ({
    subscribers: [],
    filtered: [],
    stats: { total: 0, active: 0, unsubscribed: 0 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/admin/modules/publications/hooks/useNewsletterMutations', () => ({
  useAddSubscriber: mutStub,
  useBulkUpload: mutStub,
  useRemoveSubscriber: mutStub,
  useResubscribe: mutStub,
  useUpdateSubscriber: mutStub,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { NewsletterSubscribers } from '../NewsletterSubscribers';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewsletterSubscribers', () => {
  it('renders without throwing and shows the heading', () => {
    render(<NewsletterSubscribers />);
    expect(screen.getByText('Newsletter Subscribers')).toBeTruthy();
  });

  it('shows the Add Subscriber button', () => {
    render(<NewsletterSubscribers />);
    expect(screen.getByRole('button', { name: /add subscriber/i })).toBeTruthy();
  });

  it('shows the Bulk Import button', () => {
    render(<NewsletterSubscribers />);
    expect(screen.getByRole('button', { name: /bulk import/i })).toBeTruthy();
  });
});
