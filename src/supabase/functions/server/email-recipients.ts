/**
 * email-recipients.ts — CC/recipient list hygiene shared by every send path.
 *
 * WHY THIS EXISTS
 * ---------------
 * Both providers reject the WHOLE message — not just the offending address —
 * when a personalization block is malformed. SendGrid's rule is the sharp one:
 * "Each email address in the personalization block should be unique between to,
 * cc, and bcc", returned as a 400. So a single CC that repeats the To address
 * (CC info@ on a message addressed to info@), or one stray "" left by a
 * trailing comma in a comma-separated CC field, silently kills the send for the
 * primary recipient too.
 *
 * `documents-email-routes.ts` already carried a one-off guard for exactly that
 * case (the admin-CC-equals-client-email check). This module generalises it so
 * every send path gets the same treatment, and — critically — so a bad CC
 * DEGRADES the send (that address is dropped and reported) rather than failing
 * it. A communication reaching the client without one CC is recoverable; a
 * communication that never leaves is not.
 */

/**
 * Deliberately permissive: this is a "would a provider choke on it" gate, not
 * RFC 5322. Anything with a local part, a single @, and a dotted domain passes.
 */
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

export interface NormalizedRecipients {
  /** Clean, de-duplicated, provider-safe addresses, in first-seen order. */
  accepted: string[];
  /**
   * Entries that were thrown away, with the reason, so callers can tell the
   * admin "we sent it, but we could not CC <x>" instead of silently losing it.
   */
  dropped: Array<{ value: string; reason: 'invalid' | 'duplicate' | 'excluded' }>;
}

/** `Navigate Wealth <info@navigatewealth.co>` → `info@navigatewealth.co`. */
function extractAddress(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim();
}

export function isValidEmailAddress(value: unknown): boolean {
  return typeof value === 'string' && EMAIL_RE.test(extractAddress(value).toLowerCase());
}

/**
 * Normalize an arbitrary CC-ish input into a list the email transport can be
 * handed without risking a whole-message rejection.
 *
 * Accepts what the compose UI actually produces: an array, or a single
 * comma/semicolon-separated string, with display names and stray whitespace.
 *
 * @param input    Raw CC value from a request body.
 * @param exclude  Addresses that must not appear (normally the To address).
 * @param limit    Hard cap on accepted addresses; the rest are dropped as
 *                 'invalid' rather than growing an unbounded envelope.
 */
export function normalizeEmailList(
  input: unknown,
  exclude: Array<string | undefined | null> = [],
  limit = 25,
): NormalizedRecipients {
  const raw: string[] = Array.isArray(input)
    ? input.flatMap((entry) => (typeof entry === 'string' ? entry.split(/[,;]/) : []))
    : typeof input === 'string'
      ? input.split(/[,;]/)
      : [];

  const excluded = new Set(
    exclude
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => extractAddress(value).toLowerCase()),
  );

  const seen = new Set<string>();
  const accepted: string[] = [];
  const dropped: NormalizedRecipients['dropped'] = [];

  for (const entry of raw) {
    const trimmed = entry.trim();
    if (!trimmed) continue; // trailing comma — nothing to report

    const address = extractAddress(trimmed);
    const key = address.toLowerCase();

    if (!EMAIL_RE.test(key)) {
      dropped.push({ value: trimmed, reason: 'invalid' });
      continue;
    }
    if (excluded.has(key)) {
      dropped.push({ value: address, reason: 'excluded' });
      continue;
    }
    if (seen.has(key)) {
      dropped.push({ value: address, reason: 'duplicate' });
      continue;
    }
    if (accepted.length >= limit) {
      dropped.push({ value: address, reason: 'invalid' });
      continue;
    }

    seen.add(key);
    accepted.push(address);
  }

  return { accepted, dropped };
}

/** Human-readable summary of dropped addresses, for toasts and logs. */
export function describeDroppedRecipients(dropped: NormalizedRecipients['dropped']): string {
  if (dropped.length === 0) return '';
  const reasonLabel: Record<NormalizedRecipients['dropped'][number]['reason'], string> = {
    invalid: 'not a valid email address',
    duplicate: 'listed more than once',
    excluded: 'already the primary recipient',
  };
  return dropped.map((d) => `${d.value} (${reasonLabel[d.reason]})`).join(', ');
}
