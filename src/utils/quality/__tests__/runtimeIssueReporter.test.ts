/**
 * Tests for runtimeIssueReporter.
 * Covers runtimeIssueFromUnknown (pure) and reportRuntimeClientIssue (async, fetch-based).
 */

import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();

vi.mock('../../supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

vi.mock('../../supabase/info', () => ({
  supabaseUrl: 'https://project.supabase.co',
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  __resetRuntimeIssueReporterForTests,
  addBreadcrumb,
  installRuntimeIssueCapture,
  markErrorReported,
  reportHandledError,
  reportRuntimeClientIssue,
  runtimeIssueFromUnknown,
} from '../runtimeIssueReporter';
import { logger } from '../../logger';

// ── runtimeIssueFromUnknown ───────────────────────────────────────────────────

describe('runtimeIssueFromUnknown', () => {
  it('extracts message from Error', () => {
    const result = runtimeIssueFromUnknown('window-error', new Error('something broke'));
    expect(result.message).toBe('something broke');
  });

  it('extracts name from Error', () => {
    const err = new TypeError('type mismatch');
    const result = runtimeIssueFromUnknown('window-error', err);
    expect(result.title).toBe('TypeError');
  });

  it('extracts stack from Error', () => {
    const err = new Error('with stack');
    const result = runtimeIssueFromUnknown('unhandled-rejection', err);
    expect(result.stack).toContain('Error');
  });

  it('preserves the kind for Error input', () => {
    const result = runtimeIssueFromUnknown('react-error-boundary', new Error('oops'));
    expect(result.kind).toBe('react-error-boundary');
  });

  it('handles string reason', () => {
    const result = runtimeIssueFromUnknown('window-error', 'script error');
    expect(result.message).toBe('script error');
    expect(result.title).toBe('Runtime error');
  });

  it('handles object reason via JSON.stringify', () => {
    const result = runtimeIssueFromUnknown('window-error', { code: 42 });
    expect(result.message).toContain('42');
  });

  it('handles null reason gracefully', () => {
    const result = runtimeIssueFromUnknown('window-error', null);
    expect(result.message).toBeDefined();
  });

  it('uses fallback title when Error.name is empty', () => {
    const err = new Error('msg');
    Object.defineProperty(err, 'name', { value: '' });
    const result = runtimeIssueFromUnknown('window-error', err);
    expect(result.title).toBe('Runtime error');
  });
});

// ── reportRuntimeClientIssue ──────────────────────────────────────────────────

describe('reportRuntimeClientIssue', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetRuntimeIssueReporterForTests();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports through the public endpoint when nobody is signed in', async () => {
    // Signed-out errors (login page, public site, signer flow) used to be
    // dropped here. They now go to the rate-limited public ingest.
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await reportRuntimeClientIssue({ kind: 'window-error', message: 'signed-out-test' });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/quality-issues\/runtime-client\/public$/);
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('sends the breadcrumbs collected so far', async () => {
    addBreadcrumb('click button "Save"');
    await reportRuntimeClientIssue({ kind: 'window-error', message: 'breadcrumb-test' });
    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.breadcrumbs.at(-1)).toContain('click button "Save"');
  });

  it('calls fetch with POST when session is valid', async () => {
    await reportRuntimeClientIssue({
      kind: 'window-error',
      message: 'unique-post-test',
      title: 'Error',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('quality-issues/runtime-client'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('includes Authorization header with access token', async () => {
    await reportRuntimeClientIssue({ kind: 'window-error', message: 'unique-auth-test' });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    const opts = callArgs[1];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123');
  });

  it('does not throw when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    await expect(
      reportRuntimeClientIssue({ kind: 'window-error', message: 'unique-fail-test' }),
    ).resolves.toBeUndefined();
  });
});

// ── Handled errors ────────────────────────────────────────────────────────────

describe('reportHandledError', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetRuntimeIssueReporterForTests();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sentBodies = async () => {
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    return fetchSpy.mock.calls.map((call: unknown[]) =>
      JSON.parse(((call as unknown as [string, RequestInit])[1].body as string) || '{}'),
    );
  };

  it('sends a warning headlined by the developer’s description', async () => {
    reportHandledError('Failed to load client policies', new Error('Server returned 500'));
    const [body] = await sentBodies();
    expect(body).toMatchObject({
      kind: 'handled-error',
      context: 'Failed to load client policies',
      message: 'Server returned 500',
      severity: 'warning',
    });
  });

  it('reads the message out of a plain Supabase error object', async () => {
    reportHandledError('Failed to save client', {
      message: 'duplicate key value violates unique constraint "clients_email_key"',
      code: '23505',
      details: 'Key (email) already exists.',
    });
    const [body] = await sentBodies();
    expect(body.title).toBe('Error 23505');
    expect(body.message).toBe(
      'duplicate key value violates unique constraint "clients_email_key": Key (email) already exists.',
    );
  });

  it('does not report the same error object twice', async () => {
    const error = new Error('once');
    markErrorReported(error);
    reportHandledError('ctx', error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips expected failures: aborts and expired sessions', async () => {
    reportHandledError('aborted', Object.assign(new Error('x'), { name: 'AbortError' }));
    reportHandledError('expired', Object.assign(new Error('y'), { statusCode: 401 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── Global capture ────────────────────────────────────────────────────────────

describe('installRuntimeIssueCapture', () => {
  // Installed once for the file: it wraps window.fetch and console.error.
  const upstream = vi.fn<typeof fetch>();
  let reports: Array<Record<string, unknown>>;

  beforeAll(() => {
    window.fetch = ((...args: Parameters<typeof fetch>) => upstream(...args)) as typeof fetch;
    installRuntimeIssueCapture();
  });

  beforeEach(() => {
    __resetRuntimeIssueReporterForTests();
    reports = [];
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    upstream.mockReset();
    upstream.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/quality-issues/runtime-client')) {
        reports.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 200 });
    });
  });

  const API = 'https://project.supabase.co/functions/v1/make-server-91ed8379';

  it('reports a gateway 5xx the function never saw (no x-request-id)', async () => {
    upstream.mockImplementationOnce(async () => new Response('upstream timeout', { status: 504 }));
    const res = await window.fetch(`${API}/clients/12/policies?x=1`);
    expect(res.status).toBe(504);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]).toMatchObject({
      kind: 'api-failure',
      method: 'GET',
      path: '/clients/12/policies',
      statusCode: 504,
    });
  });

  it('leaves 5xx answers from our own function to the server-side recorder', async () => {
    upstream.mockImplementationOnce(
      async () => new Response('{}', { status: 500, headers: { 'x-request-id': 'abc12345' } }),
    );
    await window.fetch(`${API}/tasks`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(reports).toHaveLength(0);
  });

  it('records API calls as breadcrumbs without their query strings', async () => {
    await window.fetch(`${API}/esign/verify?token=secret-token-value`);
    upstream.mockImplementationOnce(async () => new Response('', { status: 502 }));
    await window.fetch(`${API}/boom`);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    const crumbs = (reports[0].breadcrumbs as string[]).join('\n');
    expect(crumbs).toContain('api GET /esign/verify → 200');
    expect(crumbs).not.toContain('secret-token-value');
  });

  it('forwards logger.error to the dashboard', async () => {
    logger.error('Failed to save note', new Error('constraint violated'));
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]).toMatchObject({
      kind: 'handled-error',
      context: 'Failed to save note',
      message: 'constraint violated',
    });
  });

  it('captures an Error passed to console.error, with its description', async () => {
    console.error('Error loading documents:', new TypeError('docs.map is not a function'));
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]).toMatchObject({
      kind: 'handled-error',
      context: 'Error loading documents',
      message: 'docs.map is not a function',
    });
  });
});
