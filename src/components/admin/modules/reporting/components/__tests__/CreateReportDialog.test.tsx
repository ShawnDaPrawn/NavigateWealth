import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateReportDialog } from '../CreateReportDialog';

afterEach(cleanup);

describe('CreateReportDialog', () => {
  it('asks for a name before creating, with the form error banner', () => {
    const onCreate = vi.fn();
    render(<CreateReportDialog open onOpenChange={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create report' }));
    expect(screen.getByText('Fix 1 field to create the report.')).toBeDefined();
    expect(screen.getByText('Give the report a name')).toBeDefined();
    expect(screen.getByLabelText('Report name').getAttribute('aria-invalid')).toBe('true');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates with the default columns and XLSX', () => {
    const onCreate = vi.fn();
    render(<CreateReportDialog open onOpenChange={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Report name'), { target: { value: ' Book ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Middle Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create report' }));
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Book',
      category: 'clients',
      dataSource: 'personal-clients',
      columns: ['User ID', 'Title', 'First Name'],
      format: 'xlsx',
    });
    expect(screen.getByText('Currently only Excel format is supported.')).toBeDefined();
  });
});
