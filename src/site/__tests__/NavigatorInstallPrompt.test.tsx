/**
 * The "Get the Navigate Wealth app" prompt in the Navigator design, reached
 * the way production reaches it: MainLayout mounts InstallAppPrompt, whose
 * design switch hands the banner, toast and sheet to NavigatorInstallPrompt.
 * Covers what the redesign must not change — the same trigger
 * (beforeinstallprompt on Home, Log in and Sign up only), the same storage
 * keys, the same toasts and the manual "Add to Home Screen" fallback — and
 * that the legacy design keeps the old look.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

let design: 'navigator' | 'legacy' = 'navigator';
vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return design;
  },
  resolveSiteDesign: () => design,
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The hook runs for real; a test can swap in its own result to reach the
// branch where Install finds no deferred prompt (the manual-steps sheet).
type PWAInstall = typeof import('../../hooks/usePWAInstall');
let hookOverride: (() => ReturnType<PWAInstall['usePWAInstall']>) | null = null;
vi.mock('../../hooks/usePWAInstall', async (importOriginal) => {
  const real = await importOriginal<PWAInstall>();
  return {
    usePWAInstall: () => (hookOverride ? hookOverride() : real.usePWAInstall()),
  };
});

const { InstallAppPrompt } = await import('../../components/pwa/InstallAppPrompt');

const DISMISS_KEY = 'nw-pwa-install-dismissed-session';
const INSTALLED_KEY = 'nw-pwa-installed';
const BANNER = 'Install the Navigate Wealth app';

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <InstallAppPrompt />
    </MemoryRouter>,
  );
}

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  let resolveChoice: (v: { outcome: string; platform: string }) => void = () => {};
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: new Promise((resolve) => {
      resolveChoice = resolve;
    }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, choose: () => resolveChoice({ outcome, platform: 'web' }) };
}

beforeEach(() => {
  design = 'navigator';
  hookOverride = null;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Navigator install prompt', () => {
  it('waits for beforeinstallprompt, then shows the board’s banner', async () => {
    renderAt('/');
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();

    firePrompt();
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });
    expect(banner.closest('.nw-site.nwip')).not.toBeNull();
    expect(within(banner).getByText('Get the Navigate Wealth app')).toBeTruthy();
    expect(
      within(banner).getByText('Install the client portal for quick, full-screen access.'),
    ).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Install' })).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Dismiss install prompt' })).toBeTruthy();
  });

  it('shows on Home, Log in and Sign up only', async () => {
    for (const path of ['/login', '/signup']) {
      const { unmount } = renderAt(path);
      firePrompt();
      expect(await screen.findByRole('region', { name: BANNER }, { timeout: 5000 })).toBeTruthy();
      unmount();
    }
    renderAt('/about');
    firePrompt();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
  });

  it('installs through the native prompt, with the live toasts, and remembers it', async () => {
    renderAt('/');
    const { event, choose } = firePrompt('accepted');
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });

    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    const status = screen.getByRole('status');
    await waitFor(() => expect(status.textContent).toBe('Preparing installation…'));

    await act(async () => {
      choose();
    });
    await waitFor(() => expect(status.textContent).toBe('Installing Navigate Wealth…'));
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
    expect(localStorage.getItem(INSTALLED_KEY)).toBe('true');
  });

  it('clears the success toast after sonner’s default four seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/');
    const { choose } = firePrompt('accepted');
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });
    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));
    await act(async () => {
      choose();
    });
    const status = screen.getByRole('status');
    await waitFor(() => expect(status.textContent).toBe('Installing Navigate Wealth…'));

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(screen.getByRole('status').textContent).toBe('Installing Navigate Wealth…');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Installing Navigate Wealth…')).toBeNull();
  });

  it('drops the spent prompt, without an installed flag, when the visitor declines', async () => {
    renderAt('/');
    const { choose } = firePrompt('dismissed');
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });
    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));
    await act(async () => {
      choose();
    });
    // The browser's prompt can be used once: with none left, the banner goes,
    // as the live one does, and nothing claims the app was installed.
    await waitFor(() => expect(screen.queryByRole('region', { name: BANNER })).toBeNull());
    expect(screen.queryByText('Installing Navigate Wealth…')).toBeNull();
    expect(localStorage.getItem(INSTALLED_KEY)).toBeNull();
  });

  it('dismisses for the session under the live storage key', async () => {
    const { unmount } = renderAt('/');
    firePrompt();
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });
    fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss install prompt' }));
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
    expect(sessionStorage.getItem(DISMISS_KEY)).toBe('true');
    unmount();

    renderAt('/');
    firePrompt();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
  });

  it('opens the "Add to Home Screen" steps when no native prompt is ready', async () => {
    hookOverride = () => ({
      isInstallable: true,
      isAppInstalled: false,
      isInstalling: false,
      showInstallOption: true,
      installApp: async () => null,
    });
    renderAt('/');
    const banner = await screen.findByRole('region', { name: BANNER }, { timeout: 5000 });
    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));

    const sheet = await screen.findByRole(
      'dialog',
      { name: 'Add to Home Screen' },
      { timeout: 5000 },
    );
    expect(sheet.closest('.nw-site.nwip')).not.toBeNull();
    expect(sheet.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      within(sheet).getByText(
        'Install Navigate Wealth on your device to open the client portal like a regular app.',
      ),
    ).toBeTruthy();
    const steps = within(sheet).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual([
      "01Tap the Share button in your browser's toolbar.",
      '02Scroll down and choose Add to Home Screen.',
    ]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('never shows once the app is installed', async () => {
    hookOverride = () => ({
      isInstallable: false,
      isAppInstalled: true,
      isInstalling: false,
      showInstallOption: false,
      installApp: async () => null,
    });
    renderAt('/');
    await act(async () => {});
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
  });

  it('keeps the old look in the legacy design', async () => {
    design = 'legacy';
    const { container } = renderAt('/');
    firePrompt();
    expect(await screen.findByText('Get the Navigate Wealth app')).toBeTruthy();
    expect(container.querySelector('.nwip-card, .nw-site')).toBeNull();
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
  });
});
