import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../utils/supabase/client', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}));

vi.mock('../../../utils/currencyFormatter', () => ({
  formatCurrency: (n: number) => `R${n.toLocaleString()}`,
}));

import { PolicyDetailModal } from '../PolicyDetailModal';

const fields = [
  { id: 'f1', name: 'Policy Number', type: 'text', value: 'POL-001' },
  { id: 'f2', name: 'Premium', type: 'currency', value: 1500 },
  { id: 'f3', name: 'Active', type: 'boolean', value: true },
];

describe('PolicyDetailModal', () => {
  it('renders without crashing when open', () => {
    const { container } = render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Discovery"
        categoryName="Life Insurance"
        fields={fields}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders provider name', () => {
    render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Discovery"
        categoryName="Life Insurance"
        fields={fields}
      />,
    );
    expect(screen.getAllByText(/Discovery/i).length).toBeGreaterThan(0);
  });

  it('renders category name', () => {
    render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Discovery"
        categoryName="Life Insurance"
        fields={fields}
      />,
    );
    expect(screen.getAllByText(/Life Insurance/i).length).toBeGreaterThan(0);
  });

  it('renders field values', () => {
    render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Discovery"
        categoryName="Life Insurance"
        fields={fields}
      />,
    );
    expect(screen.getByText('POL-001')).toBeDefined();
  });

  it('renders different theme colors without crashing', () => {
    const { container } = render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Sanlam"
        categoryName="Investment"
        fields={[]}
        themeColor="blue"
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <PolicyDetailModal
        isOpen
        onClose={vi.fn()}
        providerName="Liberty"
        categoryName="Retirement"
        fields={fields}
        themeColor="green"
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
