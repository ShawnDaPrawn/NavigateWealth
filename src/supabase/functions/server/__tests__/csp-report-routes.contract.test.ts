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
 * 3. **Concurrent reports must not overwrite each other.** The first version
 *    kept one array under one key and did read-modify-write on it. CSP reports
 *    arrive in BURSTS — a policy change lands and every visitor's browser
 *    reports at once — so two handlers read the same array and the later `set`
 *    discarded the other's violation outright. Storage is one row per
 *    fingerprint now.
 *
 * 4. **The strongest disposition sticks.** Both the enforced and report-only
 *    headers carry `object-src`, `base-uri`, `form-action` and
 *    `frame-ancestors`, and both report here, so one browser event can produce
 *    an `enforce` report and a `report` report for the same fingerprint. Taking
 *    the latest let the report-only copy downgrade a resource that was actually
 *    BLOCKED from error to warning.
 *
 * 5. **Both wire formats.** `report-uri` sends a single hyphenated
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
const { CSP_VIOLATION_KEY_PREFIX, MAX_CSP_VIOLATION_ISSUES } =
  await import('../quality-issues-normalize.ts');
const { CSP_REPORT_IP_LIMIT_PER_HOUR } = await import('../public-form-rate-limit.ts');

/** The signer token shape, and a value distinctive enough to grep the store for. */
const SIGNER_TOKEN = 'a1b2c3d4-dead-4beef-8000-feedfacecafe';

/** Post one violation with a distinct blocked URL from a chosen client IP. */
function postFromIp(blockedUri: string, ip: string) {
  return app.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report', 'CF-Connecting-IP': ip },
    body: JSON.stringify(legacy({ 'blocked-uri': blockedUri })),
  });
}

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

