import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const mockNavigate = vi.fn();
let standalone = true;

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../utils/pwa/displayMode', () => ({
  isStandaloneDisplay: () => standalone,
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock('../../auth/RouteGuards', () => ({
  getAuthenticatedRedirectPath: () => '/dashboard',
}));

import { StandaloneRedirect } from '../StandaloneRedirect';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StandaloneRedirect />
    </MemoryRouter>,
  );
}

describe('StandaloneRedirect', () => {
  beforeEach(() => {
    standalone = true;
    mockNavigate.mockReset();
  });

  it('bounces a marketing route to the portal in standalone mode', () => {
    renderAt('/about');
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('bounces the resources listing to the portal in standalone mode', () => {
    renderAt('/resources');
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does NOT bounce an article link — it must open on the website', () => {
    renderAt('/resources/article/some-insight');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing in a normal browser tab', () => {
    standalone = false;
    renderAt('/about');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
