import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'Test', description: 'Test' }),
}));
vi.mock('../modals/GetQuoteModal', () => ({
  GetQuoteModal: ({ open }: { open: boolean }) => (open ? <div>GetQuoteModal</div> : null),
}));
vi.mock('../modals/ConsultationModal', () => ({
  ConsultationModal: ({ open }: { open: boolean }) => (open ? <div>ConsultationModal</div> : null),
}));
vi.mock('../modals/ProvidersModal', () => ({
  ProvidersModal: ({ open }: { open: boolean }) => (open ? <div>ProvidersModal</div> : null),
}));

import { WhyUsPage } from '../WhyUsPage';

describe('WhyUsPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <WhyUsPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders main heading content', () => {
    render(
      <MemoryRouter>
        <WhyUsPage />
      </MemoryRouter>,
    );
    const matches = screen.getAllByText(/Navigate Wealth/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <WhyUsPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });
});
