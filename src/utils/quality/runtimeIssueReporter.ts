/**
 * Browser runtime issue reporter
 * ==============================
 *
 * A deliberately small, in-house take on what Sentry's browser SDK does. It
 * reports to the quality-issues pipeline (admin → Issues) and captures:
 *
 *   - uncaught errors and unhandled promise rejections (wired in App.tsx);
 *   - React render crashes (ErrorBoundary);
 *   - HANDLED errors — anything passed to `logger.error(...)`, and any Error
 *     object passed to `console.error(...)`. Most failures in this app are
 *     caught, logged and turned into a toast; before this they never reached
 *     the dashboard even though the user saw them fail;
 *   - API failures the server cannot report itself: network failures and
 *     gateway 5xx responses (function crashed, timed out or out of memory) —
 *     recognisable because they lack our `x-request-id` header. 5xx answers
 *     our own function produced are recorded server-side, not here;
 *   - errors raised while SIGNED OUT (public site, login, e-sign signer),
 *     through a rate-limited public ingest route.
 *
 * Every report carries breadcrumbs — the last navigations, clicks and API
 * calls — so an issue says what the user was doing, not only what threw.
 *
 * Rule zero: reporting must never create a second failure. Everything here is
 * wrapped, rate-limited, and silent on error.
 */

import { supabaseUrl } from '../supabase/info';
import { createClient } from '../supabase/client';
import { setLoggerErrorSink } from '../logger';

const API_BASE = `${supabaseUrl}/functions/v1/make-server-91ed8379`;
const REPORT_ENDPOINT = `${API_BASE}/quality-issues/runtime-client`;
const PUBLIC_REPORT_ENDPOINT = `${REPORT_ENDPOINT}/public`;
const MAX_FIELD_LENGTH = 1600;
const SEND_DEBOUNCE_MS = 10000;
/** Hard ceiling per page load, so a render loop cannot flood the endpoint. */
const MAX_REPORTS_PER_MINUTE = 20;
const MAX_BREADCRUMBS = 20;

export type RuntimeIssueKind =
  | 'window-error'
  | 'unhandled-rejection'
  | 'react-error-boundary'
  | 'handled-error'
  | 'api-failure';

export interface RuntimeClientIssueInput {
  kind: RuntimeIssueKind;
  /** Error class name ("TypeError"). Kept as `title` for backwards compatibility. */
  title?: string;
  message: string;
  /** The developer's description, e.g. the first argument to logger.error. */
  context?: string;
  severity?: 'error' | 'warning';
  stack?: string;
  componentStack?: string;
  filePath?: string;
  line?: number;
  column?: number;
  /** For api-failure: the request that failed. */
  method?: string;
  path?: string;
  statusCode?: number;
}

// ----------------------------------------------------------------------------
// Dedupe and rate limit
// ----------------------------------------------------------------------------

/** The un-instrumented fetch, so reports never feed back into the capture. */
let nativeFetch: typeof fetch = (...args) => fetch(...args);

const recentlySent = new Map<string, number>();
let windowStartedAt = 0;
let sentInWindow = 0;

/** Errors already reported by one capture path, so another does not repeat them. */
const reportedErrors = new WeakSet<object>();

export function markErrorReported(error: unknown): void {
  if (error && typeof error === 'object') reportedErrors.add(error);
}

function wasErrorReported(error: unknown): boolean {
  return !!error && typeof error === 'object' && reportedErrors.has(error);
}

function truncate(value: string | undefined, maxLength = MAX_FIELD_LENGTH): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function shouldSend(issue: RuntimeClientIssueInput): boolean {
  const key = [
    issue.kind,
    issue.context,
    issue.message,
    issue.filePath || window.location.pathname,
    issue.line,
    issue.column,
  ].join(':');
  const now = Date.now();
  const lastSentAt = recentlySent.get(key) || 0;

  if (now - lastSentAt < SEND_DEBOUNCE_MS) {
    return false;
  }

  if (now - windowStartedAt > 60000) {
    windowStartedAt = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_REPORTS_PER_MINUTE) {
    return false;
  }

  sentInWindow += 1;
  recentlySent.set(key, now);
  return true;
}

// ----------------------------------------------------------------------------
// Breadcrumbs
// ----------------------------------------------------------------------------

const breadcrumbs: string[] = [];

