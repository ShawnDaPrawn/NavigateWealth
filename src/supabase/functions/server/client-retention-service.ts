/**
 * POPIA / FAIS retention sweep for closed client relationships.
 *
 * POLICY (owner decision, 2026-08-29 — recorded in docs/PRODUCTION-READINESS.md):
 *
 *   • A DELETED client profile is retained for 7 years.
 *   • The clock runs from RELATIONSHIP END, not from record creation.
 *   • Nothing is exported before erasure.
 *   • ONLY deleted clients are in scope. Suspended and dormant clients are
 *     retained indefinitely.
 *
 * Seven years also clears the FAIS five-year floor for audit, auth_log and
 * activity records, so one boundary serves both obligations rather than two
 * clocks drifting apart.
 *
 * ── The two ways this job could destroy live client data ────────────────────
 *
 * 1. SUSPENDED IS NOT THE OPPOSITE OF DELETED. `deleteClient()` in
 *    `client-management-service.ts` sets `security.suspended = true` AND
 *    `security.deleted = true` together. So "skip the suspended ones" would
 *    skip everything, and "sweep the suspended ones" would erase live
 *    suspensions. The only safe discriminator is `deleted === true`.
 *    Production carries 3 suspended-but-not-deleted clients today; they are
 *    the reason this is stated first rather than left to be inferred.
 *
 * 2. DORMANCY IS NOT CLOSURE. `AccountStatus` has no `inactive` member — a
 *    client nobody has touched in years is still `active` or `approved`. Any
 *    rule keyed on a last-activity timestamp would erase living relationships
 *    that merely went quiet. This keys on the closure event and nothing else.
 *
 * ── What it will actually do today ──────────────────────────────────────────
 *
 * Nothing. The oldest closure in production is 2026-02-16, so the first record
 * becomes eligible in February 2033. That is the expected result, not a
 * misconfiguration: the value here is that the obligation is enforced and
 * auditable from now on, not that anything is erased this year. A sweep that
 * reports `erased: 0` is the correct outcome for the next ~6.5 years, and the
 * tests use synthetic timestamps precisely because production cannot yet
 * produce a positive case.
 */

import { createKvRepository } from './repositories/kv-repository.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('client-retention');

/** Owner decision 2026-08-29. Applies to client profiles and FAIS records alike. */
export const RETENTION_YEARS = 7;

/**
 * A single sweep never erases more than this many subjects.
 *
 * Not a performance guard. If a bug ever widens the eligibility test, the blast
 * radius is one batch and the next run needs a human to re-invoke it, rather
 * than one invocation quietly clearing the store.
 */
export const MAX_ERASURES_PER_SWEEP = 50;

/**
 * Namespaces erased alongside the profile, keyed by the subject's user id.
 *
 * Everything goes through `createKvRepository` rather than `kv_store` directly:
 * the kv-direct-access ratchet caps direct calls at a committed floor, and the
 * point of that floor is that new code stops adding to it.
 */
const SUBJECT_SCOPED_NAMESPACES = [
  'user_profile:',
  'security:',
  'auth_log:',
  'audit:',
  'activity:',
] as const;

const securityRepo = createKvRepository<SecurityRecord>('security:');
const erasureLogRepo = createKvRepository<ErasureLogEntry>('erasure_log:client_retention:');

export interface RetentionCandidate {
  userId: string;
  /** Closure timestamp — the relationship-end date the window runs from. */
  deletedAt: string;
  /** Whole days past the retention boundary. */
  daysPastDue: number;
}

export interface RetentionBlocker {
  userId: string;
  reason: 'missing-deletion-timestamp' | 'unparseable-deletion-timestamp';
  /** Whatever was found in place of a usable timestamp, for triage. */
  found: string | null;
}

export interface RetentionSweepResult {
  /** False means nothing was written — the default, and the safe default. */
  applied: boolean;
  scanned: number;
  /** Deleted subjects still inside their 7 years. */
  retained: number;
  /** Deleted subjects past the boundary and eligible for erasure. */
  eligible: RetentionCandidate[];
  /** Eligible subjects actually erased (empty unless `applied`). */
  erased: string[];
  /** Keys removed across all namespaces. */
  keysRemoved: number;
  /**
   * Deleted subjects that CANNOT be assessed, because the closure timestamp is
   * missing or unreadable. Never erased — an unknown closure date is not an
   * expired one. Surfaced so the gap gets backfilled rather than sitting silent.
   */
  blocked: RetentionBlocker[];
  /** True when the batch cap stopped the sweep short. */
  cappedAtLimit: boolean;
  boundary: string;
}

interface SecurityRecord {
  deleted?: boolean;
  deletedAt?: string;
  suspended?: boolean;
}

interface ErasureLogEntry {
  erasedAt: string;
  policy: string;
  boundary: string;
  subjects: string[];
  keysRemoved: number;
  cappedAtLimit: boolean;
}

/** The instant a relationship must have ended before, to be erasable now. */
export function retentionBoundary(now: Date): Date {
  const boundary = new Date(now.getTime());
  boundary.setUTCFullYear(boundary.getUTCFullYear() - RETENTION_YEARS);
  return boundary;
}

