/**
 * PortfolioTableTab — render / interaction test.
 *
 * Pins what an adviser sees: the product-structure columns, a row per client
 * policy with its values, the read-only Last Updated and Policy Print
 * columns, search and sorting, and the upload flow — a chosen file is
 * previewed first and only an explicit Apply writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithQueryClient, screen, waitFor, within } from '@/test/utils';
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
    // Money reads the way the rest of the app writes it.
    expect(screen.getByText('R100,000.00')).toBeDefined();
    // The policy number column is flagged as the match key.
    expect(screen.getByText('(match key)')).toBeDefined();
    expect(api.fetchPortfolioTable).toHaveBeenCalledWith('p1', 'employee_benefits');
  });

  it('summarises the book above the table', async () => {
    renderTab();
    await screen.findByText('Thandi Nkosi');
    const stats = screen.getByText('Policy prints').closest('dl') as HTMLElement;
    expect(within(stats).getByText('1 of 2')).toBeDefined();
    expect(within(stats).getByText('Latest update')).toBeDefined();
    expect(screen.getByText('2 policies')).toBeDefined();
  });

  it('offers the policy print only where one is on file, and opens it in a new tab', async () => {
    // The tab is opened synchronously on the click (before the signed URL is
    // fetched) so Safari does not block it as a popup, then navigated.
    const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
    renderTab();
    await screen.findByText('Thandi Nkosi');
    expect(screen.getByText('None on file')).toBeDefined();
    const print = screen.getByRole('button', { name: /policy print for Thandi Nkosi/ });
    // The button carries the print's date, so a stale print shows at a glance.
    expect(print.textContent).toContain('01 Feb 2026');
    fireEvent.click(print);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    await waitFor(() => expect(api.fetchPolicyPrintUrl).toHaveBeenCalledWith('pol1', 'c1'));
    await waitFor(() => expect(tab.location.href).toBe('https://signed.test/print.pdf'));
    expect(tab.close).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('closes the placeholder tab when the print link cannot be fetched', async () => {
    api.fetchPolicyPrintUrl.mockRejectedValueOnce(new Error('No policy print on record'));
    const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
    renderTab();
    await screen.findByText('Thandi Nkosi');
    fireEvent.click(screen.getByRole('button', { name: /open the policy print/ }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe('');
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
    // The count, and the row's own badge.
    expect(screen.getByText('client mismatch')).toBeDefined();
    expect(screen.getByText('Client mismatch')).toBeDefined();
    // Outcomes that did not happen are left out rather than shown as zeros.
    expect(screen.queryByText('duplicate')).toBeNull();
    expect(screen.queryByText('invalid')).toBeNull();
    expect(screen.getByText(/belongs to Thandi Nkosi/)).toBeDefined();
    expect(screen.getByText(/Ignored columns/)).toBeDefined();
    // A changed value is shown the way the table shows it.
    const preview = screen
      .getByText('Preview: book.csv')
      .closest('[data-slot="card"]') as HTMLElement;
    expect(within(preview).getByText('R50,000.00')).toBeDefined();
    expect(within(preview).getByText('R60,000.00')).toBeDefined();

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

function bodyRowNames() {
  const region = screen.getByRole('region', { name: /portfolio/ });
  return within(region)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('rowheader')[0].textContent);
}

describe('PortfolioTableTab — finding a policy', () => {
  it('searches by client name or policy number, and says when nothing matches', async () => {
    renderTab();
    await screen.findByText('Thandi Nkosi');
    const search = screen.getByLabelText('Search the portfolio');
    fireEvent.focus(search);

    fireEvent.change(search, { target: { value: 'thandi' } });
    expect(bodyRowNames()).toEqual(['Thandi Nkosi']);
    expect(screen.getByText('Showing 1 of 2 policies')).toBeDefined();

    // Spaces and dashes in a policy number do not matter.
    fireEvent.change(search, { target: { value: 'eb 002' } });
    expect(bodyRowNames()).toEqual(['John Smith']);

    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(screen.getByText(/No client or policy number matches/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(bodyRowNames()).toEqual(['John Smith', 'Thandi Nkosi']);
  });

  it('sorts by a header, and reverses on a second click', async () => {
    renderTab();
    await screen.findByText('Thandi Nkosi');
    // Client name order to start with.
    expect(bodyRowNames()).toEqual(['John Smith', 'Thandi Nkosi']);
    const clientHeader = screen.getByRole('columnheader', { name: /Client/ });
    expect(clientHeader.getAttribute('aria-sort')).toBe('ascending');

    const updated = screen.getByRole('button', { name: /Last Updated/ });
    fireEvent.click(updated);
    // Least recently updated first: the record an agent has not touched lately.
    expect(bodyRowNames()).toEqual(['Thandi Nkosi', 'John Smith']);
    expect(
      screen.getByRole('columnheader', { name: /Last Updated/ }).getAttribute('aria-sort'),
    ).toBe('ascending');
    expect(clientHeader.getAttribute('aria-sort')).toBe('none');

    fireEvent.click(updated);
    expect(bodyRowNames()).toEqual(['John Smith', 'Thandi Nkosi']);

    // A money column sorts by amount.
    fireEvent.click(screen.getByRole('button', { name: /Cover Amount/ }));
    expect(bodyRowNames()).toEqual(['John Smith', 'Thandi Nkosi']);
    fireEvent.click(screen.getByRole('button', { name: /Cover Amount/ }));
    expect(bodyRowNames()).toEqual(['Thandi Nkosi', 'John Smith']);
  });
});
