/**
 * Tests for usePWAInstall hook.
 * Mocks window events (beforeinstallprompt, appinstalled), matchMedia,
 * and logger to verify state transitions.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMatchMedia(matches = false) {
  const listeners: (() => void)[] = [];
  return {
    matches,
    addEventListener: vi.fn((_type: string, cb: () => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    _trigger: () => listeners.forEach((cb) => cb()),
  };
}

function makeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: '' }),
    preventDefault: vi.fn(),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePWAInstall — initial state', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(false)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with isInstallable false', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstallable).toBe(false);
  });

  it('starts with isAppInstalled false when not standalone', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isAppInstalled).toBe(false);
  });

  it('starts with isInstalling false', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalling).toBe(false);
  });

  it('starts with showInstallOption false', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.showInstallOption).toBe(false);
  });
});

import { usePWAInstall } from '../usePWAInstall';

describe('usePWAInstall — beforeinstallprompt event', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(false)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets isInstallable true when beforeinstallprompt fires', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt());
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it('sets showInstallOption true when beforeinstallprompt fires', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt());
    });

    expect(result.current.showInstallOption).toBe(true);
  });
});

describe('usePWAInstall — appinstalled event', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(false)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets isAppInstalled true when appinstalled fires', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isAppInstalled).toBe(true);
  });

  it('clears isInstallable when appinstalled fires', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt());
    });
    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.showInstallOption).toBe(false);
  });
});

describe('usePWAInstall — already installed (standalone)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets isAppInstalled true when matchMedia shows standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(true)));
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isAppInstalled).toBe(true);
  });

  it('does not show showInstallOption when already installed', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(true)));
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.showInstallOption).toBe(false);
  });
});

describe('usePWAInstall — installApp', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMatchMedia(false)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when deferredPrompt is not set', async () => {
    const { result } = renderHook(() => usePWAInstall());
    const outcome = await result.current.installApp();
    expect(outcome).toBeNull();
  });

  it('returns accepted when user accepts the prompt', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt('accepted'));
    });

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.installApp();
    });

    expect(outcome).toBe('accepted');
  });

  it('returns dismissed when user dismisses the prompt', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt('dismissed'));
    });

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.installApp();
    });

    expect(outcome).toBe('dismissed');
  });

  it('sets isAppInstalled true when outcome is accepted', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt('accepted'));
    });
    await act(async () => {
      await result.current.installApp();
    });

    expect(result.current.isAppInstalled).toBe(true);
  });

  it('clears isInstalling after prompt resolves', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await act(async () => {
      window.dispatchEvent(makeInstallPrompt('accepted'));
    });
    await act(async () => {
      await result.current.installApp();
    });

    expect(result.current.isInstalling).toBe(false);
  });
});
