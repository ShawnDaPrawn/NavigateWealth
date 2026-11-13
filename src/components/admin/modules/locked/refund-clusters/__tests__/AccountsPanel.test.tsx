/**
 * Render-contract tests for the Accounts section panel.
 *
 * The data hooks are mocked so the test exercises the section control
 * (Overview / Refund clusters / Disbursement clusters) and the open cluster
 * without a network or QueryClientProvider. Both live in the address.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const cluster = {
  id: 'c1',
  name: 'Q3 VAT Refunds',
  description: '',
  vatPeriod: 'B' as const,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  createdBy: 'u1',
  entityCount: 0,
};

vi.mock('../hooks/useRefundClusters', () => ({
  useRefundClusters: () => ({ data: [cluster], isLoading: false }),
  useCreateCluster: () => ({ mutate: vi.fn(), isPending: false }),
  useClusterDetails: () => [],
  useManyEntityTransactions: () => [],
}));

vi.mock('../components/ClusterDetailView', () => ({
  ClusterDetailView: ({ clusterId, onBack }: { clusterId: string; onBack: () => void }) => (
    <div data-testid="cluster-page">
      {clusterId}
      <button type="button" onClick={onBack}>
        Back to clusters
      </button>
    </div>
  ),
}));

import { AccountsPanel } from '../AccountsPanel';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderPanel(url = '/admin?module=locked&tab=accounts') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AccountsPanel />
      <Search />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountsPanel', () => {
  it('renders the section control with Overview active', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Refund clusters' })).toBeDefined();
    // Overview is the default section, so its VAT dashboard heading is shown.
    expect(screen.getByText('VAT overview')).toBeDefined();
  });

  it('disables the Disbursement clusters section (not switched on)', () => {
    renderPanel();
    const disbursement = screen.getByRole('tab', { name: /disbursement clusters/i });
    expect(disbursement.hasAttribute('disabled')).toBe(true);
  });

  it('writes the section to the address', () => {
    renderPanel();
    const clusters = screen.getByRole('tab', { name: 'Refund clusters' });
    fireEvent.mouseDown(clusters);
    fireEvent.click(clusters);
    expect(screen.getByTestId('search').textContent).toContain('section=refund-clusters');
    expect(screen.getByRole('button', { name: 'Open Q3 VAT Refunds' })).toBeDefined();
  });

  it('opens a cluster as a page with its own address, and goes back to the list', () => {
    renderPanel('/admin?module=locked&tab=accounts&section=refund-clusters');
    fireEvent.click(screen.getByRole('button', { name: 'Open Q3 VAT Refunds' }));
    expect(screen.getByTestId('cluster-page').textContent).toContain('c1');
    expect(screen.getByTestId('search').textContent).toContain('cluster=c1');

    fireEvent.click(screen.getByRole('button', { name: 'Back to clusters' }));
    expect(screen.queryByTestId('cluster-page')).toBeNull();
    expect(screen.getByTestId('search').textContent).not.toContain('cluster=');
    expect(screen.getByRole('button', { name: 'Open Q3 VAT Refunds' })).toBeDefined();
  });

  it('opens the cluster named in the address', () => {
    renderPanel('/admin?module=locked&tab=accounts&section=refund-clusters&cluster=c1');
    expect(screen.getByTestId('cluster-page')).toBeDefined();
  });

  it('says so when the address names a cluster that does not exist', () => {
    renderPanel('/admin?module=locked&tab=accounts&section=refund-clusters&cluster=gone');
    expect(toastError).toHaveBeenCalledWith('Cluster not found');
    expect(screen.queryByTestId('cluster-page')).toBeNull();
    expect(screen.getByTestId('search').textContent).not.toContain('cluster=');
  });
});
