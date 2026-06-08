import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { SitemapPage } from '../SitemapPage';

describe('SitemapPage', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <SitemapPage />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders a non-empty page', () => {
    const { container } = render(
      <MemoryRouter>
        <SitemapPage />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(100);
  });
});
