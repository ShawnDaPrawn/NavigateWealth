/**
 * P7.4 — Synthetic monitoring probe.
 *
 * Exercises the hot path of the e-signature module once an hour so a
 * regression that doesn't fire on user traffic still raises an alarm
 * quickly. The probe is deliberately hermetic — it does NOT create
 * real envelopes, send emails, or write to Storage. It checks the
 * subsystems most likely to break silently:
 *
 *   1. KV round-trip (write → read → delete).
 *   2. Crypto SHA-256 hash over a small buffer — the same primitive
 *      the verification page relies on.
 *   3. HMAC signing with Web Crypto — the webhook outbox primitive.
 *   4. `pdf-lib` can load, modify, and save a tiny synthetic PDF —
 *      the primitive behind `PDFService.burnIn` and certificate
 *      merging.
 *
 * Every check is timed independently; the overall probe passes iff
 * all checks pass and the total latency is under the 10-second SLO.
 *
 * Results are stamped to KV:
 *   - `EsignKeys.syntheticProbeLatest()`  — most recent result (for
 *     the diagnostics page).
 *   - `EsignKeys.syntheticProbeHistory()` — ring buffer of the last
 *     24 results so we can spot latency drift.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { PDFDocument } from 'npm:pdf-lib';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-synthetic-probe');

/** Overall latency SLO. Probes slower than this are marked ok=false. */
const LATENCY_SLO_MS = 10_000;
/** Keep the last N probe results in a ring buffer. */
const HISTORY_LIMIT = 24;

export interface ProbeCheck {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  ranAt: string;
  error?: string;
  checks: Record<string, ProbeCheck>;
}

async function time<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number; value?: T; detail?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, latencyMs: Date.now() - start, value };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function kvRoundTrip(): Promise<void> {
  const key = `esign:synthetic:rt:${crypto.randomUUID()}`;
  const value = { ts: Date.now(), nonce: crypto.randomUUID() };
  await kv.set(key, value);
  const round = await kv.get(key);
  if (!round || (round as { nonce?: string }).nonce !== value.nonce) {
    throw new Error('KV round-trip mismatch');
  }
  await kv.del(key);
}

async function sha256Probe(): Promise<void> {
  const data = new TextEncoder().encode('navigate-wealth-synthetic-probe');
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (hex.length !== 64) throw new Error('Unexpected digest length');
}

async function hmacProbe(): Promise<void> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('synthetic-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const payload = new TextEncoder().encode('{"probe":true}');
  const sig = await crypto.subtle.sign('HMAC', key, payload);
  const verified = await crypto.subtle.verify('HMAC', key, sig, payload);
  if (!verified) throw new Error('HMAC verification failed');
}

async function pdfLibProbe(): Promise<void> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([200, 200]);
  page.drawText('probe', { x: 10, y: 10 });
  const bytes = await pdf.save();
  // Re-parse to ensure round-tripping works.
  const reloaded = await PDFDocument.load(bytes);
  if (reloaded.getPageCount() !== 1) throw new Error('PDF round-trip page mismatch');
}

export async function runSyntheticProbe(): Promise<ProbeResult> {
  const ranAt = new Date().toISOString();
  const start = Date.now();

  const checks: Record<string, ProbeCheck> = {};
  const [kvR, shaR, hmacR, pdfR] = await Promise.all([
    time(kvRoundTrip),
    time(sha256Probe),
    time(hmacProbe),
    time(pdfLibProbe),
  ]);
  checks.kv = { ok: kvR.ok, latencyMs: kvR.latencyMs, detail: kvR.detail };
  checks.sha256 = { ok: shaR.ok, latencyMs: shaR.latencyMs, detail: shaR.detail };
  checks.hmac = { ok: hmacR.ok, latencyMs: hmacR.latencyMs, detail: hmacR.detail };
  checks.pdfLib = { ok: pdfR.ok, latencyMs: pdfR.latencyMs, detail: pdfR.detail };

  const latencyMs = Date.now() - start;
  const allOk = Object.values(checks).every((c) => c.ok);
  const withinSlo = latencyMs <= LATENCY_SLO_MS;

  const result: ProbeResult = {
    ok: allOk && withinSlo,
    latencyMs,
    ranAt,
    error: !allOk
      ? 'One or more subsystem checks failed'
      : !withinSlo
        ? `Latency ${latencyMs}ms exceeded SLO ${LATENCY_SLO_MS}ms`
        : undefined,
    checks,
  };

  await kv.set(EsignKeys.syntheticProbeLatest(), result);
  try {
    const historyRaw = await kv.get(EsignKeys.syntheticProbeHistory());
    const history: ProbeResult[] = Array.isArray(historyRaw) ? historyRaw : [];
    history.unshift({
      ok: result.ok,
      latencyMs: result.latencyMs,
      ranAt: result.ranAt,
      error: result.error,
      checks: {},
    });
    const trimmed = history.slice(0, HISTORY_LIMIT);
    await kv.set(EsignKeys.syntheticProbeHistory(), trimmed);
  } catch (err) {
    log.warn(`Probe history write failed: ${String(err)}`);
  }

  if (!result.ok) {
    log.error(
      `Synthetic probe FAILED: latencyMs=${latencyMs} error=${result.error} ` +
      `kv=${checks.kv.ok} sha=${checks.sha256.ok} hmac=${checks.hmac.ok} pdf=${checks.pdfLib.ok}`,
    );
  } else {
    log.info(`Synthetic probe ok in ${latencyMs}ms`);
  }

  return result;
}

export async function getLatestProbe(): Promise<ProbeResult | null> {
  const raw = await kv.get(EsignKeys.syntheticProbeLatest());
  return raw ? (raw as ProbeResult) : null;
}

export async function getProbeHistory(): Promise<Array<Pick<ProbeResult, 'ok' | 'latencyMs' | 'ranAt' | 'error'>>> {
  const raw = await kv.get(EsignKeys.syntheticProbeHistory());
  return Array.isArray(raw) ? raw : [];
}
