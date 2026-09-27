/**
 * A render crash must reach the Issues dashboard exactly once.
 *
 * ErrorBoundary both logs the crash (logger.error, which forwards to the issue
 * reporter as a handled error) and files its own richer react-error-boundary
 * report. Different kinds fingerprint differently, so unless the error is
 * marked before it is logged, every crash becomes two issues.
 *
 * Asserted at the network boundary: the reporter calls itself internally, so
 * mocking its export would not see the duplicate.
 *
 * Run: npx vitest run src/components/shared/__tests__/ErrorBoundary.reporting.test.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    },
  }),
}));

const { ErrorBoundary } = await import('../ErrorBoundary');
const { reportHandledError, __resetRuntimeIssueReporterForTests } =
  await import('../../../utils/quality/runtimeIssueReporter');
const { setLoggerErrorSink } = await import('../../../utils/logger');

function Crash(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'map')");
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetRuntimeIssueReporterForTests();
  setLoggerErrorSink((message, error) => reportHandledError(message, error));
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setLoggerErrorSink(null);
  vi.restoreAllMocks();
});

describe('ErrorBoundary reporting', () => {
  it('files one react-error-boundary report and no duplicate handled-error', async () => {
    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>,
    );

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));

    const kinds = fetchSpy.mock.calls.map(
      (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body)).kind,
    );
    expect(kinds).toEqual(['react-error-boundary']);
  });
});