/** Path plus the params that name a screen; never the rest of the query. */
function screenPath(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    const module = url.searchParams.get('module');
    return `${url.pathname}${module ? `?module=${module}` : ''}`;
  } catch {
    return href.split(/[?#]/)[0];
  }
}

export function addBreadcrumb(entry: string): void {
  const time = new Date().toISOString().slice(11, 19);
  breadcrumbs.push(`${time} ${entry}`.slice(0, 200));
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

export function getBreadcrumbs(): string[] {
  return [...breadcrumbs];
}

/** Test seam. */
export function __resetRuntimeIssueReporterForTests(): void {
  breadcrumbs.length = 0;
  recentlySent.clear();
  windowStartedAt = 0;
  sentInWindow = 0;
}

// ----------------------------------------------------------------------------
// Sending
// ----------------------------------------------------------------------------

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value || {}));
  } catch {
    return String(value);
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function reportRuntimeClientIssue(issue: RuntimeClientIssueInput): Promise<void> {
  if (typeof window === 'undefined' || !shouldSend(issue)) {
    return;
  }

  try {
    const accessToken = await getAccessToken();
    const endpoint = accessToken ? REPORT_ENDPOINT : PUBLIC_REPORT_ENDPOINT;

    await nativeFetch(endpoint, {
      method: 'POST',
      // Signed out: no bearer at all. The public route is unauthenticated by
      // design, and the anon key is not a credential (see the anon-key ratchet).
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        kind: issue.kind,
        title: truncate(issue.title, 240),
        errorName: truncate(issue.title, 120),
        message: truncate(issue.message),
        context: truncate(issue.context, 240),
        severity: issue.severity,
        stack: truncate(issue.stack, 3000),
        componentStack: truncate(issue.componentStack, 3000),
        filePath: truncate(issue.filePath || window.location.pathname, 240),
        line: issue.line,
        column: issue.column,
        method: issue.method,
        path: truncate(issue.path, 400),
        statusCode: issue.statusCode,
        href: truncate(window.location.href, 500),
        userAgent: truncate(window.navigator.userAgent, 500),
        breadcrumbs: getBreadcrumbs(),
      }),
      keepalive: true,
    });
  } catch {
    // Runtime reporting must never create a second user-facing failure.
  }
}

export function runtimeIssueFromUnknown(
  kind: RuntimeIssueKind,
  reason: unknown,
): RuntimeClientIssueInput {
  if (reason instanceof Error) {
    markErrorReported(reason);
    return {
      kind,
      title: reason.name || 'Runtime error',
      message: reason.message || 'Unhandled runtime error',
      stack: reason.stack,
    };
  }

  const message = stringifyUnknown(reason);

  return {
    kind,
    title: 'Runtime error',
    message: message || 'Unhandled runtime error',
  };
}

// ----------------------------------------------------------------------------
// Handled errors (logger.error / console.error)
// ----------------------------------------------------------------------------

/** Errors that are expected in normal use and not worth an issue. */
function isExpectedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, statusCode, status } = error as {
    name?: string;
    statusCode?: number;
    status?: number;
  };
  if (name === 'AbortError') return true;
  // Session expiry is handled by the auth layer and self-heals on re-login.
  return statusCode === 401 || status === 401;
}

function describeContext(parts: unknown[]): string | undefined {
  const text = parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .replace(/%[sdoOc]/g, '')
    .replace(/[:\s]+$/, '')
    .trim();
  return text ? text.slice(0, 200) : undefined;
}

/**
 * Report a caught error. `context` is the developer's own description and
 * becomes the issue's headline, which is why it matters so much for labels.
 */
export function reportHandledError(context: string | undefined, error: unknown): void {
  if (wasErrorReported(error) || isExpectedError(error)) return;
  if (!(error instanceof Error) && !context) return;
  markErrorReported(error);

  // Supabase/PostgREST errors are plain objects ({ message, code, details }),
  // not Error instances; read their message rather than dumping JSON.
  const plain =
    error && typeof error === 'object' && !(error instanceof Error)
      ? (error as { message?: unknown; code?: unknown; details?: unknown; name?: unknown })
      : null;
  const plainMessage =
    plain && typeof plain.message === 'string' && plain.message
      ? [plain.message, typeof plain.details === 'string' ? plain.details : '']
          .filter(Boolean)
          .join(': ')
      : undefined;
  const base =
    error instanceof Error
      ? runtimeIssueFromUnknown('handled-error', error)
      : {
          kind: 'handled-error' as const,
          title:
            typeof plain?.name === 'string'
              ? plain.name
              : typeof plain?.code === 'string'
                ? `Error ${plain.code}`
                : 'Handled error',
          message:
            plainMessage ??
            (error === undefined ? context || 'Handled error' : stringifyUnknown(error)),
        };
  const statusCode =
    error && typeof error === 'object'
      ? ((error as { statusCode?: unknown }).statusCode as number | undefined)
      : undefined;

  void reportRuntimeClientIssue({
    ...base,
    kind: 'handled-error',
    context,
    severity: 'warning',
    statusCode: typeof statusCode === 'number' ? statusCode : undefined,
  });
}

