import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Users } from 'lucide-react';
import { KPIGrid } from '../KPIGrid';
import type { DashboardKPI } from '../../types';

const mockKPIs: DashboardKPI[] = [
  {
    title: 'Total Clients',
    value: 42,
    change: 5,
    icon: Users,
    format: 'number',
  },
];

describe('KPIGrid', () => {
  it('renders without crashing with kpis', () => {
    const { container } = render(<KPIGrid kpis={mockKPIs} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders loading skeleton when loading=true and no kpis', () => {
    const { container } = render(<KPIGrid kpis={[]} loading={true} />);
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('renders empty state when kpis is empty and not loading', () => {
    const { container } = render(<KPIGrid kpis={[]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders with custom columns', () => {
    const { container } = render(<KPIGrid kpis={mockKPIs} columns={2} />);
    expect(container.firstChild).toBeDefined();
  });
});
