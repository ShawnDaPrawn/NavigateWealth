import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({
    title: 'Press',
    description: 'Press page',
    keywords: [],
    canonicalUrl: '',
    ogType: 'website',
  }),
}));
vi.mock('../../modals/MediaAccessModal', () => ({
  MediaAccessModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="media-modal">MediaAccessModal</div> : null,
}));
vi.mock('../../figma/ImageWithFallback', () => ({
  ImageWithFallback: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-key',
}));
vi.mock('@/utils/siteOrigin', () => ({
  SITE_ORIGIN: 'https://www.navigatewealth.co',
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

import { PressPage } from '../PressPage';

describe('PressPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders hero heading', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/in the News/i)).toBeDefined();
  });

  it('renders Download Media Kit button', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Download Media Kit/i)).toBeDefined();
  });

  it('opens media modal when Download Media Kit is clicked', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    const btn = screen.getByText(/Download Media Kit/i);
    fireEvent.click(btn);
    expect(screen.getByTestId('media-modal')).toBeDefined();
  });

  it('renders category filter tabs', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Company News')).toBeDefined();
    expect(screen.getByText('Awards')).toBeDefined();
  });

  it('renders Media Resources section', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Media Resources')).toBeDefined();
  });

  it('renders Brand Assets card', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Brand Assets')).toBeDefined();
  });

  it('renders Media Contact section', () => {
    render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Media Contact')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <PressPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
