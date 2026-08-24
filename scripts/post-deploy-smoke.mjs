#!/usr/bin/env node
/**
 * Blocking post-deploy smoke for make-server-91ed8379 (roadmap §8.1 / A8).
 *
 * Hits the live Edge Function after `supabase functions deploy` and fails the
 * GitHub job if health is not 200 or the gated routes are not 401. No secrets
 * required — that is the point. The credentialed form-prefill smoke stays
 * advisory; this one is the deploy gate.
 *
 * Rollback (this runs AFTER deploy, so a red smoke means a bad revision is
 * already live):
 *   1. gh run list --workflow=deploy-supabase-function.yml
 *   2. gh workflow run deploy-supabase-function.yml -f revision=<last-green-sha>
 *      (`--ref` is a branch/tag, not a SHA. The workflow input checks out the
 *      green commit while still using the workflow file on main.)
 *      or revert the merge on main (this workflow then redeploys).
 *   Do not "fix forward" on a 200/401 inversion — that is an auth regression.
 *
 * Run: npm run deploy:smoke
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';
export const DEFAULT_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1/make-server-91ed8379`;

/**
 * Same public anon key the SPA ships. Used only to prove the server still
 * rejects it as a user credential (S1 stay-closed). Never treated as auth.
 */
export const PUBLIC_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwam1kc2x0d3JucGVmemNnZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDcxNjUsImV4cCI6MjA3NTkyMzE2NX0.JeGS_wxI-iw6Tz2fTIwRMBT59oUEf0g1Q0ySvwhdSRg';

export const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/**
 * Probe table. Status codes were re-verified against production on 2026-08-24.
 * Adding a probe that expects 200 on a gated route is how this gate goes
 * vacuous — the structural test forbids it.
 *
 * `auth: 'none'` — no Authorization header (app must 401 on gated paths).
 * `auth: 'anon'` — Bearer public anon key (must 401 AUTH_INVALID, not admin).
 *
 * @typedef {{
 *   name: string,
 *   path: string,
 *   expectedStatus: number,
 *   json?: Record<string, string>,
 *   auth: 'none' | 'anon',
 * }} Probe
 */

/** @type {Probe[]} */
export const PROBES = [
  {
    name: 'liveness',
    path: '/health',
    expectedStatus: 200,
    json: { status: 'healthy' },
    auth: 'none',
  },
  {
    name: 'readiness',
    path: '/health/ready',
    expectedStatus: 200,
    json: { status: 'ready' },
    auth: 'none',
  },
  {
    name: 'kv-store unauthenticated',
    path: '/kv-store/__smoke_probe__',
    expectedStatus: 401,
    json: { code: 'AUTH_REQUIRED' },
    auth: 'none',
  },
  {
    name: 'documents unauthenticated',
    path: '/documents/',
    expectedStatus: 401,
    json: { code: 'AUTH_REQUIRED' },
    auth: 'none',
  },
  {
    name: 'profile unauthenticated',
    path: '/profile/personal-info',
    expectedStatus: 401,
    json: { code: 'AUTH_REQUIRED' },
    auth: 'none',
  },
  {
    name: 'kv-store anon-key-as-bearer',
    path: '/kv-store/__smoke_probe__',
    expectedStatus: 401,
    json: { code: 'AUTH_INVALID' },
    auth: 'anon',
  },
];

/**
 * @param {Probe} probe
 * @param {{ status: number, body: unknown }} response
 * @returns {string[]}
 */
export function evaluateProbe(probe, response) {
  const failures = [];
  if (response.status !== probe.expectedStatus) {
    failures.push(`status ${response.status} !== ${probe.expectedStatus}`);
  }
  if (probe.json) {
    if (
      response.body === null ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    ) {
      failures.push(`body is not a JSON object (got ${JSON.stringify(response.body)})`);
    } else {
      for (const [key, value] of Object.entries(probe.json)) {
        const actual = /** @type {Record<string, unknown>} */ (response.body)[key];
        if (actual !== value) {
          failures.push(`body.${key} ${JSON.stringify(actual)} !== ${JSON.stringify(value)}`);
        }
      }
    }
  }
  return failures;
}

export function isRetryableStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Rejects when `signal` aborts, including after headers have already arrived.
 * Real `fetch()` aborts body reads via the same signal; mocked responses that
 * stall in `.text()` still need this race so the 45s gate cannot hang.
 *
 * @param {AbortSignal} signal
 * @returns {Promise<never>}
 */
