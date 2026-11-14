/**
 * IdentityVerificationPanel — the design CM-K-Identity layout:
 * identification, the two checks side by side, then a history table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));
vi.mock('@/utils/api', () => ({
  api: { get: mockApiGet, post: mockApiPost },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 't') },
}));

import { IdentityVerificationPanel } from '../IdentityVerificationPanel';

const props = {
  clientId: 'c-1',
  firstName: 'Elsa',
  lastName: 'van Wyk',
  idNumber: '8203150123081',
  passport: null,
  hasIdentification: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IdentityVerificationPanel', () => {
  it('shows the identification, both checks and the history table', async () => {
    mockApiGet.mockResolvedValue({
      history: [
        {
          id: 'h-1',
          checkType: 'idv_no_photo',
          submittedAt: '2026-11-03T09:14:00Z',
          status: 'completed',
          summary: 'ID number valid',
          matterId: 'NW-0187',
        },
      ],
    });
    render(<IdentityVerificationPanel {...props} />);

    expect(screen.getByText('Client identification')).toBeTruthy();
    expect(screen.getByText('820315•••••81')).toBeTruthy();
    expect(screen.getByText('IDV check')).toBeTruthy();
    expect(screen.getByText('IDV with photo')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('ID number valid')).toBeTruthy());
    expect(screen.getByText('Verification complete')).toBeTruthy();
    // The latest matter id from history fills the identification card.
    expect(screen.getByText('NW-0187')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Run IDV with photo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('runs the IDV check and shows the result', async () => {
    mockApiGet.mockResolvedValue({ history: [] });
    mockApiPost.mockResolvedValue({ data: { ok: true }, matterId: 'NW-0200' });
    render(<IdentityVerificationPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run IDV check' }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    expect(mockApiPost.mock.calls[0][0]).toBe('/integrations/honeycomb/idv/no-photo');
    await waitFor(() => expect(screen.getByText('Verification complete')).toBeTruthy());
  });

  it('warns and disables the checks when there is no ID on file', () => {
    mockApiGet.mockResolvedValue({ history: [] });
    render(<IdentityVerificationPanel {...props} idNumber={null} hasIdentification={false} />);
    expect(screen.getByText('No ID or passport number on file.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Run IDV check' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
