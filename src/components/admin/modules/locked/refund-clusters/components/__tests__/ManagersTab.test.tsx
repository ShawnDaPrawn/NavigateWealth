/**
 * Render-contract tests for the cluster Managers tab. Hooks are mocked so the
 * test exercises the list + empty state without a network.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseClusterManagers = vi.fn();

vi.mock('../../hooks/useRefundClusters', () => ({
  useClusterManagers: () => mockUseClusterManagers(),
  useCreateManager: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateManager: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteManager: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ManagersTab } from '../ManagersTab';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseClusterManagers.mockReturnValue({ data: [], isLoading: false });
});

describe('ManagersTab', () => {
  it('renders the empty state and add button', () => {
    render(<ManagersTab clusterId="c1" />);
    expect(screen.getByText(/No managers yet/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /add manager/i })).toBeDefined();
  });

  it('lists managers with their role and contact details', () => {
    mockUseClusterManagers.mockReturnValue({
      data: [
        {
          id: 'm1',
          clusterId: 'c1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '0820000000',
          role: 'Bookkeeper',
          notes: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          createdBy: 'u1',
        },
      ],
      isLoading: false,
    });
    render(<ManagersTab clusterId="c1" />);
    expect(screen.getByText('Jane Doe')).toBeDefined();
    expect(screen.getByText('Bookkeeper')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
  });
});
