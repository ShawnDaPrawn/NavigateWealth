/**
 * Render-contract tests for the tabbed cluster detail view.
 *
 * The data hooks are mocked; tests cover the pill tab row (Entities /
 * Cluster details), the default Overview tab content, the Details tab, and the
 * address (tab, entity type filter, entity form page).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const mockUseRefundClusterDetail = vi.fn();

vi.mock('../../hooks/useRefundClusters', () => ({
  useRefundClusterDetail: () => mockUseRefundClusterDetail(),
  useCreateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useRevealEfilingPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevealBankPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClusterManagers: () => ({ data: [], isLoading: false }),
  useCreateManager: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateManager: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteManager: () => ({ mutate: vi.fn(), isPending: false }),
  useEntityDocuments: () => ({ data: [], isLoading: false }),
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useViewDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useEntityTransactions: () => ({ data: [], isLoading: false }),
  useEntitiesTransactions: () => [],
  useCreateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useViewTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ClusterDetailView } from '../ClusterDetailView';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderView(
  { clusterId = 'c1', onBack = vi.fn() }: { clusterId?: string; onBack?: () => void } = {},
  url = '/admin?module=locked&tab=accounts&cluster=c1',
) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ClusterDetailView clusterId={clusterId} onBack={onBack} />
      <Search />
    </MemoryRouter>,
  );
}

const cluster = {
  id: 'c1',
  name: 'Q3 VAT Refunds',
  description: 'Third quarter refunds',
  vatPeriod: 'A' as const,
  vatYearEndMonth: 2,
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
      onlineUsername: '',
      hasOnlinePassword: false,
    },
    secondary: {
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      branchCode: '',
      accountType: '',
      onlineUsername: '',
      hasOnlinePassword: false,
    },
  },
  taxDetails: {
    efilingUsername: 'thabo123',
    hasEfilingPassword: true,
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
  it('is a page: back link, the cluster name as the heading, and the cluster tabs', () => {
    const onBack = vi.fn();
    renderView({ onBack });
    expect(screen.getByRole('heading', { level: 1, name: 'Q3 VAT Refunds' })).toBeDefined();
    expect(screen.getByText(/Refund cluster · Category A/)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Entities' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Managers' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cluster details' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to clusters' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('writes the cluster tab and the entity type filter to the address', () => {
    renderView();
    const entitiesTab = screen.getByRole('tab', { name: 'Entities' });
    fireEvent.mouseDown(entitiesTab);
    fireEvent.click(entitiesTab);
    expect(screen.getByTestId('search').textContent).toContain('clusterTab=entities');

    const companies = screen.getByRole('tab', { name: 'Companies' });
    fireEvent.mouseDown(companies);
    fireEvent.click(companies);
    expect(screen.getByTestId('search').textContent).toContain('entityType=company');
    expect(screen.queryByText('Thabo Nkosi')).toBeNull();
  });

  it('opens the tab named in the address', () => {
    renderView({}, '/admin?module=locked&tab=accounts&cluster=c1&clusterTab=details');
    expect(screen.getByRole('tab', { name: 'Cluster details' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('adds an entity on a page of its own, with its own address', () => {
    renderView({}, '/admin?module=locked&tab=accounts&cluster=c1&clusterTab=entities');
    fireEvent.click(screen.getByRole('button', { name: /add entity/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Add entity' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('search').textContent).toContain('entity=new');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Q3 VAT Refunds' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Q3 VAT Refunds' })).toBeDefined();
    expect(screen.getByTestId('search').textContent).not.toContain('entity=');
  });

  it('opens the entity named in the address for editing', () => {
    renderView({}, '/admin?module=locked&tab=accounts&cluster=c1&clusterTab=entities&entity=e1');
    expect(screen.getByRole('heading', { level: 1, name: 'Edit sole proprietor' })).toBeDefined();
  });

  it('says so when the address names an entity that does not exist', () => {
    renderView({}, '/admin?module=locked&tab=accounts&cluster=c1&entity=gone');
    expect(toastError).toHaveBeenCalledWith('Entity not found');
    expect(screen.getByRole('heading', { level: 1, name: 'Q3 VAT Refunds' })).toBeDefined();
  });

  it('shows the entity list on the Entities tab', () => {
    renderView();
    const entitiesTab = screen.getByRole('tab', { name: 'Entities' });
    fireEvent.mouseDown(entitiesTab);
    fireEvent.click(entitiesTab);

    expect(screen.getByText('Thabo Nkosi')).toBeDefined();
    expect(screen.getByRole('button', { name: /add entity/i })).toBeDefined();
  });

  it('renders the current-period VAT overview on the default Overview tab', () => {
    renderView();
    expect(screen.getByText('Current submission period')).toBeDefined();
    expect(screen.getByText('VAT Output')).toBeDefined();
    expect(screen.getByText('VAT Input')).toBeDefined();
    expect(screen.getByText(/return due by/i)).toBeDefined();
  });

  it('switches to the Cluster details tab showing fields and actions', () => {
    renderView();
    const detailsTab = screen.getByRole('tab', { name: 'Cluster details' });
    fireEvent.mouseDown(detailsTab);
    fireEvent.click(detailsTab);

    expect(screen.getByText('Last Updated')).toBeDefined();
    expect(screen.getByText('Third quarter refunds')).toBeDefined();
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /delete cluster/i })).toBeDefined();
  });

  it('calls onBack from the not-found back button', () => {
    mockUseRefundClusterDetail.mockReturnValue({ data: undefined, isLoading: false });
    const onBack = vi.fn();
    renderView({ clusterId: 'missing', onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to clusters/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows the not-found state when the cluster is missing', () => {
    mockUseRefundClusterDetail.mockReturnValue({ data: undefined, isLoading: false });
    renderView({ clusterId: 'missing' });
    expect(screen.getByText('Cluster not found.')).toBeDefined();
  });
});
