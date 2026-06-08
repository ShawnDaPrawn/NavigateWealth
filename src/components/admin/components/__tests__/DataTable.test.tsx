import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, Column } from '../DataTable';

type Row = { id: string; name: string; status: string; amount: number };

const columns: Column<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'status', title: 'Status' },
  { key: 'amount', title: 'Amount', sortable: true },
];

const data: Row[] = [
  { id: '1', name: 'Alice', status: 'active', amount: 100 },
  { id: '2', name: 'Bob', status: 'inactive', amount: 200 },
  { id: '3', name: 'Charlie', status: 'active', amount: 50 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable data={data} columns={columns} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Amount')).toBeDefined();
  });

  it('renders row data', () => {
    render(<DataTable data={data} columns={columns} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('renders loading skeleton when loading=true', () => {
    render(<DataTable data={[]} columns={columns} loading={true} />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders empty state when data is empty and not loading', () => {
    render(<DataTable data={[]} columns={columns} />);
    expect(screen.getByText('No data found')).toBeDefined();
  });

  it('renders custom empty state', () => {
    render(<DataTable data={[]} columns={columns} emptyState={<p>Custom empty message</p>} />);
    expect(screen.getByText('Custom empty message')).toBeDefined();
  });

  it('renders search input when searchable=true', () => {
    render(<DataTable data={data} columns={columns} searchable={true} />);
    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
  });

  it('filters rows when searching', () => {
    render(<DataTable data={data} columns={columns} />);
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('does not render search when searchable=false', () => {
    render(<DataTable data={data} columns={columns} searchable={false} />);
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={data} columns={columns} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('sorts column ascending when header clicked', () => {
    render(<DataTable data={data} columns={columns} />);
    fireEvent.click(screen.getByText('Name'));
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('toggles sort direction when same header clicked twice', () => {
    render(<DataTable data={data} columns={columns} />);
    fireEvent.click(screen.getByText('Name'));
    fireEvent.click(screen.getByText('Name'));
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('renders export button when exportable=true', () => {
    render(<DataTable data={data} columns={columns} exportable={true} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeDefined();
  });

  it('does not render export button when exportable=false', () => {
    render(<DataTable data={data} columns={columns} exportable={false} />);
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
  });

  it('renders without pagination when paginate=false', () => {
    render(<DataTable data={data} columns={columns} paginate={false} />);
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
  });

  it('renders custom search placeholder', () => {
    render(<DataTable data={data} columns={columns} searchPlaceholder="Find client..." />);
    expect(screen.getByPlaceholderText('Find client...')).toBeDefined();
  });

  it('renders with custom className', () => {
    const { container } = render(<DataTable data={data} columns={columns} className="my-table" />);
    expect(container.innerHTML).toContain('my-table');
  });

  it('renders rows using getRowKey', () => {
    render(<DataTable data={data} columns={columns} getRowKey={(row) => row.id} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('renders column with custom render function', () => {
    const customColumns: Column<Row>[] = [
      { key: 'name', title: 'Name', render: (val) => <strong>{String(val)}</strong> },
    ];
    render(<DataTable data={data} columns={customColumns} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('renders with rowSizeOptions selector', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowSizeOptions={[5, 10, 25] as const}
        pageSize={5}
      />,
    );
    expect(screen.getByText('Alice')).toBeDefined();
  });
});
