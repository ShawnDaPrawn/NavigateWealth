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

  it('invokes onEmptyStateAction (instead of navigating away) from the empty state', () => {
    const onEmptyStateAction = vi.fn();
    render(
      <MemoryRouter>
        {/* netIncome defaults to 0 -> empty state is shown */}
        <BudgetingPage onEmptyStateAction={onEmptyStateAction} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Go to Personal Info/i }));
    expect(onEmptyStateAction).toHaveBeenCalledTimes(1);
  });

  it('renders expenses supplied via profileData.budgetExpenses', () => {
    render(
      <MemoryRouter>
        <BudgetingPage
          netIncome={63000}
          grossIncome={79000}
          profileData={{
            budgetExpenses: [
              { id: '1', description: 'Rent payment', amount: 12000, category: 'needs' },
            ],
          }}
          handleInputChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Rent payment')).toBeDefined();
  });

  it('persists a new expense through handleInputChange', () => {
    const handleInputChange = vi.fn();
    render(
      <MemoryRouter>
        <BudgetingPage
          netIncome={63000}
          grossIncome={79000}
          profileData={{ budgetExpenses: [] }}
          handleInputChange={handleInputChange}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Add Your First Expense'));
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Groceries' },
    });
    fireEvent.change(screen.getByLabelText(/Monthly Amount/i), {
      target: { value: '2500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(handleInputChange).toHaveBeenCalledWith('budgetExpenses', [
      expect.objectContaining({ description: 'Groceries', amount: 2500, category: 'needs' }),
    ]);
  });
});

describe('BudgetingPage known expenses', () => {
  it('fills in liability repayments and policy premiums without saving them as expenses', () => {
    const handleInputChange = vi.fn();
    render(
      <MemoryRouter>
        <BudgetingPage
          netIncome={60000}
          grossIncome={80000}
          profileData={{
            budgetExpenses: [],
            liabilities: [
              { id: 'l1', name: 'Credit Card', type: 'Credit Card', monthlyPayment: 5000 },
            ],
          }}
          handleInputChange={handleInputChange}
          policyExpenses={[
            {
              id: 'policy-expense:p1',
              description: 'Brightrock',
              detail: 'Life cover premium',
              amount: 1450,
              category: 'needs',
              source: 'policy',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('No Expenses Yet')).toBeNull();
    expect(screen.getByText('Credit Card')).toBeDefined();
    expect(screen.getByText('Brightrock')).toBeDefined();
    expect(screen.getByText(/2 filled in from liabilities and policies/)).toBeDefined();
    expect(screen.getAllByText(/R\s?6[\s,]?450/).length).toBeGreaterThan(0);
    expect(handleInputChange).not.toHaveBeenCalled();
  });

  it('flags a typed-in expense with the same amount as a known one', () => {
    render(
      <MemoryRouter>
        <BudgetingPage
          netIncome={60000}
          profileData={{
            budgetExpenses: [
              { id: '1', description: 'Card payment', amount: 5000, category: 'needs' },
            ],
            liabilities: [{ id: 'l1', name: 'Credit Card', monthlyPayment: 5000 }],
          }}
          handleInputChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Same amount as Credit Card/)).toBeDefined();
  });
});
