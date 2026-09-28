/**
 * Connectivity monitor
 * ====================
 *
 * Answers one question for the UI and for React Query: can this tab reach the
 * backend right now?
 *
 * Two different failures look identical to a user — nothing loads — and the
 * browser only reports one of them:
 *
 *   offline      the device has no network at all. `navigator.onLine` is
 *                false and the browser fires `offline` / `online`.
 *   unreachable  the device IS on a network, but nothing behind it answers:
 *                the Wi-Fi router is on a UPS through load-shedding while the
 *                line is down, an ISP outage, a captive portal. The browser
 *                still reports `navigator.onLine === true`, so this case is
 *                invisible to its own signal. It is inferred here from requests
 *                to our backend failing at the network level, and CONFIRMED by
 *                a probe before anything acts on it.
 *
 * React Query is driven from here through `onlineManager`, so while the tab is
 * disconnected queries and mutations pause instead of failing, and resume and
 * refetch the moment the connection is back. Out of the box React Query v5
 * assumes it is online at start-up and listens only to the browser events, so
 * a tab that opened without a connection never refetched once it returned —
 * and it never noticed the "unreachable" case at all.
 *
 * Rule zero, as for the other fetch wrappers installed in main.tsx: this must
 * never be the reason a request fails. Everything is best effort.
 */

import { onlineManager } from '@tanstack/react-query';
import { supabaseUrl } from '../supabase/info';

export type ConnectivityStatus = 'online' | 'offline' | 'unreachable';

/**
 * Any HTTP answer from this host proves the path works — a 401 included — so
 * the probe needs no credentials. `no-cors` means CORS can never make a
 * reachable server look unreachable: the response is opaque, but it resolves.
 */
const PROBE_URL = `${supabaseUrl}/auth/v1/health`;
const PROBE_TIMEOUT_MS = 8000;
/** Retry cadence while disconnected; the last value repeats. */
const PROBE_BACKOFF_MS = [2000, 4000, 8000, 15000];

let reachable = true;
let status: ConnectivityStatus = 'online';
const listeners = new Set<() => void>();

let nativeFetch: typeof fetch = (...args) => fetch(...args);
let probeInFlight: Promise<boolean> | null = null;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeAttempt = 0;
/** When a backend request last got ANY response. Lets a late probe failure lose to a fresh success. */
let lastResponseAt = 0;
let installed = false;

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------

function browserReportsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function computeStatus(): ConnectivityStatus {
  if (reachable) return 'online';
  return browserReportsOffline() ? 'offline' : 'unreachable';
}

function publish(): void {
  const next = computeStatus();
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others hearing about it.
    }
  });
}

export function getConnectivityStatus(): ConnectivityStatus {
  return status;
}

export function subscribeConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearProbeTimer(): void {
  if (probeTimer !== null) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
}

function markReachable(): void {
  lastResponseAt = Date.now();
  if (reachable) return;
  reachable = true;
  probeAttempt = 0;
  clearProbeTimer();
  publish();
}

function markUnreachable(): void {
  reachable = false;
  publish();
  scheduleProbe();
}

// ----------------------------------------------------------------------------
// Probing
// ----------------------------------------------------------------------------

function scheduleProbe(): void {
  clearProbeTimer();
  // With no network at all a probe cannot succeed; the browser's `online`
  // event is the cue to try again.
  if (browserReportsOffline()) return;
  const delay = PROBE_BACKOFF_MS[Math.min(probeAttempt, PROBE_BACKOFF_MS.length - 1)];
  probeAttempt += 1;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void probe();
  }, delay);
}

/** One reachability check. Concurrent callers share the request in flight. */
function probe(): Promise<boolean> {
  if (probeInFlight) return probeInFlight;

  probeInFlight = (async () => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await nativeFetch(PROBE_URL, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      markReachable();
      return true;
    } catch {
      // Another request got through while this one was failing: trust it.
      if (lastResponseAt > startedAt) {
        markReachable();
        return true;
      }
      markUnreachable();
      return false;
    } finally {
      clearTimeout(timeout);
      probeInFlight = null;
    }
  })();

  return probeInFlight;
}

/**
 * Check right now, for a "Try again" button. Probes even when the browser says
 * it is offline — `navigator.onLine` has false negatives, and the user asking
 * is reason enough to look. Resolves true when the backend answered.
 */
export function checkConnectivityNow(): Promise<boolean> {
  clearProbeTimer();
  return probe();
}

// ----------------------------------------------------------------------------
// Signals
// ----------------------------------------------------------------------------

/**
 * True for a failure where no response arrived at all, as opposed to the
 * server answering with an error. Covers the api client's wrapped form and
 * the raw TypeError each browser's fetch() rejects with.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code === 'NETWORK_ERROR') return true;
  return (
    error instanceof TypeError &&
    // Chromium, Firefox, Safari respectively.
    /failed to fetch|networkerror|load failed/i.test(error.message)
  );
}

function isAbortError(error: unknown): boolean {
  // A DOMException, which not every environment makes an Error subclass.
  return (
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function instrumentFetch(): void {
  const original = window.fetch.bind(window);
  nativeFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    try {
      url = requestUrl(input);
    } catch {
      return original(input, init);
    }
    if (!url.startsWith(supabaseUrl)) return original(input, init);

    try {
      const response = await original(input, init);
      markReachable();
      return response;
    } catch (error) {
      // One failed request is a hint, not a verdict — confirm it first.
      if (reachable && !isAbortError(error)) void probe();
      throw error;
    }
  };
}

function handleBrowserOffline(): void {
  // A real transition; React Query itself trusts this event.
  clearProbeTimer();
  reachable = false;
  publish();
}

function handleBrowserOnline(): void {
  // Having a network again does not mean the internet is behind it: confirm.
  if (!reachable) {
    probeAttempt = 0;
    void checkConnectivityNow();
  }
}

// ----------------------------------------------------------------------------
// Installation
// ----------------------------------------------------------------------------

/**
 * Install once at start-up, after the other fetch wrappers in main.tsx so it
 * sees requests as finally sent.
 */
export function installConnectivityMonitor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  try {
    instrumentFetch();
    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    // Replaces React Query's own online/offline listener with this monitor.
    onlineManager.setEventListener((setOnline) => {
      setOnline(status === 'online');
      return subscribeConnectivity(() => setOnline(getConnectivityStatus() === 'online'));
    });

    // React Query stopped trusting `navigator.onLine` at start-up because of
    // false negatives in Chromium, so neither does this: verify it instead.
    if (browserReportsOffline()) void probe();
  } catch {
    // Monitoring is best effort; the app must start regardless.
  }
}

/**
 * Test seam: back to a fresh, online state. Subscribers are kept — React
 * Query's is registered once at install. Not for app code.
 */
export function __resetConnectivityForTests(): void {
  clearProbeTimer();
  reachable = true;
  status = 'online';
  probeInFlight = null;
  probeAttempt = 0;
  lastResponseAt = 0;
}
