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
 * error middleware for UNEXPECTED 500s and persists a deduplicated,
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

export const RUNTIME_SERVER_ISSUES_KEY = 'quality_issues:runtime_server';
const MAX_RUNTIME_SERVER_ISSUES = 100;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_STACK_LENGTH = 3000;

export interface RuntimeServerIssueInput {
  error: Error;
  path?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildIssueId(ruleId: string, filePath: string): string {
  return ['runtime-server', ruleId, filePath]
    .filter(Boolean)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .slice(0, 180);
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
 * Deduplicates by fingerprint (same error name + endpoint) and increments an
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

    const ruleId = (error?.name || 'ServerError').slice(0, 120);
    const title = (error?.name || 'Server error').slice(0, 240);
    const baseMessage = error?.message || 'Unhandled server error';
    const filePath = path ? path.slice(0, 240) : 'edge-function';
    const category = inferQualityIssueCategory('runtime-server', ruleId);
    const priority = inferQualityIssuePriority({
      source: 'runtime-server',
      severity: 'error',
      category,
    });
    const fingerprint = createQualityIssueFingerprint({
      source: 'runtime-server',
      category,
      ruleId,
      title,
      filePath,
    });

    const context = [
      method && path ? `Request: ${method} ${path}` : path ? `Path: ${path}` : '',
      statusCode ? `Status: ${statusCode}` : '',
      requestId ? `Request-ID: ${requestId}` : '',
      error?.stack ? `Stack:\n${truncate(error.stack, MAX_STACK_LENGTH)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const id = buildIssueId(ruleId, filePath);

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
      title,
      message: `${baseMessage}${context ? `\n\n${context}` : ''}`.slice(0, MAX_MESSAGE_LENGTH),
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
