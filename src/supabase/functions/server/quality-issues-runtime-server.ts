/**
 * ****************************************************************************
 * RUNTIME SERVER ISSUE RECORDER
 * ****************************************************************************
 *
 * The in-house quality-issues pipeline already ingests CI reports, a security
 * feed, and CLIENT runtime errors (source: 'runtime-client', written by the
 * `/runtime-client` route in quality-issues-routes.ts). The 'runtime-server'
 * source was defined in the schema (shared/quality/qualityIssues.ts) but never
 * populated — so unhandled Edge Function exceptions only ever hit stderr and
 * never surfaced on the quality dashboard.
 *
 * This module closes that gap (the "extend in-house reporter / backend" half of
 * the error-monitoring work): `recordRuntimeServerIssue` is called from the
 * root 5xx observer in create-app.ts for EVERY 5xx response — thrown
 * exceptions (the error handler hands its Error over through the request
 * context) and the ~350 routes that catch their own failure and answer
 * `c.json({ error }, 500)`, which never reach the error handler at all. It
 * persists a deduplicated,
 * occurrence-counted issue into KV under RUNTIME_SERVER_ISSUES_KEY. The routes
 * module folds these into the dashboard snapshot alongside client issues, so
 * they get the same fingerprinting, recurrence detection, and task automation.
 *
 * Design rules:
 *   - MUST NEVER throw — this runs inside the error handler. All work is wrapped
 *     in try/catch and failures are swallowed (monitoring must not create a
 *     second user-facing failure).
 *   - No new env/secrets — reuses the existing KV store (Supabase service role).
 *   - Expected errors (validation, not-found, other APIError subclasses) are NOT
 *     recorded here; the caller only invokes this for unexpected 500s.
 */

import * as kv from './kv_store.tsx';
import {
  createQualityIssueFingerprint,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  type QualityIssue,
} from '../../../shared/quality/qualityIssues.ts';
import {
  cleanErrorMessage,
  describeRuntimeIssue,
  normalizeMessageForGrouping,
} from '../../../shared/quality/issueLabels.ts';

export const RUNTIME_SERVER_ISSUES_KEY = 'quality_issues:runtime_server';
const MAX_RUNTIME_SERVER_ISSUES = 100;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_STACK_LENGTH = 3000;
const MAX_BODY_CHARS = 4000;

export interface RuntimeServerIssueInput {
  /** The thrown exception, when the 500 came from the shared error handler. */
  error?: Error | null;
  /**
   * The body of a 5xx response a route built by hand (`c.json({error}, 500)`).
   * ~350 routes catch their own failures this way and never reach the error
   * handler, so the body is the only description of what went wrong. Read in
   * the background; a promise so the caller never waits on it.
   */
  responseBody?: Promise<string | undefined> | string;
  path?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildIssueId(fingerprint: string): string {
  return `runtime-server:${fingerprint}`
    .toLowerCase()
    .replace(/[^a-z0-9:_./<>-]+/g, '-')
    .slice(0, 180);
}

/**
 * Pull the human-readable reason out of an error response body. Routes use a
 * handful of shapes: `{error}`, `{message}`, `{error, details}`, or plain text.
 */
export function messageFromResponseBody(body: string | undefined): string | undefined {
  if (!body) return undefined;
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const pick = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim()
        ? value.trim()
        : value &&
            typeof value === 'object' &&
            typeof (value as { message?: unknown }).message === 'string'
          ? ((value as { message: string }).message || '').trim() || undefined
          : undefined;
    const primary = pick(parsed.error) ?? pick(parsed.message);
    const details = pick(parsed.details) ?? pick(parsed.detail);
    if (primary && details && !primary.includes(details)) return `${primary}: ${details}`;
    return primary ?? details;
  } catch {
    // HTML error pages carry nothing useful beyond their title.
    const title = trimmed.match(/<title>([^<]+)<\/title>/i)?.[1];
    return (title ?? trimmed).slice(0, 300);
  }
}

/** Read the persisted server-runtime issues (used by the dashboard snapshot). */
export async function getRuntimeServerIssues(): Promise<QualityIssue[]> {
  try {
    const issues = (await kv.get(RUNTIME_SERVER_ISSUES_KEY)) as QualityIssue[] | null;
    return Array.isArray(issues) ? issues : [];
  } catch {
    return [];
  }
}

/**
 * Serialises this isolate's writes to the single issues row.
 *
 * SECURITY-AUDIT A17: `recordRuntimeServerIssue` is a read-modify-write over one
 * KV row, and `kv.set` is a bare upsert — no compare-and-set, no row lock. Two
 * concurrent 500s therefore read the same snapshot and the second write loses
 * the first's occurrence increment, under-reporting during exactly the incident
 * the dashboard exists to surface.
 *
 * Chaining every write in this isolate behind the previous one removes the
 * same-isolate half of that for free. It does NOT make the write atomic across
 * isolates — that needs per-fingerprint keys or a Postgres upsert, which is a
 * data-layer change and stays on the roadmap. Ground truth is not at stake
 * either way: the full error, name and stack reach stderr before this runs.
 */
let writeChain: Promise<void> = Promise.resolve();

