/**
 * POST /csp-report — the endpoint the browser reports policy violations to.
 * =========================================================================
 *
 * WHAT MATTERS HERE, IN ORDER
 *
 * 1. **It must not store a signer's credential.** A CSP report carries
 *    `document-uri` and `referrer`. The e-sign signer's URL is
 *    `/sign?token=…`, and that token IS the credential —
 *    `SignerLandingPage.tsx` already strips it from the address bar because it
 *    otherwise reaches browser history and the `Referer` header. A violation
 *    firing on that page before the strip completes hands the browser a report
 *    containing a live credential. Storing it would recreate, in the KV store,
 *    the exact leak that note exists to prevent. Every URL is therefore reduced
 *    to origin+path.
 *
 * 2. **It is unauthenticated, so it must be bounded.** The browser sends these
 *    itself, from public pages, with no app token — there is no way to guard
 *    it. What stops an anonymous caller filling the KV store is dedup by
 *    fingerprint, a hard cap, per-field length limits, and a cap on how many
 *    reports one body can carry.
 *
 * 3. **Both wire formats.** `report-uri` sends a single hyphenated
 *    `{"csp-report": {...}}`; the Reporting API sends an ARRAY of camelCase
 *    `{type, body}`. Safari and older Chrome use the first, current Chrome the
 *    second. Accepting one silently halves the evidence — which is the failure
 *    this endpoint was built to end, the report-only policy having named no
 *    endpoint at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test') },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { kvStore } = await import('./helpers/contract-harness.ts');
const app = (await import('../csp-report-routes.ts')).default;
const { CSP_VIOLATION_ISSUES_KEY, MAX_CSP_VIOLATION_ISSUES } =
  await import('../quality-issues-normalize.ts');

/** The signer token shape, and a value distinctive enough to grep the store for. */
const SIGNER_TOKEN = 'a1b2c3d4-dead-4beef-8000-feedfacecafe';

