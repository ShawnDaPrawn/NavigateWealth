/**
 * Public lead-gen form rate limiting (SECURITY-AUDIT S11, IP dimension)
 * =====================================================================
 *
 * THE HOLE THIS CLOSES
 * --------------------
 * The three public forms — contact, quote request, consultation — each carried
 * their own copy of the same inline limiter, and every copy keyed on the
 * submitted email address alone:
 *
 *     const rateLimitKey = `rate_limit:contact:${email.toLowerCase()}`;
 *
 * The email address is supplied by the same anonymous caller the limit is meant
 * to restrain. Changing one character produces a fresh bucket, so the limit
 * bounded nothing: a script could submit indefinitely by incrementing a counter
 * in the local part. Adding the caller's IP as a second, independent dimension
 * is what makes the limit cost the attacker something they cannot trivially
 * rotate.
 *
 * Both dimensions are checked. Either one tripping rejects the submission.
 *
 * WHY THE IP BUDGET IS LARGER THAN THE EMAIL BUDGET
 * -------------------------------------------------
 * An IP is not a person. Households, offices and mobile carriers put many
 * legitimate visitors behind one address, so an IP budget as tight as the
 * per-email one would reject real enquiries from a shared connection. The IP
 * limit is therefore set to catch scripted abuse (which is orders of magnitude
 * over the limit) rather than to bound honest use precisely.
 *
 * FAIL POSTURE — DELIBERATELY OPEN, AND THIS IS THE REASONED CHOICE
 * -----------------------------------------------------------------
 * If the KV store is unreachable, this returns `allowed` and logs at error.
 *
 * The audit criticises fail-open on the LOGIN limiter, and is right to: there,
 * failing open disables brute-force protection on credentials exactly when an
 * attacker may be causing the degradation. The trade here is different. These
 * are unauthenticated marketing forms; what fail-open admits is spam, while
 * fail-closed would silently drop genuine client enquiries — the revenue path —
 * every time KV blips. For a lead-capture form the cost of a lost enquiry
 * exceeds the cost of a spam entry an admin can delete, so the posture is open
 * and loud rather than closed and quiet. Revisit if spam volume ever makes the
 * other side of that trade cheaper.
 *
 * STILL OUTSTANDING (the other half of S11)
 * ------------------------------------------
 * Each check is a read-modify-write and is NOT atomic, so simultaneous requests
 * can both read the same count and both be admitted. Auth already has the
 * atomic path (`check_auth_rate_limit_91ed8379`, migration 20260821000001);
 * extending a Postgres-backed counter to these forms is a separate change with
 * its own migration, and is tracked as WS0.2's remaining half in
 * `docs/REFACTORING-ROADMAP.md`. The race admits a small burst — it does not
 * restore the unlimited-by-rotation hole this module closes.
 */
import { createKvRepository } from './repositories/kv-repository.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  extractClientIp,
  type HeaderGetter,
} from '../../../shared/submissions/blockedIpAddresses.ts';

const log = createModuleLogger('public-form-rate-limit');

/** Which public form is being limited. Also the KV namespace segment. */
export type PublicFormScope = 'contact' | 'quote' | 'consultation' | 'csp-report';

/** Submissions per email address per window. Matches the previous behaviour. */
export const EMAIL_LIMIT_PER_HOUR = 5;

/**
 * Submissions per IP per window. Higher than the email budget because one
 * address can legitimately front many people — see the note above.
 */
export const IP_LIMIT_PER_HOUR = 15;

/**
 * CSP violation reports per IP per window.
 *
 * Far above the form budgets because this is not a form: one page load on a
 * misconfigured policy legitimately produces several reports, and a browsing
 * session many. The purpose is not to capture every one — reports collapse by
 * fingerprint, so the marginal value of the sixtieth from one address is nil —
 * it is to stop an anonymous caller turning an unauthenticated endpoint into
 * unbounded KV writes and log volume.
 */
export const CSP_REPORT_IP_LIMIT_PER_HOUR = 60;

const WINDOW_MS = 60 * 60 * 1000;

interface RateBucket {
  timestamps: number[];
}

