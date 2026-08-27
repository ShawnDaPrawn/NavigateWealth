/**
 * Content-Security-Policy violation collector.
 * ============================================
 *
 * WHY THIS EXISTS
 * ---------------
 * `vercel.json` ships a full resource policy as
 * `Content-Security-Policy-Report-Only` — and named no reporting endpoint. A
 * report-only policy with nowhere to report is evaluated by every visitor's
 * browser and then discarded. It has been collecting nothing since it shipped,
 * which matters because the plan for it is "probe, then promote": there was no
 * evidence being gathered to promote from.
 *
 * WHY IT IS UNAUTHENTICATED
 * -------------------------
 * It has to be. Violations happen on public marketing pages where the visitor
 * has no session, and the browser sends these itself — it will not attach an
 * app token. That makes this a public write endpoint, so everything below is
 * about bounding what an anonymous caller can do: no unbounded growth (dedup by
 * fingerprint, hard cap), no unbounded field sizes, and nothing stored that
 * would be worth stealing.
 *
 * WHY URLS ARE STRIPPED TO ORIGIN + PATH
 * --------------------------------------
 * This is the part that is not boilerplate. A CSP report carries `document-uri`
 * and `referrer`, and the e-sign signer's URL is `/sign?token=…` where the token
 * IS the signer's credential — SignerLandingPage.tsx already strips it from the
 * address bar for exactly this class of reason ("it reaches browser history, the
 * `Referer` header on any outbound link, and anything reading `location.href`").
 * A violation firing on that page before the strip completes would hand the
 * browser a report containing a live credential, and storing it would recreate
 * the leak that note exists to prevent. So every URL is reduced to origin+path
 * before it goes anywhere near the KV store.
 *
 * WHAT IT IGNORES
 * ---------------
 * Browser-extension noise (`chrome-extension:`, `moz-extension:`, `safari-web-
 * extension:`). Extensions inject scripts into every page and generate the bulk
 * of real-world CSP reports. None of it is actionable — we cannot fix someone
 * else's ad blocker — and left in, it buries the reports that are.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  createQualityIssueFingerprint,
  type QualityIssue,
} from '../../../shared/quality/qualityIssues.ts';
import { CSP_VIOLATION_ISSUES_KEY, MAX_CSP_VIOLATION_ISSUES } from './quality-issues-normalize.ts';

const app = new Hono();
const log = createModuleLogger('csp-report');

/** Schemes whose violations are someone else's software, not our policy. */
const EXTENSION_SCHEMES = [
  'chrome-extension:',
  'moz-extension:',
  'safari-web-extension:',
  'safari-extension:',
  'webkit-masked-url:',
];

/** One request cannot enqueue more than this many reports. */
const MAX_REPORTS_PER_REQUEST = 20;

/**
 * Reduce a URL to origin + path.
 *
 * Query and fragment are dropped unconditionally — see the signer-token note in
 * the module header. A value that will not parse as a URL is a scheme like
 * `inline`, `eval` or `data`, which CSP uses as a blocked-URI sentinel; those
 * are meaningful and carry nothing sensitive, so they pass through truncated.
 */
function stripUrl(raw: unknown, max = 300): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  try {
    const u = new URL(raw);
    // `origin` is the string "null" for every non-special scheme, so building
    // origin+path for `chrome-extension://abc/x.js` yields `null/x.js` — the
    // scheme is destroyed, and with it the only thing identifying the report as
    // extension noise. Reconstruct from protocol+host instead, which round-trips
    // http(s) identically and preserves the rest.
    if (u.host) return `${u.protocol}//${u.host}${u.pathname}`.slice(0, max);
    // Hostless schemes: `data:`, `blob:`, `filesystem:`.
    return `${u.protocol}${u.pathname}`.slice(0, max);
  } catch {
    // Not a URL at all. CSP uses bare words — `inline`, `eval`, `wasm-eval` —
    // to name what it blocked when there is no URL to report.
    return raw.split(/[?#]/)[0].slice(0, max);
  }
}

function text(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.slice(0, max) : '';
}

interface NormalizedViolation {
  directive: string;
  blockedUrl: string;
  documentUrl: string;
  sourceFile: string;
  sample: string;
  disposition: string;
}

/**
 * Normalise both wire formats into one shape.
 *
 * `report-uri` sends `application/csp-report`: a single `{"csp-report": {...}}`
 * with hyphenated keys. The Reporting API (`Reporting-Endpoints` + `report-to`)
 * sends `application/reports+json`: an ARRAY of `{type, url, body}` with
 * camelCase keys. Safari and older Chrome still use the first; current Chrome
 * uses the second. Supporting only one silently halves the evidence, which is
 * the failure this module exists to end, so both are accepted.
 */
function normalize(payload: unknown): NormalizedViolation[] {
  const out: NormalizedViolation[] = [];

  const pushLegacy = (r: Record<string, unknown>) => {
    out.push({
      directive: text(r['effective-directive'] ?? r['violated-directive'], 60) || 'unknown',
      blockedUrl: stripUrl(r['blocked-uri']),
      documentUrl: stripUrl(r['document-uri']),
      sourceFile: stripUrl(r['source-file']),
      sample: text(r['script-sample'], 100),
      disposition: text(r['disposition'], 20) || 'report',
    });
  };

  const pushModern = (b: Record<string, unknown>) => {
    out.push({
      directive: text(b.effectiveDirective, 60) || 'unknown',
      blockedUrl: stripUrl(b.blockedURL),
      documentUrl: stripUrl(b.documentURL),
      sourceFile: stripUrl(b.sourceFile),
      sample: text(b.sample, 100),
      disposition: text(b.disposition, 20) || 'report',
    });
  };

  if (Array.isArray(payload)) {
    for (const entry of payload.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (e.type && e.type !== 'csp-violation') continue;
      const body = e.body;
      if (body && typeof body === 'object') pushModern(body as Record<string, unknown>);
    }
    return out;
  }

  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const legacy = p['csp-report'];
    if (legacy && typeof legacy === 'object') {
      pushLegacy(legacy as Record<string, unknown>);
    } else if (p.body && typeof p.body === 'object') {
      pushModern(p.body as Record<string, unknown>);
    }
  }
  return out;
}