function post(body: unknown, contentType = 'application/csp-report') {
  return app.request('/', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function legacy(overrides: Record<string, unknown> = {}) {
  return {
    'csp-report': {
      'document-uri': 'https://www.navigatewealth.co/about',
      'effective-directive': 'script-src',
      'blocked-uri': 'https://evil.example.com/x.js',
      disposition: 'report',
      ...overrides,
    },
  };
}

function stored() {
  return (kvStore.get(CSP_VIOLATION_ISSUES_KEY) as unknown[] | undefined) ?? [];
}

beforeEach(() => {
  kvStore.clear();
});

describe('signer credentials never reach storage', () => {
  it('strips the query string from document-uri', async () => {
    await post(
      legacy({ 'document-uri': `https://www.navigatewealth.co/sign?token=${SIGNER_TOKEN}` }),
    );

    const raw = JSON.stringify(stored());
    expect(raw).not.toContain(SIGNER_TOKEN);
    expect(raw).not.toContain('token=');
    // The page itself is still recorded — the path is what makes the report useful.
    expect(raw).toContain('https://www.navigatewealth.co/sign');
  });

  it('strips it from blocked-uri and source-file too', async () => {
    await post(
      legacy({
        'blocked-uri': `https://third.example/collect?t=${SIGNER_TOKEN}`,
        'source-file': `https://www.navigatewealth.co/sign?token=${SIGNER_TOKEN}`,
      }),
    );

    expect(JSON.stringify(stored())).not.toContain(SIGNER_TOKEN);
  });

  it('strips the fragment as well as the query', async () => {
    await post(legacy({ 'document-uri': `https://www.navigatewealth.co/sign#${SIGNER_TOKEN}` }));

    expect(JSON.stringify(stored())).not.toContain(SIGNER_TOKEN);
  });

  it('keeps CSP sentinel values that are not URLs', async () => {
    // 'inline' and 'eval' are how CSP names a blocked inline script. They carry
    // nothing sensitive and losing them would make the report unreadable.
    await post(legacy({ 'blocked-uri': 'inline' }));

    expect(JSON.stringify(stored())).toContain('inline');
  });
});

describe('both wire formats are accepted', () => {
  it('accepts the legacy report-uri body', async () => {
    const res = await post(legacy());

    expect(res.status).toBe(204);
    expect(stored()).toHaveLength(1);
  });

  it('accepts a Reporting API array', async () => {
    const res = await post(
      [
        {
          type: 'csp-violation',
          url: 'https://www.navigatewealth.co/about',
          body: {
            documentURL: 'https://www.navigatewealth.co/about',
            effectiveDirective: 'img-src',
            blockedURL: 'https://i-invdn-com.investing.com/news.jpg',
            disposition: 'report',
          },
        },
      ],
      'application/reports+json',
    );

    expect(res.status).toBe(204);
    const raw = JSON.stringify(stored());
    expect(raw).toContain('img-src');
    expect(raw).toContain('i-invdn-com.investing.com');
  });

  it('ignores non-CSP reports in a Reporting API batch', async () => {
    await post(
      [
        { type: 'deprecation', body: { id: 'x' } },
        { type: 'intervention', body: { id: 'y' } },
      ],
      'application/reports+json',
    );

    expect(stored()).toHaveLength(0);
  });
});

describe('an anonymous caller cannot exhaust the store', () => {
  it('deduplicates by directive and blocked URL, not by page', async () => {
    // One blocked origin reached from many pages is ONE thing to fix. Forty
    // rows would push the real variety out of a capped list.
    for (const page of ['/about', '/team', '/services', '/contact']) {
      await post(legacy({ 'document-uri': `https://www.navigatewealth.co${page}` }));
    }

    const issues = stored() as { occurrences: number }[];
    expect(issues).toHaveLength(1);
    expect(issues[0].occurrences).toBe(4);
  });

  it('caps stored violations', async () => {
    const seed = Array.from({ length: MAX_CSP_VIOLATION_ISSUES }, (_, i) => ({
      id: `seed-${i}`,
      fingerprint: `seed-${i}`,
      source: 'audit',
      category: 'security',
      priority: 'medium',
      severity: 'warning',
      status: 'open',
      title: `seed ${i}`,
      message: '',
      filePath: 'browser',
      firstSeenAt: '2020-01-01T00:00:00.000Z',
      lastSeenAt: '2020-01-01T00:00:00.000Z',
      occurrences: 1,
    }));
    kvStore.set(CSP_VIOLATION_ISSUES_KEY, seed);

    await post(legacy());

    expect(stored()).toHaveLength(MAX_CSP_VIOLATION_ISSUES);
  });

  it('takes at most 20 reports from one body', async () => {
    const batch = Array.from({ length: 60 }, (_, i) => ({
      type: 'csp-violation',
      body: {
        documentURL: 'https://www.navigatewealth.co/',
        effectiveDirective: `directive-${i}`,
        blockedURL: `https://x${i}.example/a.js`,
        disposition: 'report',
      },
    }));

    await post(batch, 'application/reports+json');

    expect(stored().length).toBeLessThanOrEqual(20);
  });

  it('truncates long field values', async () => {
    await post(
      legacy({
        'blocked-uri': `https://evil.example.com/${'a'.repeat(5000)}`,
        'script-sample': 'b'.repeat(5000),
      }),
    );

    const raw = JSON.stringify(stored());
    expect(raw).not.toContain('a'.repeat(400));
    expect(raw).not.toContain('b'.repeat(200));
  });

  it('answers 204 to junk rather than 500', async () => {
    // A browser cannot act on an error and does not retry usefully; a non-2xx
    // would only make a violation look like an outage in the logs.
    for (const junk of ['not json at all', '[]', '{}', 'null', '{"csp-report":"a string"}']) {
      const res = await post(junk);
      expect(res.status, `body: ${junk}`).toBe(204);
    }
    expect(stored()).toHaveLength(0);
  });
});

describe('extension noise is discarded', () => {
  it.each([
    ['chrome-extension://abc/inject.js'],
    ['moz-extension://abc/inject.js'],
    ['safari-web-extension://abc/inject.js'],
  ])('drops a violation blocked on %s', async (blocked) => {
    // Extensions inject into every page and generate the bulk of real CSP
    // reports. None of it is ours to fix, and left in it buries what is.
    await post(legacy({ 'blocked-uri': blocked }));

    expect(stored()).toHaveLength(0);
  });

  it('still records a real violation from the same batch', async () => {
    await post(
      [
        {
          type: 'csp-violation',
          body: {
            documentURL: 'https://www.navigatewealth.co/',
            effectiveDirective: 'script-src',
            blockedURL: 'chrome-extension://abc/inject.js',
            disposition: 'report',
          },
        },
        {
          type: 'csp-violation',
          body: {
            documentURL: 'https://www.navigatewealth.co/',
            effectiveDirective: 'connect-src',
            blockedURL: 'https://real.example/beacon',
            disposition: 'report',
          },
        },
      ],
      'application/reports+json',
    );

    const issues = stored() as { title: string }[];
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('real.example');
  });
});

describe('severity tracks the policy that fired', () => {
  it('marks a report-only violation as a warning', async () => {
    await post(legacy({ disposition: 'report' }));

    expect((stored() as { severity: string }[])[0].severity).toBe('warning');
  });

  it('marks an enforced violation as an error', async () => {
    // Under the enforced policy the resource was actually blocked: something
    // on the page did not work for a real visitor.
    await post(legacy({ disposition: 'enforce' }));

    const issue = (stored() as { severity: string; priority: string }[])[0];
    expect(issue.severity).toBe('error');
    expect(issue.priority).toBe('high');
  });
});
