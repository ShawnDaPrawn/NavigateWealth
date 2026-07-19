/**
 * Render-contract tests for the transactions ledger dialog. Hooks are mocked
 * so the test exercises the summary panel + table without a network.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseEntityLedger = vi.fn();

vi.mock('../hooks/useRefundClusters', () => ({
  useEntityLedger: () => mockUseEntityLedger(),
  useCreateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useViewAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useSetAttachmentVerified: () => ({ mutate: vi.fn(), isPending: false }),
  useDownloadSubmissionPack: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../suppliers/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [], isLoading: false }),
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

function ledger(transactions: RefundTransaction[], flags: Record<string, string[]> = {}) {
  return { data: { transactions, flags }, isLoading: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseEntityLedger.mockReturnValue(ledger([]));
});

describe('EntityTransactionsDialog', () => {
  it('renders the empty state and add button', () => {
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="A" />);
    expect(screen.getByText(/No transactions yet/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeDefined();
  });

  it('shows a refundable net position when input VAT exceeds output', () => {
    mockUseEntityLedger.mockReturnValue(
      ledger([
        tx({ direction: 'expense', amount: 2300, vatAmount: 300, date: '2026-03-10' }),
        tx({
          id: 't2',
          direction: 'income',
          amount: 1150,
          vatAmount: 150,
          date: '2026-03-12',
        }),
      ]),
    );
    // vatPeriod="" → no period filter, so all transactions count regardless of date.
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="" />);
    // Net = output 150 − input 300 = −150 → Input / Refund
    expect(screen.getByText(/Input \/ Refund/i)).toBeDefined();
    expect(screen.getAllByText('Supplier invoice').length).toBeGreaterThan(0);
  });

  it('renders the current VAT period label from the cluster category', () => {
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="C" />);
    expect(screen.getByText(/VAT period:/i)).toBeDefined();
  });

  it('surfaces server-computed evidence flags on the row', () => {
    mockUseEntityLedger.mockReturnValue(
      ledger([tx({ attachments: [] })], { t1: ['missing_tax_invoice'] }),
    );
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="" />);
    expect(screen.getByText(/No tax invoice attached/i)).toBeDefined();
    expect(screen.getByText(/1 flagged/i)).toBeDefined();
  });

  it('shows the evidence-complete badge when nothing is flagged', () => {
    mockUseEntityLedger.mockReturnValue(
      ledger(
        [
          tx({
            attachments: [
              {
                id: 'a1',
                kind: 'tax_invoice',
                fileName: 'inv.pdf',
                storagePath: 'p',
                contentType: 'application/pdf',
                sizeBytes: 1,
                uploadedAt: '2026-03-15T00:00:00.000Z',
                uploadedBy: 'u1',
              },
            ],
          }),
        ],
        { t1: [] },
      ),
    );
    render(<EntityTransactionsDialog open onOpenChange={() => {}} entity={entity} vatPeriod="" />);
    expect(screen.getByText(/Evidence complete/i)).toBeDefined();
  });
});
