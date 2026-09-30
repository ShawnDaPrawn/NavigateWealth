/**
 * PortfolioTableTab — render / interaction test.
 *
 * Pins what an adviser sees: the product-structure columns, a row per client
 * policy with its values, the read-only Last Updated and Policy Print
 * columns, and the upload flow — a chosen file is previewed first and only an
 * explicit Apply writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithQueryClient, screen, waitFor } from '@/test/utils';
import type { PortfolioApplyReport, PortfolioTable } from '@/shared/integrations/portfolio-table';

const api = vi.hoisted(() => ({
  fetchPortfolioTable: vi.fn(),
  uploadPortfolioTable: vi.fn(),
  downloadPortfolioTable: vi.fn(async () => undefined),
  fetchPolicyPrintUrl: vi.fn(async () => 'https://signed.test/print.pdf'),
}));

vi.mock('@/components/admin/modules/product-management/api', () => ({
  productManagementApi: api,
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { PortfolioTableTab } from '../PortfolioTableTab';
import { formatPortfolioValue } from '../portfolioFormat';

const table: PortfolioTable = {
  providerId: 'p1',
  providerName: 'Allan Gray',
  categoryId: 'employee_benefits',
  categoryLabel: 'Employee Benefits',
  generatedAt: '2026-09-30T08:00:00.000Z',
  columns: [
    { id: 'eb_1', name: 'Policy Number', type: 'text', required: true, isPolicyNumber: true },
    { id: 'eb_2', name: 'Employer', type: 'text', required: true, isPolicyNumber: false },
    { id: 'eb_4', name: 'Cover Amount', type: 'currency', required: false, isPolicyNumber: false },
  ],
  rows: [
    {
      clientId: 'c2',
      clientName: 'John Smith',
      policyId: 'pol2',
      policyNumber: 'EB-002',
      categoryId: 'employee_benefits',
      updatedAt: '2026-03-01T10:30:00.000Z',
      lockedFields: [],
      values: { eb_1: 'EB-002', eb_2: null, eb_4: 50000 },
      lastSync: null,
      policyPrint: null,
    },
    {
      clientId: 'c1',
      clientName: 'Thandi Nkosi',
      policyId: 'pol1',
      policyNumber: 'EB-001',
      categoryId: 'employee_benefits',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lockedFields: ['eb_4'],
      values: { eb_1: 'EB-001', eb_2: 'Acme', eb_4: 100000 },
      lastSync: { source: 'portal', publishedAt: '2026-01-01T00:00:00.000Z' },
      policyPrint: {
        fileName: 'print.pdf',
        uploadDate: '2026-02-01T00:00:00.000Z',
        documentType: 'policy_schedule',
        fileSize: 1234,
      },
    },
  ],
  clientCount: 2,
  policyCount: 2,
};

const previewReport: PortfolioApplyReport = {
  success: true,
  dryRun: true,
  providerId: 'p1',
  providerName: 'Allan Gray',
  categoryId: 'employee_benefits',
  categoryLabel: 'Employee Benefits',
  source: 'spreadsheet',
  runId: null,
  appliedAt: '2026-09-30T08:05:00.000Z',
  summary: {
    rows: 2,
    updated: 1,
    unchanged: 0,
    unmatched: 0,
    clientMismatch: 1,
    duplicate: 0,
    invalid: 0,
    failed: 0,
    clientsTouched: 1,
  },
  warnings: [
    'Ignored columns that are not part of the Employee Benefits product structure: Colour',
  ],
  rows: [
    {
      rowNumber: 2,
      clientName: 'John Smith',
      policyNumber: 'EB-002',
      status: 'updated',
      policyId: 'pol2',
      clientId: 'c2',
      matchedClientName: 'John Smith',
      matchedBy: 'client_name_policy_number',
      changes: [{ fieldId: 'eb_4', fieldName: 'Cover Amount', oldValue: 50000, newValue: 60000 }],
      warnings: [],
      errors: [],
    },
    {
      rowNumber: 3,
      clientName: 'Someone Else',
      policyNumber: 'EB-001',
      status: 'client_mismatch',
      matchedClientName: 'Thandi Nkosi',
      matchedBy: null,
      changes: [],
      warnings: [],
      errors: ['Policy "EB-001" belongs to Thandi Nkosi, not "Someone Else"'],
    },
  ],
};

const provider = { id: 'p1', name: 'Allan Gray', categoryIds: ['employee_benefits'] };

function renderTab() {
  return renderWithQueryClient(
    <PortfolioTableTab provider={provider} selectedCategoryId="employee_benefits" />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPortfolioTable.mockResolvedValue(table);
});

describe('PortfolioTableTab', () => {
  it('renders the product-structure columns and a row per client policy', async () => {
    renderTab();
    expect(await screen.findByText('Thandi Nkosi')).toBeDefined();
    expect(screen.getByText('John Smith')).toBeDefined();
    for (const header of [
      'Client',
      'Policy Number',
      'Employer',
      'Cover Amount',
      'Last Updated',
      'Policy Print',
    ]) {
      expect(screen.getByText(header)).toBeDefined();
    }
    expect(screen.getByText('EB-001')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
    // The policy number column is flagged as the match key.
    expect(screen.getByText('key')).toBeDefined();
    expect(api.fetchPortfolioTable).toHaveBeenCalledWith('p1', 'employee_benefits');
  });

  it('offers the policy print only where one is on file, and opens it in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderTab();
    await screen.findByText('Thandi Nkosi');
    expect(screen.getByText('None on file')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /PDF/ }));
    await waitFor(() => expect(api.fetchPolicyPrintUrl).toHaveBeenCalledWith('pol1', 'c1'));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://signed.test/print.pdf',
        '_blank',
        'noopener,noreferrer',
      ),
    );
    open.mockRestore();
  });

  it('marks a locked value so an adviser knows an upload will not move it', async () => {
    renderTab();
    await screen.findByText('Thandi Nkosi');
    expect(screen.getByLabelText('Locked')).toBeDefined();
  });

  it('previews an uploaded sheet first and applies only on confirmation', async () => {
    api.uploadPortfolioTable.mockResolvedValueOnce(previewReport).mockResolvedValueOnce({
      ...previewReport,
      dryRun: false,
      runId: 'run-1',
    });
    renderTab();
    await screen.findByText('Thandi Nkosi');

    const input = screen.getByLabelText('Upload portfolio spreadsheet') as HTMLInputElement;
    const file = new File(['Client,Policy Number\n'], 'book.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(api.uploadPortfolioTable).toHaveBeenCalledWith(
        file,
        'p1',
        'employee_benefits',
        'preview',
      ),
    );
    expect(await screen.findByText('Preview: book.csv')).toBeDefined();
    // Once as the summary counter, once as the row's badge.
    expect(screen.getAllByText('Client mismatch')).toHaveLength(2);
    expect(screen.getByText(/belongs to Thandi Nkosi/)).toBeDefined();
    expect(screen.getByText(/Ignored columns/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 update' }));
    await waitFor(() =>
      expect(api.uploadPortfolioTable).toHaveBeenLastCalledWith(
        file,
        'p1',
        'employee_benefits',
        'apply',
      ),
    );
    expect(await screen.findByText('Spreadsheet applied')).toBeDefined();
    // The book is re-read after a write.
    await waitFor(() => expect(api.fetchPortfolioTable).toHaveBeenCalledTimes(2));
  });

  it('downloads the spreadsheet for the selected provider and product', async () => {
    renderTab();
    await screen.findByText('Thandi Nkosi');
    fireEvent.click(screen.getByRole('button', { name: /Download spreadsheet/ }));
    await waitFor(() =>
      expect(api.downloadPortfolioTable).toHaveBeenCalledWith('p1', 'employee_benefits'),
    );
  });

  it('asks for a product category before showing anything', () => {
    renderWithQueryClient(<PortfolioTableTab provider={provider} selectedCategoryId="" />);
    expect(screen.getByText(/Select a product category/)).toBeDefined();
    expect(api.fetchPortfolioTable).not.toHaveBeenCalled();
  });
});

describe('formatPortfolioValue', () => {
  const currency = { id: 'x', name: 'x', type: 'currency', required: false, isPolicyNumber: false };
  it('renders empties as a dash and typed values for their column', () => {
    expect(formatPortfolioValue(currency, null)).toBe('—');
    expect(formatPortfolioValue(currency, '')).toBe('—');
    expect(formatPortfolioValue(currency, 1234.5)).toMatch(/^R\s1\s?234[,.]5$/);
    expect(formatPortfolioValue({ ...currency, type: 'percentage' }, '12')).toBe('12%');
    expect(formatPortfolioValue({ ...currency, type: 'boolean' }, true)).toBe('Yes');
    expect(formatPortfolioValue({ ...currency, type: 'text' }, 'Acme')).toBe('Acme');
  });
});
