import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  describe('credibility (directory-listing review, October 2026)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('carries a note from the founder, by name, with his photo', () => {
      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: 'A Note From Our Founder' })).toBeDefined();
      expect(screen.getByAltText('Shawn Francisco, Founder of Navigate Wealth')).toBeDefined();
      expect(screen.getAllByText('Shawn Francisco').length).toBeGreaterThan(0);
    });

    it('states no unbacked figures and no untraceable testimonials', () => {
      const { container } = render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>,
      );
      const text = container.textContent ?? '';

      expect(text).not.toMatch(/years (of )?combined experience/i);
      expect(text).not.toMatch(/\d+\+ clients/i);
      expect(text).not.toMatch(/\d+% (client )?retention/i);
      expect(text).not.toMatch(/R500/i);
      expect(text).not.toMatch(/CFA/);
      expect(text).not.toMatch(/What Our Clients Say/);
      expect(text).toMatch(/FSP 54606/);
    });

    it('"Meet Our Founder" scrolls to the founder section instead of a placeholder video', () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Meet Our Founder/ }));

      expect(scrollIntoView).toHaveBeenCalled();
      expect(screen.queryByText(/Video Coming Soon/)).toBeNull();
    });

    it('lands on the founder section when opened at /about#founder', () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      render(
        <MemoryRouter initialEntries={['/about#founder']}>
          <AboutPage />
        </MemoryRouter>,
      );

      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});
