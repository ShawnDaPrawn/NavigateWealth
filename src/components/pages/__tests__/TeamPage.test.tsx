import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));
vi.mock('../../seo/seo-config', () => ({
  getSEOData: () => ({
    title: 'Our Team',
    description: 'Team page',
    keywords: [],
    canonicalUrl: '',
    ogType: 'website',
  }),
}));
vi.mock('../../shared/OptimizedImage', () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-key',
}));

import { TeamPage } from '../TeamPage';

function renderTeam() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>,
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render invented fallback advisers when the API is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ success: true, data: [] }),
      ok: true,
    } as Response);

    renderTeam();

    await waitFor(() => {
      expect(screen.getByText(/Team profiles are being updated/i)).toBeDefined();
    });

    expect(screen.queryByText('Michael Johnson')).toBeNull();
    expect(screen.queryByText('Sarah Chen')).toBeNull();
    expect(screen.queryByText('Series 7')).toBeNull();
    expect(screen.getByRole('link', { name: /Contact Us/i })).toBeDefined();
  });

  it('does not render invented fallback advisers when the API fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error('network'));

    renderTeam();

    await waitFor(() => {
      expect(screen.getByText(/Team profiles are being updated/i)).toBeDefined();
    });

    expect(screen.queryByText('Lisa Thompson')).toBeNull();
  });

  it('renders published team members from the API', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: 'real-1',
            name: 'Thabo Mokoena',
            title: 'Financial Adviser',
            credentials: 'CFP®',
            bio: 'Independent advice for South African families.',
            specialties: ['Retirement Planning'],
            image: '/team/thabo.jpg',
            sortOrder: 1,
          },
        ],
      }),
      ok: true,
    } as Response);

    renderTeam();

    await waitFor(() => {
      expect(screen.getByText('Thabo Mokoena')).toBeDefined();
    });

    expect(screen.queryByText(/Team profiles are being updated/i)).toBeNull();
    expect(screen.getByText('Financial Adviser')).toBeDefined();
  });
});
