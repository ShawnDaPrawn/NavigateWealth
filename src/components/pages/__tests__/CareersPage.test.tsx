import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({
    title: 'Careers',
    description: 'Careers page',
    keywords: [],
    canonicalUrl: '',
    ogType: 'website',
  }),
}));
vi.mock('../../modals/CVUploadModal', () => ({
  CVUploadModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="cv-modal">CVUploadModal</div> : null,
}));
vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-key',
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
      ok: true,
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { CareersPage } from '../CareersPage';

describe('CareersPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders hero heading', () => {
    render(
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>,
    );
    const matches = screen.getAllByText(/Career/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders category sections', () => {
    render(
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Advisory')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
