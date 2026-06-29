/**
 * Render-contract tests for the Accounts → Manager overview.
 *
 * The data hooks are mocked so the tests exercise the summary cards, the
 * due-date filter and the per-cluster VAT-position table without a network
 * or QueryClientProvider.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const mockUseRefundClusters = vi.fn();
const mockUseClusterDetails = vi.fn();
const mockUseManyEntityTransactions = vi.fn();

vi.mock('../../hooks/useRefundClusters', () => ({
  useRefundClusters: () => mockUseRefundClusters(),
  useClusterDetails: () => mockUseClusterDetails(),
  useManyEntityTransactions: () => mockUseManyEntityTransactions(),
}));

import { RefundManagerPanel } from '../RefundManagerPanel';

const alpha = { id: 'c1', name: 'Alpha', vatPeriod: 'C', archived: false };
const beta = { id: 'c2', name: 'Beta', vatPeriod: '', archived: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRefundClusters.mockReturnValue({ data: [alpha, beta], isLoading: false });
  mockUseClusterDetails.mockReturnValue([
    { data: { cluster: alpha, entities: [{ id: 'e1' }] }, isLoading: false },
    { data: { cluster: beta, entities: [] }, isLoading: false },
  ]);
  mockUseManyEntityTransactions.mockReturnValue([{ data: [], isLoading: false }]);
});

describe('RefundManagerPanel', () => {
  it('renders the heading, the due-date filter and the summary cards', () => {
    render(<RefundManagerPanel />);
    expect(screen.getByText('Manager Overview')).toBeDefined();
    expect(screen.getByLabelText('Filter by due date')).toBeDefined();
    expect(screen.getByText('Clusters shown')).toBeDefined();
    expect(screen.getByText('Overdue')).toBeDefined();
    expect(screen.getByText('Due this month')).toBeDefined();
  });

  it('lists every active cluster with the position table columns', () => {
    render(<RefundManagerPanel />);
    expect(screen.getByText('Cluster')).toBeDefined();
    expect(screen.getByText('Due date')).toBeDefined();
    expect(screen.getByText('VAT Position')).toBeDefined();
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });

  it('marks a cluster with no VAT category as having no due date', () => {
    render(<RefundManagerPanel />);
    expect(screen.getAllByText('No VAT category').length).toBeGreaterThan(0);
  });

  it('filters out clusters that have no due date when filtering by a window', () => {
    render(<RefundManagerPanel />);
    // Switch the filter to "No VAT category" — only Beta (no category) should remain.
    fireEvent.click(screen.getByLabelText('Filter by due date'));
    fireEvent.click(screen.getByRole('option', { name: 'No VAT category' }));

    const table = screen.getByRole('table');
    expect(within(table).queryByText('Alpha')).toBeNull();
    expect(within(table).getByText('Beta')).toBeDefined();
  });

  it('shows the empty state when there are no active clusters', () => {
    mockUseRefundClusters.mockReturnValue({ data: [], isLoading: false });
    mockUseClusterDetails.mockReturnValue([]);
    mockUseManyEntityTransactions.mockReturnValue([]);
    render(<RefundManagerPanel />);
    expect(screen.getByText(/no active refund clusters yet/i)).toBeDefined();
  });
});
