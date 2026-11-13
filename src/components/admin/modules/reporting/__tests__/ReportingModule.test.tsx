import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const perms = vi.hoisted(() => ({ canCreate: true }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({
    canDo: (_module: string, capability: string) => capability === 'create' && perms.canCreate,
  }),
}));

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

  it('keeps New report switched off, marked Soon', () => {
    render(<ReportingModule />);
    const newReport = screen.getByRole('button', { name: /New report/ });
    expect((newReport as HTMLButtonElement).disabled).toBe(true);
    expect(newReport.textContent).toContain('Soon');
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