// ----------------------------------------------------------------------------
// Installation
// ----------------------------------------------------------------------------

let installed = false;

function describeClickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest(
    'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"]',
  );
  if (!element) return null;
  const label =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    (element.textContent || '').replace(/\s+/g, ' ').trim();
  const role = element.getAttribute('role') || element.tagName.toLowerCase();
  return `click ${role} "${label.slice(0, 40)}"`;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

/** Our function, Supabase REST, or Supabase Storage — the backends we own. */
function backendPath(url: string): string | null {
  if (url.startsWith(API_BASE)) return url.slice(API_BASE.length).split(/[?#]/)[0] || '/';
  if (url.startsWith(supabaseUrl)) {
    const path = url.slice(supabaseUrl.length).split(/[?#]/)[0];
    if (/^\/(rest|storage)\/v1\//.test(path)) return path;
  }
  return null;
}

function instrumentFetch(): void {
  const original = window.fetch.bind(window);
  nativeFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url.startsWith(REPORT_ENDPOINT)) return original(input, init);
    const path = backendPath(url);
    if (!path) return original(input, init);

    const method = requestMethod(input, init);
    try {
      const response = await original(input, init);
      addBreadcrumb(`api ${method} ${path} → ${response.status}`);
      // A 5xx WITHOUT our request id was produced by the platform in front of
      // the function (crash, timeout, out of memory) — the server never saw it.
      const fromOurFunction = response.headers.get('x-request-id') !== null;
      if (response.status >= 500 && !fromOurFunction) {
        void reportRuntimeClientIssue({
          kind: 'api-failure',
          title: `HTTP ${response.status}`,
          message: `${method} ${path} returned ${response.status} ${response.statusText}`.trim(),
          method,
          path,
          statusCode: response.status,
        });
      }
      return response;
    } catch (error) {
      addBreadcrumb(`api ${method} ${path} → network error`);
      const aborted = error instanceof Error && error.name === 'AbortError';
      if (!aborted && navigator.onLine !== false) {
        markErrorReported(error);
        void reportRuntimeClientIssue({
          kind: 'api-failure',
          title: error instanceof Error ? error.name : 'NetworkError',
          message: error instanceof Error ? error.message : 'Network request failed',
          method,
          path,
        });
      }
      throw error;
    }
  };
}

function instrumentNavigation(): void {
  const record = () => addBreadcrumb(`navigate ${screenPath(window.location.href)}`);
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      const result = original(...args);
      try {
        record();
      } catch {
        // never break navigation
      }
      return result;
    };
  }
  window.addEventListener('popstate', record);
  record();
}

function instrumentConsole(): void {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const error = args.find((arg) => arg instanceof Error);
      if (!error) {
        // logger.ts prints JSON lines in production; keep only their message.
        const first = typeof args[0] === 'string' ? args[0] : '';
        if (first.startsWith('{"timestamp"')) {
          const parsed = JSON.parse(first) as { message?: string };
          if (parsed.message) addBreadcrumb(`log.error ${parsed.message.slice(0, 120)}`);
          return;
        }
        const text = describeContext(args);
        if (text) addBreadcrumb(`console.error ${text.slice(0, 120)}`);
        return;
      }
      const context = describeContext(args.filter((arg) => arg !== error));
      // Deferred one tick: React logs a caught render error BEFORE the error
      // boundary's componentDidCatch runs, and the boundary is the better
      // reporter (it has the component stack). By the next tick it has marked
      // the error, and this path skips it.
      setTimeout(() => reportHandledError(context, error), 0);
    } catch {
      // never break console.error
    }
  };
}

/**
 * Install the global capture. Idempotent; call once at app start. Window
 * error/rejection listeners stay in App.tsx, which owns the stale-chunk and
 * third-party filtering.
 */
export function installRuntimeIssueCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  try {
    instrumentFetch();
    instrumentNavigation();
    instrumentConsole();
    document.addEventListener(
      'click',
      (event) => {
        const label = describeClickTarget(event.target);
        if (label) addBreadcrumb(label);
      },
      { capture: true, passive: true },
    );
    setLoggerErrorSink((message, error) => reportHandledError(message, error));
  } catch {
    // Capture is best effort; the app must start regardless.
  }
}
