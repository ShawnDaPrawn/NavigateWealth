import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'Investment Management', description: 'Test' }),
  investmentManagementFAQs: [],
}));
vi.mock('../../templates/ServicePageTemplate', () => ({
  ServicePageTemplate: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="service-template">{children}</div>
  ),
}));
vi.mock('../../hooks/useImagePreload', () => ({
  useImagePreload: () => ({ isLoaded: true }),
}));

import { InvestmentManagementPage } from '../InvestmentManagementPage';

describe('InvestmentManagementPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <InvestmentManagementPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <InvestmentManagementPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(10);
  });
});
