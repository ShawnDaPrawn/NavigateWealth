import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/SEO', () => ({
  SEO: () => null,
  createAboutPageSchema: () => ({}),
}));
vi.mock('../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'About', description: 'About us' }),
}));
vi.mock('../modals/ConsultationModal', () => ({
  ConsultationModal: ({ open }: { open: boolean }) => (open ? <div>ConsultationModal</div> : null),
}));
vi.mock('../modals/ThankYouModal', () => ({
  ThankYouModal: ({ open }: { open: boolean }) => (open ? <div>ThankYouModal</div> : null),
}));
vi.mock('../modals/ProvidersModal', () => ({
  ProvidersModal: ({ open }: { open: boolean }) => (open ? <div>ProvidersModal</div> : null),
}));

import { AboutPage } from '../AboutPage';

describe('AboutPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });

  it('renders Navigate Wealth branding', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );
    const matches = screen.getAllByText(/Navigate Wealth/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
