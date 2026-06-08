import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../seo/SEO', () => ({
  SEO: () => null,
}));
vi.mock('../figma/ImageWithFallback', () => ({
  ImageWithFallback: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));
vi.mock('../shared/ResponsiveImage', () => ({
  ResponsiveImage: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));
vi.mock('../modals/ConsultationModal', () => ({
  ConsultationModal: ({ open }: { open: boolean }) => (open ? <div>ConsultationModal</div> : null),
}));
vi.mock('../../hooks/useImagePrefetch', () => ({
  useImagePrefetch: () => {},
  prefetchImages: () => {},
}));

import { ServicesPage } from '../ServicesPage';

describe('ServicesPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });
});
