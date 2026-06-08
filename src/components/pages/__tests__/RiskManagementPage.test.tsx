import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'Risk Management', description: 'Test' }),
  riskManagementFAQs: [],
}));
vi.mock('../../templates/ServicePageTemplate', () => ({
  ServicePageTemplate: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="service-template">{children}</div>
  ),
}));
vi.mock('../../hooks/useImagePreload', () => ({
  useImagePreload: () => ({ isLoaded: true }),
}));

import { RiskManagementPage } from '../RiskManagementPage';

describe('RiskManagementPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <RiskManagementPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <RiskManagementPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(10);
  });
});
