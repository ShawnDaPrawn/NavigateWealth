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

  it('always shows the founder, and no invented advisers, when the API is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ success: true, data: [] }),
      ok: true,
    } as Response);

    renderTeam();

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Shawn Francisco' })).toBeDefined();
    expect(screen.getByAltText(/Shawn Francisco, Founder of Navigate Wealth/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Read the full note from Shawn/ })).toBeDefined();
    expect(screen.queryByText('Michael Johnson')).toBeNull();
    expect(screen.queryByText('Sarah Chen')).toBeNull();
    expect(screen.queryByText('Series 7')).toBeNull();
    // A founder-led practice: no headcount claim, no "experienced team" copy.
    expect(screen.queryByText(/experienced team/i)).toBeNull();
  });

  it('still shows the founder when the API fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error('network'));

    renderTeam();

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Shawn Francisco' })).toBeDefined();
    expect(screen.queryByText('Lisa Thompson')).toBeNull();
  });

  it('renders published team members below the founder, without repeating the founder', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: 'founder-dup',
            name: 'Shawn Francisco',
            title: 'Founder',
            credentials: '',
            bio: 'Duplicate of the static founder profile.',
            specialties: [],
            image: '/team/shawn.jpg',
            sortOrder: 0,
          },
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

    expect(screen.getByText('Financial Adviser')).toBeDefined();
    expect(screen.getAllByRole('heading', { name: 'Shawn Francisco' })).toHaveLength(1);
    expect(screen.queryByText('Duplicate of the static founder profile.')).toBeNull();
  });
});
