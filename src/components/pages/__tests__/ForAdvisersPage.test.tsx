import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../seo/seo-config', () => ({
  getSEOData: () => ({ title: 'For Advisers', description: 'Test' }),
}));
vi.mock('../figma/ImageWithFallback', () => ({
  ImageWithFallback: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));
vi.mock('../modals/GetQuoteModal', () => ({
  GetQuoteModal: ({ open }: { open: boolean }) => (open ? <div>GetQuoteModal</div> : null),
}));
vi.mock('../modals/ConsultationModal', () => ({
  ConsultationModal: ({ open }: { open: boolean }) => (open ? <div>ConsultationModal</div> : null),
}));

import { ForAdvisersPage } from '../ForAdvisersPage';

describe('ForAdvisersPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ForAdvisersPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <ForAdvisersPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });
});
