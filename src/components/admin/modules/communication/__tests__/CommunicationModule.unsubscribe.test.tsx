import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommunicationModule } from '../CommunicationModule';

vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));

vi.mock('../api', () => ({
  communicationApi: {
    getClients: vi.fn(async () => []),
    getUnsubscribed: vi.fn(async () => []),
    getGroups: vi.fn(async () => []),
    unsubscribeContact: vi.fn(),
    resubscribeContact: vi.fn(),
  },
}));

vi.mock('@/shared/forms/useSearchInputAutofillGuard', () => ({
  useSearchInputAutofillGuard: () => ({
    autoComplete: 'off',
    'data-lpignore': 'true',
  }),
}));

describe('CommunicationModule unsubscribe entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the unsubscribed manager from the header', async () => {
    render(<CommunicationModule />);

    fireEvent.click(screen.getByRole('button', { name: /Unsubscribed/i }));

    expect(
      await screen.findByText(/Manually stop a person from receiving communication campaigns/i),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Currently unsubscribed (0)')).toBeTruthy();
    });
  });
});
