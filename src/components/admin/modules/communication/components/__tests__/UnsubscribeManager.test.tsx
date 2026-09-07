import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@/test/utils';
import { UnsubscribeManager } from '../UnsubscribeManager';

const getClients = vi.fn();
const getUnsubscribed = vi.fn();
const unsubscribeContact = vi.fn();
const resubscribeContact = vi.fn();

vi.mock('../../api', () => ({
  communicationApi: {
    getClients: (...args: unknown[]) => getClients(...args),
    getUnsubscribed: (...args: unknown[]) => getUnsubscribed(...args),
    unsubscribeContact: (...args: unknown[]) => unsubscribeContact(...args),
    resubscribeContact: (...args: unknown[]) => resubscribeContact(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/shared/forms/useSearchInputAutofillGuard', () => ({
  useSearchInputAutofillGuard: () => ({
    autoComplete: 'off',
    'data-lpignore': 'true',
  }),
}));

describe('UnsubscribeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClients.mockResolvedValue([
      {
        id: 'c1',
        firstName: 'Alex',
        lastName: 'Example',
        surname: 'Example',
        email: 'alex@example.com',
        hasEmailOptIn: true,
      },
    ]);
    getUnsubscribed.mockResolvedValue([]);
    unsubscribeContact.mockResolvedValue({
      success: true,
      alreadyUnsubscribed: false,
      contact: {
        email: 'alex@example.com',
        clientId: 'c1',
        name: 'Alex Example',
        unsubscribedAt: '2026-08-31T10:00:00Z',
        unsubscribedBy: 'admin',
      },
    });
  });

  it('unsubscribes a searched client after confirmation', async () => {
    render(<UnsubscribeManager onClose={() => {}} />);

    await waitFor(() => expect(getClients).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Search clients to unsubscribe'), {
      target: { value: 'alex' },
    });
    expect(await screen.findByText('Alex Example')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Unsubscribe from communication?')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Unsubscribe' }));
    await waitFor(() =>
      expect(unsubscribeContact).toHaveBeenCalledWith({
        email: 'alex@example.com',
        clientId: 'c1',
        name: 'Alex Example',
      }),
    );
  });

  it('re-subscribes a listed contact', async () => {
    getUnsubscribed.mockResolvedValue([
      {
        email: 'alex@example.com',
        clientId: 'c1',
        name: 'Alex Example',
        unsubscribedAt: '2026-08-31T10:00:00Z',
        unsubscribedBy: 'admin',
      },
    ]);
    resubscribeContact.mockResolvedValue({ success: true, alreadySubscribed: false });

    render(<UnsubscribeManager onClose={() => {}} />);

    expect(await screen.findByText('Currently unsubscribed (1)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Re-subscribe/i }));

    await waitFor(() =>
      expect(resubscribeContact).toHaveBeenCalledWith({
        email: 'alex@example.com',
        clientId: 'c1',
      }),
    );
  });
});
