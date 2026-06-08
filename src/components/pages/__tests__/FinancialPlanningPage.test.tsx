import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../templates/ServicePageTemplate', () => ({
  ServicePageTemplate: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="service-template">{children}</div>
  ),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'Financial Planning', description: 'Test' }),
  financialPlanningFAQs: [],
}));
vi.mock('../../shared/assets/provider-logos', () => ({
  allanGrayLogo: '',
  sanlamLogo: '',
  momentumLogo: '',
  oldMutualLogo: '',
  libertyLogo: '',
  discoveryLogo: '',
  stanlibLogo: '',
}));

import { FinancialPlanningPage } from '../FinancialPlanningPage';

describe('FinancialPlanningPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <FinancialPlanningPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders the service template', () => {
    render(
      <MemoryRouter>
        <FinancialPlanningPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('service-template')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <FinancialPlanningPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
