import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createContactPageSchema: () => ({}),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({
    title: 'Contact',
    description: 'Contact page',
    keywords: [],
    canonicalUrl: '',
    ogType: 'website',
  }),
}));
vi.mock('../../modals/ThankYouModal', () => ({
  ThankYouModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="thankyou-modal">ThankYou</div> : null,
}));
vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-key',
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
      ok: true,
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { ContactPage } from '../ContactPage';

describe('ContactPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders hero heading', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Us')).toBeDefined();
  });

  it('renders Get In Touch section', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    const headings = screen.getAllByText('Get In Touch');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders Individuals client type by default', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    const labels = screen.getAllByText('Individuals');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('renders phone and email info', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('012 667 2025')).toBeDefined();
    const emailEls = screen.getAllByText('info@navigatewealth.co');
    expect(emailEls.length).toBeGreaterThan(0);
  });

  it('renders form fields', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByPlaceholderText(/first name/i).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText(/last name/i).length).toBeGreaterThan(0);
  });

  it('renders trust indicators', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/Free consultation/i).length).toBeGreaterThan(0);
  });

  it('types into first name field', () => {
    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    const inputs = screen.getAllByPlaceholderText(/first name/i);
    fireEvent.change(inputs[0], { target: { value: 'John' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('John');
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