function aborted(signal) {
  return new Promise((_, reject) => {
    const rejectAbort = () => {
      reject(
        signal.reason instanceof Error ? signal.reason : new Error('The operation was aborted'),
      );
    };
    if (signal.aborted) {
      rejectAbort();
      return;
    }
    signal.addEventListener('abort', rejectAbort, { once: true });
  });
}

/**
 * @param {{ text?: () => Promise<string>, body?: { cancel?: () => unknown } }} response
 * @param {AbortSignal} signal
 */
async function readBody(response, signal) {
  const textPromise = typeof response.text === 'function' ? response.text() : Promise.resolve('');
  try {
    return await Promise.race([textPromise, aborted(signal)]);
  } finally {
    if (signal.aborted && response.body && typeof response.body.cancel === 'function') {
      try {
        response.body.cancel();
      } catch {
        // Best-effort; a hung mock has no cancelable stream.
      }
    }
  }
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {{ timeoutMs: number, retries: number, fetchImpl: typeof fetch }} opts
 * @returns {Promise<{ response: Response, text: string }>}
 */
export async function fetchWithRetry(url, init, opts) {
  const { timeoutMs, retries, fetchImpl } = opts;
  let lastError = /** @type {unknown} */ (null);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (isRetryableStatus(response.status) && attempt < retries) {
        clearTimeout(timer);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      const text = await readBody(response, controller.signal);
      clearTimeout(timer);
      return { response, text };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function headersFor(probe) {
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (probe.auth === 'anon') {
    headers.Authorization = `Bearer ${PUBLIC_ANON_KEY}`;
    headers.apikey = PUBLIC_ANON_KEY;
  }
  return headers;
}

/**
 * @param {{
 *   probes?: Probe[],
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   retries?: number,
 *   log?: (line: string) => void,
 * }} [options]
 */
export async function runSmoke(options = {}) {
  const probes = options.probes ?? PROBES;
  const baseUrl = (options.baseUrl ?? process.env.NW_EDGE_FUNCTION_URL ?? DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const retries = options.retries ?? 2;
  const log = options.log ?? ((line) => process.stdout.write(`${line}\n`));

  const results = [];
  let failed = 0;

  for (const probe of probes) {
    const url = `${baseUrl}${probe.path}`;
    const started = Date.now();
    try {
      const { response, text } = await fetchWithRetry(
        url,
        { method: 'GET', headers: headersFor(probe) },
        { timeoutMs, retries, fetchImpl },
      );
      let body = /** @type {unknown} */ (null);
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 200);
      }
      const failures = evaluateProbe(probe, { status: response.status, body });
      const elapsedMs = Date.now() - started;
      const requestId =
        response.headers.get('x-request-id') ||
        (body && typeof body === 'object' && !Array.isArray(body)
          ? /** @type {Record<string, unknown>} */ (body).requestId
          : undefined);
      if (failures.length > 0) {
        failed += 1;
        log(
          `FAIL  ${probe.name}  ${response.status}  ${elapsedMs}ms  ${failures.join('; ')}` +
            (requestId ? `  requestId=${requestId}` : ''),
        );
      } else {
        log(`PASS  ${probe.name}  ${response.status}  ${elapsedMs}ms`);
      }
      results.push({ probe, status: response.status, failures, elapsedMs });
    } catch (error) {
      failed += 1;
      const elapsedMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      log(`FAIL  ${probe.name}  network  ${elapsedMs}ms  ${message}`);
      results.push({
        probe,
        status: 0,
        failures: [`network: ${message}`],
        elapsedMs,
      });
    }
  }

  return { failed, results, baseUrl };
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return /post-deploy-smoke\.mjs$/i.test(entry.replaceAll('\\', '/'));
  }
}

async function main() {
  const { failed, baseUrl } = await runSmoke();
  if (failed > 0) {
    process.stdout.write(
      `\nPost-deploy smoke failed (${failed} probe(s)) against ${baseUrl}.\n` +
        'A bad revision is already live. Rollback: gh workflow run deploy-supabase-function.yml -f revision=<last-green-sha>,\n' +
        'or revert the merge on main.\n',
    );
    process.exit(1);
  }
  process.stdout.write(`\nPost-deploy smoke passed against ${baseUrl}.\n`);
}

if (invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
    process.exit(1);
  });
}