/**
 * Namespace keeps the historical `rate_limit:<scope>:<id>` key shape. That is a
 * contract, not a detail: `kv-cleanup-service.ts` sweeps expired entries by the
 * prefixes `rate_limit:contact:`, `rate_limit:quote:` and
 * `rate_limit:consultation:`, so changing the shape here would orphan every
 * bucket this module writes and leak KV rows forever.
 */
const buckets = createKvRepository<RateBucket>('rate_limit:');

export interface PublicFormRateLimitResult {
  allowed: boolean;
  /** Which dimension rejected the request. Absent when allowed. */
  limitedBy?: 'email' | 'ip';
}

/**
 * Record an attempt against one dimension and report whether it is over budget.
 *
 * Returns `null` when the store could not be consulted, which the caller treats
 * as "allow" per the fail posture documented above.
 */
async function consume(id: string, limit: number, now: number): Promise<boolean | null> {
  try {
    const existing = await buckets.get(id);
    const recent = Array.isArray(existing?.timestamps)
      ? existing.timestamps.filter((t) => now - t < WINDOW_MS)
      : [];

    if (recent.length >= limit) {
      // Deliberately NOT re-persisted: an over-limit caller must not be able to
      // extend their own window by continuing to hammer the endpoint.
      return false;
    }

    await buckets.put(id, { timestamps: [...recent, now] });
    return true;
  } catch (error) {
    log.error('Rate limit store unavailable; allowing submission (fail-open)', error);
    return null;
  }
}

/**
 * Check — and record — a public form submission against both dimensions.
 *
 * @param scope     which form, used as the KV namespace segment
 * @param email     the submitted address (rotatable by the caller — hence the IP dimension)
 * @param getHeader request header accessor, e.g. `(name) => c.req.header(name)`
 */
export async function checkPublicFormRateLimit(
  scope: PublicFormScope,
  email: string,
  getHeader: HeaderGetter,
): Promise<PublicFormRateLimitResult> {
  const now = Date.now();
  const normalizedEmail = email.trim().toLowerCase();

  const emailAllowed = await consume(`${scope}:${normalizedEmail}`, EMAIL_LIMIT_PER_HOUR, now);
  if (emailAllowed === false) {
    log.info('Public form rate limit exceeded (email)', { scope, email: normalizedEmail });
    return { allowed: false, limitedBy: 'email' };
  }

  const clientIp = extractClientIp(getHeader);
  if (!clientIp) {
    // No resolvable IP (local dev, or a proxy that strips the headers). The
    // email dimension still applied above; there is nothing further to check.
    return { allowed: true };
  }

  const ipAllowed = await consume(`${scope}:ip:${clientIp}`, IP_LIMIT_PER_HOUR, now);
  if (ipAllowed === false) {
    log.warn('Public form rate limit exceeded (ip)', { scope, clientIp });
    return { allowed: false, limitedBy: 'ip' };
  }

  return { allowed: true };
}

/**
 * IP-only variant, for endpoints with no submitter identity to bucket on.
 *
 * `checkPublicFormRateLimit` needs an email because a form has one and an
 * address is the more meaningful dimension. A CSP report has neither: the
 * browser sends it, from a page a visitor may not be signed in to. Passing an
 * empty email there would bucket every caller under one key and let a single
 * bot exhaust the budget for everyone, so this takes the IP dimension alone.
 *
 * Fail-open, like `consume`: if the bucket store cannot be reached the request
 * proceeds. A store that is down will fail the subsequent write anyway, and
 * refusing all reports on a transient hiccup loses the evidence this endpoint
 * exists to collect.
 */
export async function checkIpOnlyRateLimit(
  scope: PublicFormScope,
  getHeader: HeaderGetter,
  limit: number,
): Promise<PublicFormRateLimitResult> {
  const clientIp = extractClientIp(getHeader);
  if (!clientIp) {
    // No resolvable IP (local dev, or a proxy that strips the headers). There
    // is no other dimension to fall back to here.
    return { allowed: true };
  }

  const allowed = await consume(`${scope}:ip:${clientIp}`, limit, Date.now());
  if (allowed === false) {
    log.warn('IP rate limit exceeded', { scope, clientIp, limit });
    return { allowed: false, limitedBy: 'ip' };
  }
  return { allowed: true };
}
