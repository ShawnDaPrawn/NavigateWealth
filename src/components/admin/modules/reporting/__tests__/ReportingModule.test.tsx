import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const perms = vi.hoisted(() => ({ canCreate: true }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({
    canDo: (_module: string, capability: string) => capability === 'create' && perms.canCreate,
  }),
}));

const defs = vi.hoisted(() => ({
  list: vi.fn(async () => [] as unknown[]),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  reportDefinitionsApi: defs,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportingModule } from '../ReportingModule';

beforeEach(() => {
  perms.canCreate = true;
});

describe('ReportingModule', () => {
  it('renders the Reporting heading, its description and the report count', () => {
    render(<ReportingModule />);
    expect(screen.getByRole('heading', { level: 1, name: 'Reporting' })).toBeDefined();
    expect(
      screen.getByText('Generate insights and export data with custom reports.'),
    ).toBeDefined();
    expect(screen.getByText('5 reports')).toBeDefined();
  });

  it('creates a report from the New report dialog and lists it', async () => {
    defs.create.mockResolvedValue({
      id: 'd1',
      name: 'Adviser book',
      category: 'clients',
      dataSource: 'personal-clients',
      columns: ['User ID', 'Title', 'First Name', 'Middle Name'],
      format: 'xlsx',
      createdBy: 'u',
      createdAt: '2026-11-13T00:00:00Z',
    });
    render(<ReportingModule />);
    fireEvent.click(screen.getByRole('button', { name: /New report/ }));
    fireEvent.change(screen.getByLabelText('Report name'), { target: { value: 'Adviser book' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create report' }));
    await waitFor(() =>
      expect(defs.create).toHaveBeenCalledWith({
        name: 'Adviser book',
        category: 'clients',
        dataSource: 'personal-clients',
        columns: ['User ID', 'Title', 'First Name', 'Middle Name'],
        format: 'xlsx',
      }),
    );
    expect(await screen.findByText('Adviser book')).toBeDefined();
    expect(screen.getByText('6 reports')).toBeDefined();
  });

  it('lists saved reports, and says so when they cannot load', async () => {
    defs.list.mockResolvedValueOnce([
      {
        id: 'd2',
        name: 'Consent check',
        category: 'compliance',
        dataSource: 'compliance-audit',
        columns: ['Client Name', 'POPIA Consent'],
        format: 'xlsx',
        createdBy: 'u',
        createdAt: '2026-11-13T00:00:00Z',
      },
    ]);
    render(<ReportingModule />);
    expect(await screen.findByText('Consent check')).toBeDefined();
    expect(screen.getByText('POPIA / FAIS compliance audit · 2 columns')).toBeDefined();
    cleanup();

    defs.list.mockRejectedValueOnce(new Error('down'));
    render(<ReportingModule />);
    expect(await screen.findByText("Couldn't load your saved reports.")).toBeDefined();
  });

  it('hides New report from people who cannot create reports', () => {
    perms.canCreate = false;
    render(<ReportingModule />);
    expect(screen.queryByRole('button', { name: /New report/ })).toBeNull();
  });

  it('opens a report’s settings in a centred dialog', async () => {
    render(<ReportingModule />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Applications Pipeline' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Applications Pipeline')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: /Run report/ })).toBeDefined();
  });

  it('says so when a search matches no report', () => {
    render(<ReportingModule />);
    fireEvent.change(screen.getByLabelText('Search reports'), { target: { value: 'payroll' } });
    expect(screen.getByText('No reports found')).toBeDefined();
    expect(screen.getByText('Try another search.')).toBeDefined();
  });
});
