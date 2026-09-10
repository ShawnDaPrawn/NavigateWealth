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
import { useIsArticleBrowserEscape } from '../../../hooks/useIsArticleBrowserEscape';
import { resetEscapeAttempt } from '../../../utils/pwa/articleEscapeAttempt';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ArticleBrowserRedirect />
    </MemoryRouter>,
  );
}

// Probe component so we can assert the hook's boolean without rendering MainLayout.
function EscapeProbe() {
  return <span data-testid="escape">{String(useIsArticleBrowserEscape())}</span>;
}

function renderProbeAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EscapeProbe />
    </MemoryRouter>,
  );
}

describe('ArticleBrowserRedirect', () => {
  beforeEach(() => {
    standalone = false;
    authenticated = false;
    mockNavigate.mockReset();
    vi.stubGlobal('open', vi.fn());
    // The hand-off guard persists across pages on purpose, so each test has to
    // start from a clean record.
    resetEscapeAttempt();
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

    // MUST be the apex origin: the www host is inside the installed PWA's
    // scope, so a www escape URL gets captured straight back into the app and
    // the client loops on this interstitial without ever seeing the article.
    const expectedUrl = 'https://navigatewealth.co/resources/article/some-insight?utm=email';

    expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');

    const link = screen.getByRole('link', { name: /read article in browser/i });
    expect(link.getAttribute('href')).toBe(expectedUrl);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('does not fire the hand-off again when the app is relaunched on the same article', () => {
    standalone = true;
    const path = '/resources/article/some-insight?nt=abc';

    // First launch: the emailed link was captured by the PWA, so hand it off.
    renderAt(path).unmount();
    expect(window.open).toHaveBeenCalledTimes(1);

    // The hand-off bounced back into the app and relaunched it — a brand new
    // page, so component state is gone. Firing again here is exactly the loop
    // clients reported: the browser and the app trading the link back and forth.
    renderAt(path);

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /read article in browser/i })).toBeTruthy();
  });

  it('still hands off a different article opened after a bounced attempt', () => {
    standalone = true;
    renderAt('/resources/article/some-insight').unmount();
    renderAt('/resources/article/another-insight');

    expect(window.open).toHaveBeenCalledTimes(2);
    expect(window.open).toHaveBeenLastCalledWith(
      'https://navigatewealth.co/resources/article/another-insight',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('copies the article link, so a device that keeps capturing it is not a dead end', async () => {
    standalone = true;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderAt('/resources/article/some-insight?nt=abc');
    fireEvent.click(screen.getByRole('button', { name: /copy article link/i }));

    expect(writeText).toHaveBeenCalledWith(
      'https://navigatewealth.co/resources/article/some-insight?nt=abc',
    );
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeTruthy();
  });

  it('lets the client continue into the portal instead', () => {
    standalone = true;
    authenticated = true;
    renderAt('/resources/article/some-insight');

    fireEvent.click(screen.getByRole('button', { name: /continue to the app/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});

describe('useIsArticleBrowserEscape', () => {
  beforeEach(() => {
    standalone = false;
  });

  it('is true only for an article route in standalone mode', () => {
    standalone = true;
    renderProbeAt('/resources/article/some-insight');
    expect(screen.getByTestId('escape').textContent).toBe('true');
  });

  it('is false for an article route in a normal browser tab', () => {
    standalone = false;
    renderProbeAt('/resources/article/some-insight');
    expect(screen.getByTestId('escape').textContent).toBe('false');
  });

  it('is false for a non-article route even in standalone mode', () => {
    standalone = true;
    renderProbeAt('/resources');
    expect(screen.getByTestId('escape').textContent).toBe('false');
  });
});
