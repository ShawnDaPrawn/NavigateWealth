/**
 * Render-contract tests for the transactions ledger dialog. Hooks are mocked
 * so the test exercises the summary panel + table without a network.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseEntityTransactions = vi.fn();

vi.mock('../hooks/useRefundClusters', () => ({
  useEntityTransactions: () => mockUseEntityTransactions(),
  useCreateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useViewTransactionInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { EntityTransactionsDialog } from '../components/EntityTransactionsDialog';
import type { RefundEntity, RefundTransaction } from '../types';

const entity: RefundEntity = {
  id: 'e1',
  clusterId: 'c1',
  entityType: 'company',
  businessDetails: {
    companyName: 'Acme (Pty) Ltd',
    registrationNumber: '2020/1/07',
    tradingName: '',
    registeredAddress: '',
    physicalBusinessAddress: '',
    contactPerson: '',
    contactPersonEmail: '',
    contactPersonPhone: '',
  },
  bankingDetails: {
    primary: {
      bankName: '',
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
    efilingUsername: '',
    hasEfilingPassword: false,
    currentPeriodVat: '',
    previousPeriodVat: '',
  },
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  createdBy: 'u1',
};

function tx(overrides: Partial<RefundTransaction>): RefundTransaction {
  return {
    id: 't1',
    entityId: 'e1',
    clusterId: 'c1',
    date: '2026-03-15',
    description: 'Supplier invoice',
    direction: 'expense',
    vatTreatment: 'standard',
    amount: 1150,
    vatAmount: 150,
    vatOverridden: false,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseEntityTransactions.mockReturnValue({ data: [], isLoading: false });
});

describe('EntityTransactionsDialog', () => {
  it('renders the empty state and add button', () => {
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="A" />);
    expect(screen.getByText(/No transactions yet/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeDefined();
  });

  it('shows a refundable net position when input VAT exceeds output', () => {
    mockUseEntityTransactions.mockReturnValue({
      data: [
        tx({ direction: 'expense', amount: 2300, vatAmount: 300, date: '2026-03-10' }),
        tx({
          id: 't2',
          direction: 'income',
          amount: 1150,
          vatAmount: 150,
          date: '2026-03-12',
        }),
      ],
      isLoading: false,
    });
    // vatPeriod="" → no period filter, so all transactions count regardless of date.
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="" />);
    // Net = output 150 − input 300 = −150 → Input / Refund
    expect(screen.getByText(/Input \/ Refund/i)).toBeDefined();
    expect(screen.getAllByText('Supplier invoice').length).toBeGreaterThan(0);
  });

  it('renders the current VAT period label from the cluster category', () => {
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="C" />);
    expect(screen.getByText(/Current VAT period:/i)).toBeDefined();
  });
});
