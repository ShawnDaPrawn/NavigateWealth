/**
 * The CSP script-src hashes must match the inline scripts we actually ship.
 * ========================================================================
 *
 * `script-src` no longer carries `'unsafe-inline'`. It carries two sha256
 * hashes instead, which is a strictly better policy and a strictly more
 * brittle one: a hash is a promise about bytes, and if an inline script's
 * bytes change by one character the browser silently refuses to run it. On the
 * report-only policy that is a report; the moment the policy is enforced it is
 * a broken page, and the two scripts in question are the SEO safety net and the
 * snapshot guard — the pieces that decide what a crawler and a first-paint
 * visitor see.
 *
 * So the hashes cannot live only in vercel.json. This recomputes them from the
 * real sources and fails the build on drift.
 *
 * WHY THERE ARE ONLY TWO
 * ----------------------
 * There were 27. `apply-static-seo.mjs` emitted a guard snippet per route with
 * the route path interpolated INTO the JavaScript, so all 26 prerendered routes
 * differed by a string literal. Listing 26 hashes would have worked exactly
 * until someone renamed a slug. The path moved to a `data-seo-path` attribute
 * the snippet reads, which made it byte-identical everywhere.
 *
 * The other 26 inline blocks per build are `application/ld+json`. Those are
 * data, not script: the browser never executes them and `script-src` does not
 * apply. This test asserts that classification rather than assuming it.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { staticBodyPathGuard } from '../../scripts/seo/seo-static-data.mjs';

const repoRoot = resolve(__dirname, '../..');

/** Script types the browser executes, and therefore `script-src` governs. */
const JS_TYPES = new Set(['', 'text/javascript', 'module', 'application/javascript']);

const SCRIPT_RE = /<script((?![^>]*\ssrc=)[^>]*)>([\s\S]*?)<\/script>/g;

function sha256(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

/** Every inline script in `html`, split into executable and data blocks. */
function inlineScripts(html: string): { executable: string[]; data: string[] } {
  const executable: string[] = [];
  const data: string[] = [];
  for (const [, attrs, body] of html.matchAll(SCRIPT_RE)) {
    const type = (/type=["']([^"']+)["']/.exec(attrs)?.[1] ?? '').toLowerCase();
    (JS_TYPES.has(type) ? executable : data).push(body);
  }
  return { executable, data };
}

function scriptSrc(): string[] {
  const vercel = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8'));
  const headers = vercel.headers[0].headers as { key: string; value: string }[];
  const policy = headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');
  expect(policy, 'report-only CSP header must exist').toBeTruthy();
  const directive = policy!.value
    .split(';')
    .map((d: string) => d.trim())
    .find((d: string) => d.startsWith('script-src '));
  expect(directive, 'script-src directive must exist').toBeTruthy();
  return directive!.split(/\s+/).slice(1);
}

function htmlFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...htmlFilesIn(p));
    else if (entry.endsWith('.html')) out.push(p);
  }
  return out;
}

describe('CSP script-src hashes', () => {
  it('does not carry unsafe-inline', () => {
    // The whole point. If this comes back, the hashes below stop meaning
    // anything and every injected <script> executes again.
    expect(scriptSrc()).not.toContain("'unsafe-inline'");
  });

  it("covers index.html's inline scripts", () => {
    const { executable } = inlineScripts(readFileSync(join(repoRoot, 'index.html'), 'utf8'));
    expect(executable.length).toBeGreaterThan(0);
    const allowed = scriptSrc();
    for (const body of executable) {
      expect(allowed, `index.html inline script is not covered:\n${body.slice(0, 160)}`).toContain(
        sha256(body),
      );
    }
  });

  it('covers the SEO snapshot guard the build injects', () => {
    const { executable } = inlineScripts(staticBodyPathGuard());
    expect(executable).toHaveLength(1);
    expect(
      scriptSrc(),
      'staticBodyPathGuard() changed — recompute its sha256 into vercel.json script-src',
    ).toContain(sha256(executable[0]));
  });

  it('the guard is identical for every route', () => {
    // The property that keeps this to one hash. staticBodyPathGuard takes no
    // arguments now; if a route-specific value is ever interpolated back in,
    // this stops being true and the hash list explodes again.
    expect(staticBodyPathGuard()).toBe(staticBodyPathGuard());
    expect(staticBodyPathGuard()).not.toMatch(/\/(about|team|services)\b/);
  });

  it('covers every executable inline script in the built output', () => {
    const files = htmlFilesIn(join(repoRoot, 'dist'));
    if (files.length === 0) {
      // CI builds before it tests, so this runs there. Locally it is skipped
      // rather than silently passing on nothing.
      expect(existsSync(join(repoRoot, 'dist'))).toBe(false);
      return;
    }
    const allowed = scriptSrc();
    const uncovered = new Map<string, string>();
    for (const f of files) {
      for (const body of inlineScripts(readFileSync(f, 'utf8')).executable) {
        const h = sha256(body);
        if (!allowed.includes(h)) uncovered.set(h, `${f}: ${body.slice(0, 120)}`);
      }
    }
    expect(Object.fromEntries(uncovered)).toEqual({});
  });

  it('leaves ld+json out of script-src, because the browser never runs it', () => {
    const files = htmlFilesIn(join(repoRoot, 'dist'));
    if (files.length === 0) return;
    const withData = files.filter((f) => inlineScripts(readFileSync(f, 'utf8')).data.length > 0);
    expect(withData.length, 'the build should emit JSON-LD blocks').toBeGreaterThan(0);
    const allowed = scriptSrc();
    for (const f of withData) {
      for (const body of inlineScripts(readFileSync(f, 'utf8')).data) {
        expect(allowed, 'JSON-LD must not need a hash').not.toContain(sha256(body));
      }
    }
  });
});
