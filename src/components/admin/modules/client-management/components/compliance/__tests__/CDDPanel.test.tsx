/**
 * CDDPanel — design CM-K-CDD: identification with "Run CDD report", then history.
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

import { CDDPanel } from '../CDDPanel';

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

describe('CDDPanel', () => {
  it('lists past CDD reports and runs a new one', async () => {
    mockApiGet.mockResolvedValue({
      history: [
        {
          id: 'h-1',
          checkType: 'cdd_report',
          submittedAt: '2026-11-03T09:16:00Z',
          status: 'completed',
          summary: 'No adverse findings',
          matterId: 'NW-0187',
        },
      ],
    });
    mockApiPost.mockResolvedValue({ data: {}, matterId: 'NW-0190' });
    render(<CDDPanel {...props} />);

    await waitFor(() => expect(screen.getByText('No adverse findings')).toBeTruthy());
    expect(screen.getByText('CDD report')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run CDD report' }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    expect(mockApiPost.mock.calls[0][0]).toBe('/integrations/honeycomb/reports/cdd');
    await waitFor(() => expect(screen.getAllByText('NW-0190').length).toBeGreaterThan(0));
  });

  it('disables the run without an ID on file', () => {
    mockApiGet.mockResolvedValue({ history: [] });
    render(<CDDPanel {...props} idNumber={null} hasIdentification={false} />);
    expect(
      (screen.getByRole('button', { name: 'Run CDD report' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('No ID or passport number on file.')).toBeTruthy();
  });
});