function isExtensionNoise(v: NormalizedViolation): boolean {
  return EXTENSION_SCHEMES.some(
    (scheme) => v.blockedUrl.startsWith(scheme) || v.sourceFile.startsWith(scheme),
  );
}

/**
 * POST / — the endpoint named by `Reporting-Endpoints` and `report-uri`.
 *
 * Always answers 204, whatever the body. A browser cannot act on an error here
 * and does not retry usefully; a non-2xx would only make a violation look like
 * an outage in the logs.
 */
app.post(
  '/',
  asyncHandler(async (c) => {
    const payload = await c.req.json().catch(() => null);
    const violations = normalize(payload).filter((v) => !isExtensionNoise(v));

    if (violations.length === 0) {
      return c.body(null, 204);
    }

    const now = new Date().toISOString();
    const stored = (await kv.get(CSP_VIOLATION_ISSUES_KEY)) as QualityIssue[] | null;
    let issues = Array.isArray(stored) ? stored : [];

    for (const v of violations) {
      // Fingerprint on directive + what was blocked, NOT on the page. One
      // blocked origin reached from forty pages is one thing to fix, and forty
      // rows would push the real variety out of a capped list.
      const fingerprint = createQualityIssueFingerprint({
        source: 'audit',
        category: 'security',
        ruleId: `csp:${v.directive}`,
        title: v.blockedUrl || 'inline',
        filePath: v.sourceFile,
      });
      const existing = issues.findIndex((i) => i.fingerprint === fingerprint);
      const next: QualityIssue = {
        id: fingerprint,
        source: 'audit',
        category: 'security',
        priority: v.disposition === 'enforce' ? 'high' : 'medium',
        fingerprint,
        // 'warning' while the policy is report-only: nothing broke for the
        // visitor, the browser only told us it would have.
        severity: v.disposition === 'enforce' ? 'error' : 'warning',
        status: 'open',
        title: `CSP ${v.directive} blocked ${v.blockedUrl || 'an inline resource'}`,
        message: [
          `Directive: ${v.directive}`,
          `Blocked: ${v.blockedUrl || '(inline)'}`,
          v.documentUrl ? `On page: ${v.documentUrl}` : '',
          v.sourceFile ? `Source: ${v.sourceFile}` : '',
          v.sample ? `Sample: ${v.sample}` : '',
          `Disposition: ${v.disposition}`,
        ]
          .filter(Boolean)
          .join('\n'),
        filePath: v.sourceFile || v.documentUrl || 'browser',
        ruleId: `csp:${v.directive}`,
        firstSeenAt: existing >= 0 ? issues[existing].firstSeenAt : now,
        lastSeenAt: now,
        occurrences: existing >= 0 ? issues[existing].occurrences + 1 : 1,
      };
      issues =
        existing >= 0 ? issues.map((i, idx) => (idx === existing ? next : i)) : [next, ...issues];
    }

    const trimmed = issues
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, MAX_CSP_VIOLATION_ISSUES);

    await kv.set(CSP_VIOLATION_ISSUES_KEY, trimmed);
    log.warn('CSP violation reported', {
      count: violations.length,
      directives: [...new Set(violations.map((v) => v.directive))],
    });

    return c.body(null, 204);
  }),
);

/** GET / — admin read-back. The same rows also reach the quality dashboard. */
app.get(
  '/',
  requireAdmin,
  asyncHandler(async (c) => {
    const stored = (await kv.get(CSP_VIOLATION_ISSUES_KEY)) as QualityIssue[] | null;
    return c.json({ success: true, violations: Array.isArray(stored) ? stored : [] });
  }),
);

export default app;
