/**
 * Render-contract tests for the Accounts section panel.
 *
 * The data hooks are mocked so the test exercises the section-nav tab row
 * (Overview / Refund Clusters / Disbursement Clusters) without a network or
 * QueryClientProvider. With no cluster open the section nav is visible and the
 * Overview tab (the VAT dashboard) is active.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useRefundClusters', () => ({
  useRefundClusters: () => ({ data: [], isLoading: false }),
  useClusterDetails: () => [],
  useManyEntityTransactions: () => [],
}));

import { AccountsPanel } from '../AccountsPanel';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountsPanel', () => {
  it('renders the section-nav tabs with Overview active', () => {
    render(<AccountsPanel />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Refund Clusters' })).toBeDefined();
    // Overview is the default section, so its VAT dashboard heading is shown.
    expect(screen.getByText('VAT Overview')).toBeDefined();
  });

  it('disables the Disbursement Clusters section (not built yet)', () => {
    render(<AccountsPanel />);
    const disbursement = screen.getByRole('tab', { name: /disbursement clusters/i });
    expect(disbursement.hasAttribute('disabled')).toBe(true);
  });
});
