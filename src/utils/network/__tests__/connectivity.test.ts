import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { supabaseUrl } from '../../supabase/info';
import {
  __resetConnectivityForTests,
  checkConnectivityNow,
  getConnectivityStatus,
  installConnectivityMonitor,
  isNetworkFailure,
  subscribeConnectivity,
} from '../connectivity';

const API = `${supabaseUrl}/functions/v1/make-server-91ed8379/personnel/permissions/me`;
const PROBE = `${supabaseUrl}/auth/v1/health`;

/** Every fetch the monitor sees ends up here, probes included. */
const transport = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Network down for URLs matching `down`, answering 200 otherwise. */
function network({ down }: { down: (url: string) => boolean }) {
  transport.mockImplementation(async (input) => {
    if (down(urlOf(input))) throw new TypeError('Failed to fetch');
    return new Response('{}', { status: 200 });
  });
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

/** Let the probe's promise chain settle without advancing the backoff timers. */
async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

beforeAll(() => {
  window.fetch = transport as unknown as typeof fetch;
  installConnectivityMonitor();
});

beforeEach(() => {
  vi.useFakeTimers();
  transport.mockReset();
  __resetConnectivityForTests();
  onlineManager.setOnline(true);
  setNavigatorOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isNetworkFailure', () => {
  it('recognises the api client wrapper and each browser fetch() rejection', () => {
    expect(isNetworkFailure({ code: 'NETWORK_ERROR', statusCode: 0 })).toBe(true);
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    );
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true);
  });

  it('does not treat an answer from the server, or a code bug, as a network failure', () => {
    expect(isNetworkFailure({ code: 'FORBIDDEN', statusCode: 403 })).toBe(false);
    expect(
      isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe(false);
    expect(isNetworkFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
    expect(isNetworkFailure('Failed to fetch')).toBe(false);
  });
});

describe('connectivity monitor', () => {
  it('confirms a failed backend request with a probe before calling the tab unreachable', async () => {
    network({ down: () => true });

    await expect(window.fetch(API)).rejects.toThrow('Failed to fetch');
    await flush();

    expect(transport).toHaveBeenCalledWith(PROBE, expect.objectContaining({ mode: 'no-cors' }));
    // navigator.onLine is still true: the network is up, the internet is not.
    expect(getConnectivityStatus()).toBe('unreachable');
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('stays online when the probe gets through (one failed request is not an outage)', async () => {
    network({ down: (url) => url === API });

    await expect(window.fetch(API)).rejects.toThrow();
    await flush();

    expect(getConnectivityStatus()).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('keeps probing with backoff and recovers on its own when the internet returns', async () => {
    network({ down: () => true });
    await expect(window.fetch(API)).rejects.toThrow();
    await flush();
    expect(getConnectivityStatus()).toBe('unreachable');

    const probes = () => transport.mock.calls.filter(([input]) => urlOf(input) === PROBE).length;
    const before = probes();
    await vi.advanceTimersByTimeAsync(2000);
    expect(probes()).toBe(before + 1);
    expect(getConnectivityStatus()).toBe('unreachable');

    network({ down: () => false });
    await vi.advanceTimersByTimeAsync(4000);

    expect(getConnectivityStatus()).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('recovers at once when any backend request gets a response', async () => {
    network({ down: () => true });
    await expect(window.fetch(API)).rejects.toThrow();
    await flush();
    expect(getConnectivityStatus()).toBe('unreachable');

    network({ down: () => false });
    await window.fetch(API);

    expect(getConnectivityStatus()).toBe('online');
  });

  it('counts an error status as reachable — the server answered', async () => {
    transport.mockImplementation(async (input) => {
      if (urlOf(input) === PROBE) throw new TypeError('Failed to fetch');
      return new Response('{}', { status: 503 });
    });

    await window.fetch(API);
    await flush();

    expect(transport).not.toHaveBeenCalledWith(PROBE, expect.anything());
    expect(getConnectivityStatus()).toBe('online');
  });

  it('ignores aborted requests and requests to other hosts', async () => {
    transport.mockImplementation(async (input) => {
      if (urlOf(input) === API) throw new DOMException('aborted', 'AbortError');
      throw new TypeError('Failed to fetch');
    });

    await expect(window.fetch(API)).rejects.toThrow('aborted');
    await expect(window.fetch('https://www.googletagmanager.com/gtag/js')).rejects.toThrow();
    await flush();

    expect(transport).not.toHaveBeenCalledWith(PROBE, expect.anything());
    expect(getConnectivityStatus()).toBe('online');
  });

  it('reports offline on the browser event, and verifies before going back online', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConnectivity(listener);

    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));
    expect(getConnectivityStatus()).toBe('offline');
    expect(onlineManager.isOnline()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    // No probing while the browser has no network at all.
    await vi.advanceTimersByTimeAsync(30000);
    expect(transport).not.toHaveBeenCalled();

    network({ down: () => false });
    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(transport).toHaveBeenCalledWith(PROBE, expect.anything());
    expect(getConnectivityStatus()).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
    unsubscribe();
  });

  it('lands on unreachable when the network returns without the internet behind it', async () => {
    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));

    network({ down: () => true });
    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(getConnectivityStatus()).toBe('unreachable');
  });

  it('checkConnectivityNow probes on demand and reports the answer', async () => {
    network({ down: () => true });
    await expect(checkConnectivityNow()).resolves.toBe(false);
    expect(getConnectivityStatus()).toBe('unreachable');

    network({ down: () => false });
    await expect(checkConnectivityNow()).resolves.toBe(true);
    expect(getConnectivityStatus()).toBe('online');
  });

  it('shares one probe between concurrent failures', async () => {
    network({ down: () => true });

    await Promise.allSettled([window.fetch(API), window.fetch(API), window.fetch(API)]);
    await flush();

    expect(transport.mock.calls.filter(([input]) => urlOf(input) === PROBE)).toHaveLength(1);
  });
});
