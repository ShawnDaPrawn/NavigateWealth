/**
 * Smoke tests for the three simple compliance register tab components.
 * Each tab renders a ComplianceTable with hard-coded column definitions.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CPDRegisterTab } from '../CPDRegisterTab';
import { CancellationRegisterTab } from '../CancellationRegisterTab';
import { ProductTrainingRegisterTab } from '../ProductTrainingRegisterTab';

vi.mock('../ComplianceTable', () => ({
  ComplianceTable: ({
    title,
    description,
  }: {
    title: string;
    description: string;
    records: unknown[];
    columns: unknown[];
    onAdd: () => void;
    onEdit: (r: unknown) => void;
    onExport: () => void;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CPDRegisterTab', () => {
  it('renders without throwing', () => {
    render(<CPDRegisterTab />);
    expect(screen.getByText('CPD Register')).toBeDefined();
  });
});

describe('CancellationRegisterTab', () => {
  it('renders without throwing', () => {
    render(<CancellationRegisterTab />);
    expect(screen.getByText('Cancellation Register')).toBeDefined();
  });
});

describe('ProductTrainingRegisterTab', () => {
  it('renders without throwing', () => {
    render(<ProductTrainingRegisterTab />);
    expect(screen.getByText('Product Specific Training Register')).toBeDefined();
  });
});