/**
 * Record an issue WITHOUT blocking the caller's response.
 *
 * The `await` this replaces sat on the error path of every route behind the 77
 * lazy mounts, so each unexpected 500 paid two serialised Supabase round-trips
 * before responding — worst during a downstream outage, when the same degraded
 * project is what makes them slow, and the error path amplifies its own load.
 *
 * Dropping the `await` outright would be wrong: the isolate may suspend as soon
 * as the response is returned, losing the write. `EdgeRuntime.waitUntil` is the
 * supported way to keep work alive past the response in Supabase's edge runtime,
 * so it is used when present and awaited otherwise — which keeps the previous
 * behaviour exactly in the Vitest suite and any runtime without the hook.
 */
export function scheduleRuntimeServerIssue(input: RuntimeServerIssueInput): Promise<void> {
  const pending = recordRuntimeServerIssue(input);

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;

  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(pending);
    return Promise.resolve();
  }

  return pending;
}

/**
 * Persist an unhandled server exception as a 'runtime-server' quality issue.
 * Deduplicates by fingerprint (error class + route shape + message shape) and increments an
 * occurrence counter, mirroring the `/runtime-client` ingest behaviour.
 *
 * Prefer {@link scheduleRuntimeServerIssue} from a request path — this one
 * resolves only once the KV write has completed.
 */
export async function recordRuntimeServerIssue(input: RuntimeServerIssueInput): Promise<void> {
  // Queue behind any write already in flight in this isolate, so two concurrent
  // 500s cannot both read the same snapshot. Failures are swallowed inside the
  // body below, so the chain cannot be poisoned by one bad write.
  const queued = writeChain.then(() => writeIssue(input));
  writeChain = queued;
  return queued;
}

async function writeIssue(input: RuntimeServerIssueInput): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error, path, method, statusCode, requestId } = input;

    let bodyMessage: string | undefined;
    try {
      bodyMessage = messageFromResponseBody(await input.responseBody);
    } catch {
      bodyMessage = undefined;
    }

    // Generic wrapper text from the shared handler says nothing; prefer the
    // exception, then whatever the route wrote into its response.
    const genericBody = !bodyMessage || /^An unexpected error occurred$/i.test(bodyMessage);
    const rawMessage =
      error?.message || (!genericBody ? bodyMessage : undefined) || 'Unhandled server error';
    const errorName = error?.name || (statusCode ? `HTTP ${statusCode}` : 'ServerError');
    const kind = error ? 'server-exception' : 'server-error-response';
    const labels = describeRuntimeIssue({
      kind,
      errorName,
      message: rawMessage,
      stack: error?.stack,
      method,
      path,
      statusCode,
    });

    const ruleId = (error?.name || `http-${statusCode || 500}`).slice(0, 120);
    const route = labels.route || 'edge-function';
    const filePath = `${(method || '').toUpperCase()} ${route}`.trim().slice(0, 240);
    const category = inferQualityIssueCategory('runtime-server', ruleId);
    const priority = inferQualityIssuePriority({
      source: 'runtime-server',
      severity: 'error',
      category,
    });
    // Group by route SHAPE + message SHAPE, so the same failure on different
    // records is one issue and two different failures on one route are two.
    const fingerprint = createQualityIssueFingerprint({
      source: 'runtime-server',
      category,
      ruleId,
      title: normalizeMessageForGrouping(cleanErrorMessage(rawMessage)),
      filePath,
    });

    const details = [
      method && path ? `Request: ${method} ${path}` : path ? `Path: ${path}` : '',
      statusCode ? `Status: ${statusCode}` : '',
      requestId ? `Request-ID: ${requestId}` : '',
      error?.stack ? `Stack:\n${truncate(error.stack, MAX_STACK_LENGTH)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const id = buildIssueId(fingerprint);

    const currentIssues = (await kv.get(RUNTIME_SERVER_ISSUES_KEY)) as QualityIssue[] | null;
    const issues = Array.isArray(currentIssues) ? currentIssues : [];
    const existingIndex = issues.findIndex(
      (issue) => issue.fingerprint === fingerprint || issue.id === id,
    );

    const nextIssue: QualityIssue = {
      id,
      source: 'runtime-server',
      category,
      priority,
      fingerprint,
      severity: 'error',
      status: 'open',
      title: labels.title,
      message: rawMessage.slice(0, MAX_MESSAGE_LENGTH),
      summary: labels.summary,
      likelyCause: labels.likelyCause,
      area: labels.area,
      route: labels.route,
      details: details.slice(0, MAX_MESSAGE_LENGTH),
      filePath,
      ruleId,
      firstSeenAt: existingIndex >= 0 ? issues[existingIndex].firstSeenAt : now,
      lastSeenAt: now,
      occurrences: existingIndex >= 0 ? issues[existingIndex].occurrences + 1 : 1,
    };

    const nextIssues =
      existingIndex >= 0
        ? issues.map((issue, index) => (index === existingIndex ? nextIssue : issue))
        : [nextIssue, ...issues];

    const trimmedIssues = nextIssues
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, MAX_RUNTIME_SERVER_ISSUES);

    await kv.set(RUNTIME_SERVER_ISSUES_KEY, trimmedIssues);
  } catch {
    // Monitoring must never create a second failure inside the error handler.
  }
}

/**
 * Read at most MAX_BODY_CHARS of a cloned error response. Never throws.
 */
export async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.slice(0, MAX_BODY_CHARS);
  } catch {
    return undefined;
  }
}
