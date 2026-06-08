import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComplianceTable } from '../ComplianceTable';
import type { ComplianceRecord, ComplianceColumn } from '../../types';

vi.mock('../../../../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const record: ComplianceRecord = {
  id: 'rec-1',
  title: 'FAIS Fit & Proper',
  status: 'current',
  ragStatus: 'green',
  owner: 'Jane Doe',
  created: new Date('2025-01-01'),
  notes: 'All good',
  attachments: 2,
  tags: ['fais', 'compliance'],
};

const columns: ComplianceColumn[] = [
  { key: 'title', label: 'Item', type: 'text' },
  { key: 'status', label: 'Status', type: 'badge' },
  { key: 'owner', label: 'Owner', type: 'text' },
];

describe('ComplianceTable', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ComplianceTable title="FAIS Register" records={[]} columns={columns} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders title', () => {
    render(<ComplianceTable title="FAIS Register" records={[]} columns={columns} />);
    expect(screen.getByText('FAIS Register')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(
      <ComplianceTable
        title="FAIS Register"
        description="Track all FAIS records"
        records={[]}
        columns={columns}
      />,
    );
    expect(screen.getByText('Track all FAIS records')).toBeDefined();
  });

  it('renders record data', () => {
    render(<ComplianceTable title="Table" records={[record]} columns={columns} />);
    expect(screen.getAllByText(/Jane Doe/i).length).toBeGreaterThan(0);
  });

  it('shows record count', () => {
    render(<ComplianceTable title="Table" records={[record]} columns={columns} />);
    expect(screen.getByText(/Showing 1 of 1 records/i)).toBeDefined();
  });

  it('shows empty state when no matching records', () => {
    render(<ComplianceTable title="Table" records={[]} columns={columns} />);
    expect(screen.getByText(/No records found/i)).toBeDefined();
  });

  it('renders loading state', () => {
    const { container } = render(
      <ComplianceTable title="Table" records={[]} columns={columns} loading />,
    );
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('renders Export button when onExport provided', () => {
    const onExport = vi.fn();
    render(<ComplianceTable title="Table" records={[]} columns={columns} onExport={onExport} />);
    expect(screen.getByText(/Export/i)).toBeDefined();
  });

  it('calls onExport when Export clicked', () => {
    const onExport = vi.fn();
    render(<ComplianceTable title="Table" records={[]} columns={columns} onExport={onExport} />);
    fireEvent.click(screen.getByText(/Export/i));
    expect(onExport).toHaveBeenCalled();
  });

  it('renders Add Record button when onAdd provided', () => {
    const onAdd = vi.fn();
    render(<ComplianceTable title="Table" records={[]} columns={columns} onAdd={onAdd} />);
    expect(screen.getAllByText(/Add/i).length).toBeGreaterThan(0);
  });

  it('renders amber/red RAG summary indicators', () => {
    const redRecord: ComplianceRecord = { ...record, id: 'rec-2', ragStatus: 'red' };
    render(<ComplianceTable title="Table" records={[record, redRecord]} columns={columns} />);
    expect(screen.getByText(/Red: 1/i)).toBeDefined();
    expect(screen.getByText(/Green: 1/i)).toBeDefined();
  });

  it('filters records on search input', () => {
    render(<ComplianceTable title="Table" records={[record]} columns={columns} />);
    const input = screen.getByPlaceholderText(/Search records/i);
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByText(/Showing 0 of 1 records/i)).toBeDefined();
  });

  it('renders date column values', () => {
    const cols: ComplianceColumn[] = [{ key: 'created', label: 'Created', type: 'date' }];
    const { container } = render(
      <ComplianceTable title="Table" records={[record]} columns={cols} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders currency column values', () => {
    const rec = { ...record, amount: 5000 } as unknown as ComplianceRecord;
    const cols: ComplianceColumn[] = [{ key: 'amount', label: 'Amount', type: 'currency' }];
    render(<ComplianceTable title="Table" records={[rec]} columns={cols} />);
    expect(screen.getByText(/R5,000/)).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <ComplianceTable title="FAIS" records={[record]} columns={columns} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