/** Every per-fingerprint row currently in the store. */
function stored(): Record<string, unknown>[] {
  return [...kvStore.entries()]
    .filter(([k]) => k.startsWith(CSP_VIOLATION_KEY_PREFIX))
    .map(([, v]) => v as Record<string, unknown>);
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

  it('caps stored violations, evicting the least recently seen', async () => {
    for (let i = 0; i < MAX_CSP_VIOLATION_ISSUES; i++) {
      kvStore.set(`${CSP_VIOLATION_KEY_PREFIX}seed-${i}`, {
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
        // seed-0 is the oldest, so it is the one that should go.
        firstSeenAt: '2020-01-01T00:00:00.000Z',
        lastSeenAt: `2020-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`,
        occurrences: 1,
      });
    }

    await post(legacy());

    expect(stored()).toHaveLength(MAX_CSP_VIOLATION_ISSUES);
    // The new violation survived; an old one was evicted, not the new one.
    expect(JSON.stringify(stored())).toContain('evil.example.com');
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

describe('concurrent reports do not overwrite each other', () => {
  it('keeps every distinct violation from a simultaneous burst', async () => {
    // The failure the shared-array version had: N handlers read the same array,
    // each appends its own, and the last `set` wins — N-1 findings vanish. This
    // is not a contrived race; a policy change lands and every visitor's browser
    // reports within the same second.
    const directives = ['script-src', 'img-src', 'connect-src', 'frame-src', 'font-src'];

    await Promise.all(
      directives.map((d) =>
        post(legacy({ 'effective-directive': d, 'blocked-uri': `https://x.example/${d}` })),
      ),
    );

    const titles = stored().map((i) => String(i.title));
    expect(titles).toHaveLength(directives.length);
    for (const d of directives) {
      expect(
        titles.some((t) => t.includes(d)),
        `${d} was lost`,
      ).toBe(true);
    }
  });

  it('stores one row per fingerprint rather than one shared array', async () => {
    await post(legacy({ 'effective-directive': 'script-src' }));
    await post(legacy({ 'effective-directive': 'img-src' }));

    const keys = [...kvStore.keys()].filter((k) => k.startsWith(CSP_VIOLATION_KEY_PREFIX));
    expect(keys).toHaveLength(2);
  });
});

describe('the strongest disposition sticks', () => {
  // `object-src`, `base-uri`, `form-action` and `frame-ancestors` are in BOTH
  // the enforced and the report-only header, and both report to this endpoint.
  // So one browser event yields two reports sharing a fingerprint.
  const bothPolicies = {
    'effective-directive': 'form-action',
    'blocked-uri': 'https://evil.example.com/post',
  };

  it('is not downgraded when the report-only copy arrives last', async () => {
    await post(legacy({ ...bothPolicies, disposition: 'enforce' }));
    await post(legacy({ ...bothPolicies, disposition: 'report' }));

    const issue = stored()[0];
    expect(issue.severity, 'a resource that was actually blocked must stay an error').toBe('error');
    expect(issue.priority).toBe('high');
  });

  it('upgrades when the enforced copy arrives last', async () => {
    await post(legacy({ ...bothPolicies, disposition: 'report' }));
    await post(legacy({ ...bothPolicies, disposition: 'enforce' }));

    expect(stored()[0].severity).toBe('error');
  });

  it('records the sticky disposition in the message, not the last one seen', async () => {
    await post(legacy({ ...bothPolicies, disposition: 'enforce' }));
    await post(legacy({ ...bothPolicies, disposition: 'report' }));

    expect(String(stored()[0].message)).toContain('Disposition: enforce');
  });

  it('leaves a genuinely report-only violation as a warning', async () => {
    await post(legacy({ 'effective-directive': 'img-src', disposition: 'report' }));

    expect(stored()[0].severity).toBe('warning');
  });

  it('keeps firstSeenAt from the original record while counting both', async () => {
    await post(legacy(bothPolicies));
    await post(legacy(bothPolicies));

    const issue = stored()[0];
    expect(issue.occurrences).toBe(2);
    expect(issue.firstSeenAt).toBeTruthy();
  });
});

describe('an anonymous caller is rate limited', () => {
  it('stops writing once the per-IP budget is spent', async () => {
    // The caps bound what is KEPT; they say nothing about how often someone can
    // arrive, and every request otherwise costs a KV read, a KV write and a log
    // line. Each request here carries a distinct blocked URL, so without a
    // frequency limit each would create a row.
    const attempts = CSP_REPORT_IP_LIMIT_PER_HOUR + 25;
    for (let i = 0; i < attempts; i++) {
      await postFromIp(`https://flood.example/${i}.js`, '198.51.100.7');
    }

    expect(stored().length).toBeLessThanOrEqual(CSP_REPORT_IP_LIMIT_PER_HOUR);
  });

  it('still answers 204 when limited, so a prober learns nothing', async () => {
    for (let i = 0; i < CSP_REPORT_IP_LIMIT_PER_HOUR + 5; i++) {
      await postFromIp(`https://flood.example/${i}.js`, '198.51.100.8');
    }
    const res = await postFromIp('https://flood.example/final.js', '198.51.100.8');

    expect(res.status).toBe(204);
  });

  it('limits per IP, so one abuser cannot silence everyone else', async () => {
    for (let i = 0; i < CSP_REPORT_IP_LIMIT_PER_HOUR + 5; i++) {
      await postFromIp(`https://flood.example/${i}.js`, '198.51.100.9');
    }
    const before = stored().length;

    await postFromIp('https://real.example/legit.js', '203.0.113.42');

    expect(stored().length).toBe(before + 1);
  });
});

/**
 * The wire format a real browser actually sends.
 * =============================================
 *
 * The fixture above it is hand-written, and was never checked against a
 * browser: it carries four body fields where Chromium sends ten, and omits
 * `originalPolicy` entirely — which is the longest field in the payload and the
 * one most likely to breach a length cap.
 *
 * This payload was captured on 2026-08-29 from Chromium 141 (headless), served
 * the exact `Content-Security-Policy-Report-Only` value from `vercel.json` over
 * TLS with the report targets pointed at a local collector, and provoked with
 * an inline script whose hash is not in `script-src`. It is pasted verbatim,
 * 127.0.0.1 origins and all, because the point is that it is not idealised.
 *
 * This settles half of what the archived readiness ledger
 * (docs/archive/production-readiness-ledger-2026.md) records as unproven. That
 * note says "Headless Chromium emitted no reports to the collector even over
 * TLS on a same-origin endpoint" — it does emit, as `application/reports+json`
 * via the Reporting API rather than the legacy `application/csp-report`, which
 * is likely what the earlier attempt was watching for. What remains unproven is
 * only the network path to the production collector, which cannot be exercised
 * from CI.
 */
describe('a payload captured from a real browser', () => {
  const CHROMIUM_141_REPORT = {
    age: 4,
    body: {
      blockedURL: 'inline',
      disposition: 'report',
      documentURL: 'https://127.0.0.1:8443/',
      effectiveDirective: 'script-src-elem',
      lineNumber: 3,
      originalPolicy:
        "default-src 'self'; script-src 'self' 'sha256-Jj3ObkLk3lDlnCnEMUyMIwHL7ENmhfvZh+4B1o/cD5k=' 'sha256-Mk1XlGRAuKNssIileLzg826paEfnzQPxho4GLQtkJwQ=' https://www.googletagmanager.com https://s3.tradingview.com https://www.tradingview.com https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://images.unsplash.com https://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://s.tradingview.com https://www.tradingview.com; worker-src 'self' blob:; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; report-uri https://127.0.0.1:8443/csp-report; report-to csp-endpoint",
      referrer: '',
      sample: '',
      sourceFile: 'https://127.0.0.1:8443/',
      statusCode: 200,
    },
    type: 'csp-violation',
    url: 'https://127.0.0.1:8443/',
    user_agent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
  };

  it('accepts the exact shape Chromium sends, not an idealised one', async () => {
    const res = await post([CHROMIUM_141_REPORT], 'application/reports+json');

    expect(res.status).toBe(204);
    expect(stored()).toHaveLength(1);

    const raw = JSON.stringify(stored());
    expect(raw).toContain('script-src-elem');
    expect(raw).toContain('inline');
  });

  it('does not choke on the fields the hand-written fixture omits', () => {
    // Guards the fixture itself: if a future edit trims this back down to the
    // four convenient fields, the thing it exists to prove is gone.
    const body = CHROMIUM_141_REPORT.body as Record<string, unknown>;
    for (const field of [
      'blockedURL',
      'disposition',
      'documentURL',
      'effectiveDirective',
      'lineNumber',
      'originalPolicy',
      'referrer',
      'sample',
      'sourceFile',
      'statusCode',
    ]) {
      expect(body, `real Chromium sends ${field}`).toHaveProperty(field);
    }
    expect((body.originalPolicy as string).length).toBeGreaterThan(1000);
  });
});
