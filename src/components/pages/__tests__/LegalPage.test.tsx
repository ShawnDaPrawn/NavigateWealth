import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({
    title: 'Legal',
    description: 'Legal page',
    keywords: [],
    canonicalUrl: '',
    ogType: 'website',
  }),
}));
vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));
vi.mock('../../../utils/pdfPrintTitle', () => ({
  escapeHtmlText: (s: string) => s,
  navigateWealthPdfDocumentTitle: (s: string) => s,
}));
vi.mock('../../admin/modules/resources/templates/BasePdfLayout', () => ({
  BASE_PDF_CSS: '',
}));

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { LegalPage } from '../LegalPage';

describe('LegalPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders page title', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Legal & Compliance')).toBeDefined();
  });

  it('renders Legal Notices tab', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    const tabs = screen.getAllByText(/Legal/i);
    expect(tabs.length).toBeGreaterThan(0);
  });

  it('renders Legal Conditions document link', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Legal Conditions & Disclosures')).toBeDefined();
  });

  it('renders Terms of Use document link', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Terms of Use')).toBeDefined();
  });

  it('renders Privacy tab trigger', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Privacy')).toBeDefined();
  });

  it('renders Regulatory tab trigger', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Reg')).toBeDefined();
  });

  it('renders Other tab trigger', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Other')).toBeDefined();
  });

  it('renders Need Legal Assistance section', () => {
    render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Need Legal Assistance?')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <LegalPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
