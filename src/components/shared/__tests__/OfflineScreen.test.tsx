import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ConnectivityStatus } from '../../../utils/network/connectivity';

let mockStatus: ConnectivityStatus = 'online';
const mockCheckConnectivityNow = vi.fn<() => Promise<boolean>>();
const mockToastSuccess = vi.fn();

vi.mock('../../../hooks/useConnectivity', () => ({
  useConnectivity: () => mockStatus,
}));

vi.mock('../../../utils/network/connectivity', () => ({
  checkConnectivityNow: () => mockCheckConnectivityNow(),
}));

vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

import { OfflineScreen, OFFLINE_SCREEN_DELAY_MS } from '../OfflineScreen';

function renderApp(enabled?: boolean) {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  const view = render(<OfflineScreen enabled={enabled} />, { container: root });
  return { ...view, root };
}

function goOffline(rerender: (ui: React.ReactElement) => void, status: ConnectivityStatus) {
  mockStatus = status;
  rerender(<OfflineScreen />);
  act(() => {
    vi.advanceTimersByTime(OFFLINE_SCREEN_DELAY_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockStatus = 'online';
  mockCheckConnectivityNow.mockReset();
  mockToastSuccess.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  document.getElementById('root')?.remove();
});

describe('OfflineScreen', () => {
  it('renders nothing while connected', () => {
    renderApp();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('waits out a brief drop before taking over the screen', () => {
    const { rerender } = renderApp();
    mockStatus = 'offline';
    rerender(<OfflineScreen />);

    act(() => {
      vi.advanceTimersByTime(OFFLINE_SCREEN_DELAY_MS - 1);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    // Back before the delay ran out: never shown, nothing to announce.
    mockStatus = 'online';
    rerender(<OfflineScreen />);
    act(() => {
      vi.advanceTimersByTime(OFFLINE_SCREEN_DELAY_MS);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('explains a device with no network, and makes the page behind it inert', () => {
    const { rerender, root } = renderApp();
    goOffline(rerender, 'offline');

    const dialog = screen.getByRole('alertdialog', { name: "You're offline" });
    expect(dialog.textContent).toContain("Your device isn't connected to the internet");
    expect(root.hasAttribute('inert')).toBe(true);
    // Portalled out of the inert root, so it stays usable.
    expect(root.contains(dialog)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /try again/i }));
  });

  it('explains a network that cannot reach the internet', () => {
    const { rerender } = renderApp();
    goOffline(rerender, 'unreachable');

    expect(screen.getByRole('alertdialog', { name: "Can't reach Navigate Wealth" })).toBeTruthy();
  });

  it('suggests what to check for each kind of failure', () => {
    const { rerender } = renderApp();
    goOffline(rerender, 'offline');
    let tips = screen.getByRole('list', { name: /things to try/i });
    expect(tips.textContent).toMatch(/flight mode/i);
    expect(tips.textContent).not.toMatch(/router/i);

    mockStatus = 'unreachable';
    rerender(<OfflineScreen />);
    tips = screen.getByRole('list', { name: /things to try/i });
    expect(tips.textContent).toMatch(/router/i);
    expect(tips.textContent).not.toMatch(/flight mode/i);
  });

  it('tells the user the page behind it, and their work, is kept', () => {
    const { rerender } = renderApp();
    goOffline(rerender, 'offline');

    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Your work is safe.');
    expect(dialog.textContent).toContain('Keep this tab open');
    expect(screen.getByText(/reconnecting automatically/i)).toBeTruthy();
  });

  it('clears itself and says so once the connection is back', () => {
    const { rerender, root } = renderApp();
    goOffline(rerender, 'offline');

    mockStatus = 'online';
    rerender(<OfflineScreen />);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(root.hasAttribute('inert')).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("You're back online");
  });

  it('Try again reports when there is still no connection', async () => {
    mockCheckConnectivityNow.mockResolvedValue(false);
    const { rerender } = renderApp();
    goOffline(rerender, 'offline');

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('button', { name: /checking/i })).toBeTruthy();
    expect(mockCheckConnectivityNow).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Stamped with the time of the check, so a second failed tap visibly did something.
    const status = screen.getByText(/still no connection at/i);
    expect(status.querySelector('time')?.getAttribute('dateTime')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('stays out of the way when disabled', () => {
    mockStatus = 'offline';
    const { root } = renderApp(false);
    act(() => {
      vi.advanceTimersByTime(OFFLINE_SCREEN_DELAY_MS * 2);
    });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(root.hasAttribute('inert')).toBe(false);
  });
});