function userIdFromSecurityKey(key: string): string {
  return key.slice('security:'.length);
}

/**
 * Classify every closed relationship against the boundary.
 *
 * Deliberately does not read profiles: `security.deleted` is the field
 * `deleteClient()` writes and the field `client-cleanup-service` backfills, so
 * it is the one authority on closure. Cross-checking `accountStatus` would add
 * a second opinion without a tie-breaker.
 */
export async function assessRetention(now: Date = new Date()): Promise<{
  scanned: number;
  retained: number;
  eligible: RetentionCandidate[];
  blocked: RetentionBlocker[];
  boundary: Date;
}> {
  const boundary = retentionBoundary(now);
  const records = await securityRepo.listWithKeys(
    'POPIA/FAIS retention sweep over closed relationships',
  );

  let scanned = 0;
  let retained = 0;
  const eligible: RetentionCandidate[] = [];
  const blocked: RetentionBlocker[] = [];

  for (const row of records) {
    const security = row.value ?? ({} as SecurityRecord);

    // The whole safety property, in one condition. Suspension is irrelevant
    // here; see the header.
    if (security.deleted !== true) continue;
    scanned += 1;

    const raw = typeof security.deletedAt === 'string' ? security.deletedAt : null;
    if (!raw) {
      blocked.push({
        userId: userIdFromSecurityKey(row.key),
        reason: 'missing-deletion-timestamp',
        found: null,
      });
      continue;
    }

    const closedAt = new Date(raw);
    if (Number.isNaN(closedAt.getTime())) {
      blocked.push({
        userId: userIdFromSecurityKey(row.key),
        reason: 'unparseable-deletion-timestamp',
        found: raw,
      });
      continue;
    }

    if (closedAt.getTime() > boundary.getTime()) {
      retained += 1;
      continue;
    }

    eligible.push({
      userId: userIdFromSecurityKey(row.key),
      deletedAt: raw,
      daysPastDue: Math.floor((boundary.getTime() - closedAt.getTime()) / 86_400_000),
    });
  }

  // Oldest closure first, so a capped run erases in the order the obligation
  // came due rather than in whatever order the store returned.
  eligible.sort((a, b) => a.deletedAt.localeCompare(b.deletedAt));

  return { scanned, retained, eligible, blocked, boundary };
}

async function eraseSubject(userId: string): Promise<number> {
  let removed = 0;

  for (const namespace of SUBJECT_SCOPED_NAMESPACES) {
    const repo = createKvRepository<unknown>(namespace);
    const rows = await repo.listWithKeys(`retention erasure for subject ${userId}`, userId);

    for (const row of rows) {
      // A prefix scan on the id also matches a DIFFERENT id that merely starts
      // with the same characters. Subject-scoped keys are either exactly
      // `<namespace><userId>` or namespaced beneath it
      // (`user_profile:<id>:personal_info`), so anything continuing without a
      // delimiter belongs to somebody else and must survive.
      const suffix = row.key.slice(`${namespace}${userId}`.length);
      if (suffix !== '' && !suffix.startsWith(':')) continue;

      await repo.remove(row.key.slice(namespace.length));
      removed += 1;
    }
  }

  return removed;
}

/**
 * Run the sweep.
 *
 * `apply` defaults to false. Erasure is irreversible and forecloses the
 * reinstatement path `deleteClient()` deliberately preserves via
 * `security.previousAccountStatus`, so the caller states its intent explicitly
 * rather than inheriting it from a default.
 */
export async function runClientRetentionSweep(
  options: { apply?: boolean; now?: Date } = {},
): Promise<RetentionSweepResult> {
  const now = options.now ?? new Date();
  const apply = options.apply === true;

  const { scanned, retained, eligible, blocked, boundary } = await assessRetention(now);

  const batch = eligible.slice(0, MAX_ERASURES_PER_SWEEP);
  const cappedAtLimit = eligible.length > MAX_ERASURES_PER_SWEEP;

  const erased: string[] = [];
  let keysRemoved = 0;

  if (apply) {
    for (const candidate of batch) {
      keysRemoved += await eraseSubject(candidate.userId);
      erased.push(candidate.userId);
    }

    if (erased.length > 0) {
      // POPIA asks what was erased and when. The log records the subjects and
      // the boundary applied — not the data itself, which would defeat the
      // erasure it is recording.
      await erasureLogRepo.put(now.toISOString(), {
        erasedAt: now.toISOString(),
        policy: `${RETENTION_YEARS}y from relationship end (deleted clients only)`,
        boundary: boundary.toISOString(),
        subjects: erased,
        keysRemoved,
        cappedAtLimit,
      });
    }
  }

  const result: RetentionSweepResult = {
    applied: apply,
    scanned,
    retained,
    eligible,
    erased,
    keysRemoved,
    blocked,
    cappedAtLimit,
    boundary: boundary.toISOString(),
  };

  log.info('client retention sweep', {
    applied: apply,
    scanned,
    retained,
    eligible: eligible.length,
    erased: erased.length,
    blocked: blocked.length,
    cappedAtLimit,
  });

  return result;
}
