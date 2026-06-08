/**
 * Tests for runtimeIssueReporter.
 * Covers runtimeIssueFromUnknown (pure) and reportRuntimeClientIssue (async, fetch-based).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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

import { runtimeIssueFromUnknown, reportRuntimeClientIssue } from '../runtimeIssueReporter';

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
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fetch when session has no access token', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await reportRuntimeClientIssue({ kind: 'window-error', message: 'test' });
    expect(fetchSpy).not.toHaveBeenCalled();
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
