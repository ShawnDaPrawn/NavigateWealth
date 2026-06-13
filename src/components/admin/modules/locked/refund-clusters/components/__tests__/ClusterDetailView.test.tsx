/**
 * Render-contract tests for the tabbed cluster detail view.
 *
 * The data hooks are mocked; tests cover the pill tab row (Entities /
 * Cluster Details), the default Entities tab content, and the Details tab.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mockUseRefundClusterDetail = vi.fn();

vi.mock('../../hooks/useRefundClusters', () => ({
  useRefundClusterDetail: () => mockUseRefundClusterDetail(),
  useCreateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useRevealEfilingPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEntityDocuments: () => ({ data: [], isLoading: false }),
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useViewDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ClusterDetailView } from '../ClusterDetailView';

const cluster = {
  id: 'c1',
  name: 'Q3 VAT Refunds',
  description: 'Third quarter refunds',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  createdBy: 'u1',
};

const entity = {
  id: 'e1',
  clusterId: 'c1',
  entityType: 'sole_proprietor' as const,
  personalDetails: { name: 'Thabo', surname: 'Nkosi', physicalAddress: '1 Main Rd' },
  bankingDetails: {
    primary: {
      bankName: 'FNB',
      accountHolder: '',
      accountNumber: '',
      branchCode: '',
      accountType: '',
    },
    secondary: {
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      branchCode: '',
      accountType: '',
    },
  },
  taxDetails: {
    efilingUsername: 'thabo123',
    hasEfilingPassword: true,
    vatPeriod: 'A' as const,
    currentPeriodVat: '',
    previousPeriodVat: '',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRefundClusterDetail.mockReturnValue({
    data: { cluster, entities: [entity] },
    isLoading: false,
  });
});

describe('ClusterDetailView', () => {
  it('renders the pill tab row with Entities and Cluster Details triggers', () => {
    render(<ClusterDetailView clusterId="c1" onBack={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Entities' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cluster Details' })).toBeDefined();
  });

  it('shows the entity list on the default Entities tab', () => {
    render(<ClusterDetailView clusterId="c1" onBack={vi.fn()} />);
    expect(screen.getByText('Thabo Nkosi')).toBeDefined();
    expect(screen.getByRole('button', { name: /add entity/i })).toBeDefined();
  });

  it('switches to the Cluster Details tab showing fields and actions', () => {
    render(<ClusterDetailView clusterId="c1" onBack={vi.fn()} />);
    const detailsTab = screen.getByRole('tab', { name: 'Cluster Details' });
    fireEvent.mouseDown(detailsTab);
    fireEvent.click(detailsTab);

    expect(screen.getByText('Last Updated')).toBeDefined();
    expect(screen.getAllByText('Third quarter refunds').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /delete cluster/i })).toBeDefined();
  });

  it('calls onBack from the back button', () => {
    const onBack = vi.fn();
    render(<ClusterDetailView clusterId="c1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to clusters/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows the not-found state when the cluster is missing', () => {
    mockUseRefundClusterDetail.mockReturnValue({ data: undefined, isLoading: false });
    render(<ClusterDetailView clusterId="missing" onBack={vi.fn()} />);
    expect(screen.getByText('Cluster not found.')).toBeDefined();
  });
});
