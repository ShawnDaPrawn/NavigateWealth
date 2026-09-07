/**
 * Every external origin in client code is either in the CSP or explained.
 * ======================================================================
 *
 * WHY THIS EXISTS. `docs/archive/production-readiness-ledger-2026.md` justified leaving the
 * authenticated admin surface unprobed on the grounds that "static enumeration
 * of every external origin in the admin modules found only the three gaps
 * above, so the residual risk is narrow rather than unknown". That was true on
 * the day someone did the enumeration, and decays the moment anyone adds a
 * `fetch`. A one-time count is not a guarantee; this is the same claim wired to
 * something that fails.
 *
 * WHY IT IS SHAPED THIS WAY. The obvious version — find URLs in fetch-like
 * positions and check those — was written first and thrown away. It found four
 * origins and missed YouTube, TradingView's `support_host` and the RSS feeds,
 * because all three assign the URL to a variable before using it. A detector
 * that silently misses the interesting cases is worse than none: it reports
 * coverage it does not have.
 *
 * So the burden is inverted. EVERY external origin in client source must be
 * accounted for, in one of two lists:
 *
 *   CSP_COVERED  — the browser fetches it, and the policy must say so.
 *   NOT_FETCHED  — it appears in source but the browser never requests it:
 *                  an <a href>, an XML namespace, a form placeholder, a value
 *                  handed to a server-side proxy. Each carries its reason.
 *
 * An origin in neither list fails the suite. That is the point: adding a host
 * forces a decision about what it is, rather than letting a new subresource
 * arrive with no policy entry behind it.
 *
 * SCOPE. Client code only — `src/supabase/functions/` is Deno running on the
 * server, and CSP governs browsers, not servers. Sending the OpenAI or SendGrid
 * origins to this test would be a category error.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(REPO_ROOT, 'src');
const SERVER_DIR = join(SRC, 'supabase', 'functions');

/**
 * Origins the browser genuinely requests. Each must appear in the CSP.
 *
 * The value is the directive it is expected under, so a move between
 * directives is visible rather than absorbed.
 */
const CSP_COVERED: Record<string, string> = {
  'images.unsplash.com': 'img-src',
  's3.tradingview.com': 'script-src',
  'www.tradingview.com': 'script-src',
  'www.googletagmanager.com': 'script-src',
  'www.youtube.com': 'frame-src',
  'fonts.googleapis.com': 'style-src',
};

/**
 * Origins that appear in client source but are never fetched by the browser.
 *
 * The reason is the load-bearing part. "It is fine" is not a reason; each entry
 * says what the string actually is, so the next person can check whether that
 * is still true rather than trusting the list.
 */
const NOT_FETCHED: Record<string, string> = {
  // Self. Canonical URLs, sitemap entries, structured data.
  'www.navigatewealth.co': 'own origin — canonical/OG/sitemap URLs, covered by self',
  'navigatewealth.co': 'own origin, apex form used in redirect config and copy',
  'navigatewealth.com': 'the .com typo-domain, referenced in copy only',

  // <a href> destinations. CSP does not govern navigation; `navigate-to` was
  // never shipped by any browser.
  'www.linkedin.com': 'social profile link (<a href>)',
  'linkedin.com': 'social profile link (<a href>)',
  'www.instagram.com': 'social profile link (<a href>)',
  'instagram.com': 'social profile link (<a href>)',
  'www.facebook.com': 'social profile link (<a href>)',
  'facebook.com': 'social profile link (<a href>)',
  'twitter.com': 'social profile link (<a href>)',
  'x.com': 'social profile link (<a href>)',
  'wa.me': 'WhatsApp click-to-chat link (<a href>)',
  'maps.google.com': 'directions link (<a href>)',
  'youtube.com': 'bare form in a text placeholder and profile links, not an embed',
  'supabase.com': 'documentation link in a code comment/admin help text',

  // Vocabulary and namespace URIs. Identifiers, not addresses — nothing is
  // ever requested from them.
  'schema.org': 'JSON-LD vocabulary URI in structured data',
  'www.w3.org': 'XML/SVG namespace URI',

  // Values handed to a server-side proxy, so the browser contacts our own
  // origin and the Edge Function makes the outbound call.
  'www.investing.com':
    'RSS feed URL passed to the server-side RSS proxy — the browser fetches ' +
    'RSS_PROXY_URL on our own origin, never investing.com directly',
  'www.reuters.com': 'example URL in a form placeholder for the content-source dialog',

  // Placeholders and examples in docs, tests fixtures and form hints.
  'example.com': 'placeholder in help text/examples',
  'api.example.com': 'placeholder in help text/examples',
  'provider.example': 'placeholder in help text/examples',
  'placeholder.invalid': 'deliberately unresolvable placeholder',

  // Historical.
  'cdn.jsdelivr.net':
    'appears only inside the comment recording its removal — pdf.js is served ' +
    'from our own origin now; verified absent from dist/',
};

function walkClientSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      if (full === SERVER_DIR) continue; // Deno; CSP does not apply
      out.push(...walkClientSources(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Hosts, as written in source. Template-literal heads are dropped, not guessed. */
function externalOrigins(): Map<string, string[]> {
  const re = /https?:\/\/([a-zA-Z0-9.$@{}*_-]+\.[a-zA-Z]{2,})/g;
  const found = new Map<string, string[]>();

  for (const file of walkClientSources(SRC)) {
    const text = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const host = m[1];
      // `https://${projectId}.supabase.co` and friends: the interpolation makes
      // the literal host unknowable here, and the policy covers it by wildcard.
      if (host.includes('${') || host.includes('$')) continue;
      const list = found.get(host) ?? [];
      const rel = relative(REPO_ROOT, file);
      if (!list.includes(rel)) list.push(rel);
      found.set(host, list);
    }
  }
  return found;
}

function cspPolicies(): string {
  const vercel = JSON.parse(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf8'));
  const values: string[] = [];
  for (const entry of vercel.headers ?? []) {
    for (const header of entry.headers ?? []) {
      if (header.key.startsWith('Content-Security-Policy')) values.push(header.value);
    }
  }
  return values.join(' ; ');
}

const ORIGINS = externalOrigins();
const POLICY = cspPolicies();

describe('the enumeration itself still works', () => {
  it('finds external origins at all', () => {
    // A regex that silently stopped matching would drive every assertion below
    // to a vacuous pass and read as a clean sweep.
    expect(ORIGINS.size).toBeGreaterThan(15);
  });

  it('reads a policy with the directives it is about to check', () => {
    for (const directive of ['script-src', 'img-src', 'connect-src', 'frame-src']) {
      expect(POLICY, `policy should declare ${directive}`).toContain(directive);
    }
  });

  it('excludes the Deno server tree, which CSP does not govern', () => {
    // api.openai.com and friends live there. If they turn up here, the walk has
    // started reporting origins that no browser will ever request.
    for (const serverOnly of ['api.openai.com', 'api.sendgrid.com', 'api.twilio.com']) {
      expect(ORIGINS.has(serverOnly), `${serverOnly} is server-side only`).toBe(false);
    }
  });
});

describe('every external origin is accounted for', () => {
  it('has no origin missing from both lists', () => {
    const unclassified = [...ORIGINS.entries()]
      .filter(([host]) => !(host in CSP_COVERED) && !(host in NOT_FETCHED))
      .map(([host, files]) => `${host}  (${files.slice(0, 2).join(', ')})`);

    expect(
      unclassified,
      'A new external origin appeared in client code. Decide which it is:\n' +
        '  • the browser fetches it  → add it to the CSP in vercel.json AND to ' +
        'CSP_COVERED here\n' +
        '  • it is a link, a namespace, a placeholder, or a value passed to a ' +
        'server-side proxy → add it to NOT_FETCHED with the reason\n\n' +
        'Unclassified:\n  ' +
        unclassified.join('\n  '),
    ).toEqual([]);
  });

  it('keeps both lists honest — no entry for an origin that left the code', () => {
    // A stale allowlist entry is how an exception outlives its justification.
    const stale = [...Object.keys(CSP_COVERED), ...Object.keys(NOT_FETCHED)].filter(
      (host) => !ORIGINS.has(host),
    );
    expect(
      stale,
      'These are listed here but no longer appear in client source. Remove them ' +
        'so the lists describe the code as it is:\n  ' +
        stale.join('\n  '),
    ).toEqual([]);
  });
});

describe('the policy actually covers what the browser fetches', () => {
  it.each(Object.entries(CSP_COVERED))('%s is allowed under %s', (host, directive) => {
    expect(
      POLICY.includes(host),
      `${host} is fetched by the browser but does not appear in the CSP. ` +
        `It belongs under ${directive} in vercel.json — without it the request ` +
        `is blocked the moment the policy is enforced.`,
    ).toBe(true);
  });

  it('covers the Supabase origin by wildcard, since the ref is interpolated', () => {
    // `https://${projectId}.supabase.co` cannot be matched literally, so the
    // wildcard is what makes every API call legal under connect-src.
    expect(POLICY).toContain('*.supabase.co');
  });
});
