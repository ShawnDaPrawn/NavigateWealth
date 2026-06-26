import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const mockNavigate = vi.fn();
let standalone = false;
let authenticated = false;

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../hooks/useIsStandalone', () => ({
  useIsStandalone: () => standalone,
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: authenticated, user: null }),
}));

vi.mock('../../auth/RouteGuards', () => ({
  getAuthenticatedRedirectPath: () => '/dashboard',
}));

import { ArticleBrowserRedirect } from '../ArticleBrowserRedirect';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ArticleBrowserRedirect />
    </MemoryRouter>,
  );
}

describe('ArticleBrowserRedirect', () => {
  beforeEach(() => {
    standalone = false;
    authenticated = false;
    mockNavigate.mockReset();
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing in a normal browser tab', () => {
    standalone = false;
    const { container } = renderAt('/resources/article/some-insight');
    expect(container.innerHTML).toBe('');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('renders nothing on a non-article route even when standalone', () => {
    standalone = true;
    const { container } = renderAt('/dashboard');
    expect(container.innerHTML).toBe('');
  });

  it('shows the interstitial and auto-opens the website article when standalone', () => {
    standalone = true;
    renderAt('/resources/article/some-insight?utm=email');

    const expectedUrl = 'https://www.navigatewealth.co/resources/article/some-insight?utm=email';

    expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');

    const link = screen.getByRole('link', { name: /read article in browser/i });
    expect(link.getAttribute('href')).toBe(expectedUrl);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('lets the client continue into the portal instead', () => {
    standalone = true;
    authenticated = true;
    renderAt('/resources/article/some-insight');

    fireEvent.click(screen.getByRole('button', { name: /continue to the app/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
