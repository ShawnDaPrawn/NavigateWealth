/**
 * Render-contract tests for the Refund Clusters panel.
 *
 * The data hooks are mocked so the tests exercise the list, empty state,
 * search and create-dialog chrome without a network or QueryClientProvider.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mockUseRefundClusters = vi.fn();
const mockCreateMutate = vi.fn();

vi.mock('../hooks/useRefundClusters', () => ({
  useRefundClusters: () => mockUseRefundClusters(),
  useCreateCluster: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useRefundClusterDetail: () => ({ data: undefined, isLoading: true }),
  useCreateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useRevealEfilingPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEntityDocuments: () => ({ data: [], isLoading: false }),
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useViewDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { RefundClustersPanel } from '../RefundClustersPanel';

const cluster = {
  id: 'c1',
  name: 'Q3 VAT Refunds',
  description: 'Third quarter refunds',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'u1',
  entityCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRefundClusters.mockReturnValue({ data: [cluster], isLoading: false });
});

describe('RefundClustersPanel', () => {
  it('renders the heading and the Create New Cluster button', () => {
    render(<RefundClustersPanel />);
    expect(screen.getByText('Refund Clusters')).toBeDefined();
    expect(screen.getByRole('button', { name: /create new cluster/i })).toBeDefined();
  });

  it('lists clusters with entity counts', () => {
    render(<RefundClustersPanel />);
    expect(screen.getByText('Q3 VAT Refunds')).toBeDefined();
    expect(screen.getByText('2 entities')).toBeDefined();
  });

  it('shows the empty state when there are no clusters', () => {
    mockUseRefundClusters.mockReturnValue({ data: [], isLoading: false });
    render(<RefundClustersPanel />);
    expect(screen.getByText(/no refund clusters yet/i)).toBeDefined();
  });

  it('filters clusters by search term', () => {
    render(<RefundClustersPanel />);
    fireEvent.change(screen.getByPlaceholderText('Search clusters…'), {
      target: { value: 'does-not-match' },
    });
    expect(screen.queryByText('Q3 VAT Refunds')).toBeNull();
    expect(screen.getByText(/no clusters match your search/i)).toBeDefined();
  });

  it('opens the create dialog and submits name + description', () => {
    render(<RefundClustersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /create new cluster/i }));
    expect(screen.getByRole('heading', { name: 'Create New Cluster' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Cluster Name'), { target: { value: 'New Cluster' } });
    fireEvent.change(screen.getByLabelText('Cluster Description'), {
      target: { value: 'Desc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { name: 'New Cluster', description: 'Desc' },
      expect.anything(),
    );
  });

  it('hides archived clusters until toggled', () => {
    mockUseRefundClusters.mockReturnValue({
      data: [cluster, { ...cluster, id: 'c2', name: 'Old Cluster', archived: true }],
      isLoading: false,
    });
    render(<RefundClustersPanel />);
    expect(screen.queryByText('Old Cluster')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show archived/i }));
    expect(screen.getByText('Old Cluster')).toBeDefined();
    expect(screen.queryByText('Q3 VAT Refunds')).toBeNull();
  });
});
