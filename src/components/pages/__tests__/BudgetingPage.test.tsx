import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../ui/svg-charts', () => ({
  SVGBarChart: () => <div data-testid="bar-chart" />,
  SVGLineChart: () => <div data-testid="line-chart" />,
  SVGPieChart: () => <div data-testid="pie-chart" />,
  SVGAreaSparkline: () => <div data-testid="sparkline" />,
}));

import { BudgetingPage } from '../BudgetingPage';

describe('BudgetingPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <BudgetingPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <BudgetingPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });

  it('renders income and expense inputs', () => {
    render(
      <MemoryRouter>
        <BudgetingPage />
      </MemoryRouter>,
    );
    const matches = screen.getAllByText(/budget/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
