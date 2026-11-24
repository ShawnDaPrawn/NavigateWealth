/**
 * The installed app's 404: NotFoundPage hands over to AppNotFoundPage in
 * standalone mode, whichever design is live, and MainLayout drops the
 * website's header and footer around it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

const state = vi.hoisted(() => ({
  standalone: true,
  auth: { isAuthenticated: false, user: null as null | { id: string } },
}));

vi.mock('../../../hooks/useIsStandalone', () => ({ useIsStandalone: () => state.standalone }));
vi.mock('../../../utils/pwa/displayMode', () => ({ isStandaloneDisplay: () => state.standalone }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ ...state.auth, logout: vi.fn() }),
}));
const getAuthenticatedRedirectPath = vi.hoisted(() => vi.fn(() => '/dashboard'));
vi.mock('../../auth/RouteGuards', () => ({ getAuthenticatedRedirectPath }));
vi.mock('../../../site/design', () => ({
  SITE_DESIGN: 'navigator',
  resolveSiteDesign: () => 'navigator',
}));
vi.mock('../InstallAppPrompt', () => ({ InstallAppPrompt: () => null }));
vi.mock('../../../site/pages/NavigatorNotFoundPage', () => ({
  NavigatorNotFoundPage: () => <h1>Website 404</h1>,
}));
vi.mock('../../../site/layout/NavigatorChrome', () => ({
  NavigatorHeader: () => <header data-testid="site-header" />,
  NavigatorFooter: () => <footer data-testid="site-footer" />,
}));

const { NotFoundPage } = await import('../../pages/NotFoundPage');
const { MainLayout } = await import('../../layout/MainLayout');

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderMissing() {
  render(
    <MemoryRouter initialEntries={['/no-such-page']}>
      <Routes>
        <Route path="/login" element={<Where />} />
        <Route path="/dashboard" element={<Where />} />
        <Route
          path="*"
          element={
            <MainLayout forcePublicLayout bareInInstalledApp>
              <NotFoundPage />
            </MainLayout>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.standalone = true;
  state.auth = { isAuthenticated: false, user: null };
});

describe('the installed app 404', () => {
  it("is the app's own screen, without the website's header and footer", () => {
    renderMissing();
    expect(
      screen.getByRole('heading', { level: 1, name: "We can't find this page" }),
    ).toBeDefined();
    expect(screen.getByText('404 · Off course')).toBeDefined();
    expect(screen.queryByTestId('site-header')).toBeNull();
    expect(screen.queryByTestId('site-footer')).toBeNull();
    expect(document.title).toBe('Page Not Found | Navigate Wealth');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });

  it('signed out, the way forward is Log in', () => {
    renderMissing();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Log in' }));
    expect(screen.getByTestId('where').textContent).toBe('/login');
  });

  it("signed in, the way forward is the user's portal", () => {
    state.auth = { isAuthenticated: true, user: { id: 'u1' } };
    renderMissing();
    fireEvent.click(screen.getByRole('button', { name: 'Go to my portal' }));
    expect(getAuthenticatedRedirectPath).toHaveBeenCalledWith({ id: 'u1' });
    expect(screen.getByTestId('where').textContent).toBe('/dashboard');
  });

  it('in a browser, the website 404 and chrome are unchanged', async () => {
    state.standalone = false;
    renderMissing();
    expect(await screen.findByTestId('site-header')).toBeDefined();
    expect(await screen.findByRole('heading', { name: 'Website 404' })).toBeDefined();
    expect(screen.queryByText('404 · Off course')).toBeNull();
  });
});
