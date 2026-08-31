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

/**
 * Why an entry did not make it onto the envelope as its own CC.
 *
 * The split that matters to a caller is whether the PERSON still receives the
 * message. `duplicate` and `excluded` mean they do — once, or as the To address
 * — so reporting either as "not copied to" is simply wrong. Only `invalid` and
 * `limit` mean nothing reached them. `describeUndeliveredRecipients` draws that
 * line; `describeDroppedRecipients` reports everything and is for logs.
 */
export type DroppedRecipientReason = 'invalid' | 'duplicate' | 'excluded' | 'limit';

export interface DroppedRecipient {
  value: string;
  reason: DroppedRecipientReason;
}

export interface NormalizedRecipients {
  /** Clean, de-duplicated, provider-safe addresses, in first-seen order. */
  accepted: string[];
  /**
   * Entries that were thrown away, with the reason, so callers can tell the
   * admin "we sent it, but we could not CC <x>" instead of silently losing it.
   */
  dropped: DroppedRecipient[];
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
  const dropped: DroppedRecipient[] = [];

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
      dropped.push({ value: address, reason: 'limit' });
      continue;
    }

    seen.add(key);
    accepted.push(address);
  }

  return { accepted, dropped };
}

const REASON_LABEL: Record<DroppedRecipientReason, string> = {
  invalid: 'not a valid email address',
  duplicate: 'listed more than once',
  excluded: 'already the primary recipient',
  limit: 'over the CC limit for one message',
};

/** Every dropped address and why. For server logs — see the type doc above. */
export function describeDroppedRecipients(dropped: DroppedRecipient[]): string {
  if (dropped.length === 0) return '';
  return dropped.map((d) => `${d.value} (${REASON_LABEL[d.reason]})`).join(', ');
}

/**
 * Only the addresses that genuinely received nothing — the right thing to put
 * in front of an adviser as "we could not copy this in".
 *
 * A `duplicate` was copied (once) and an `excluded` address is the recipient
 * themselves, so both DID get the message. Reporting them made the compose
 * form claim `Not copied to: info@navigatewealth.co` on every encrypted send
 * with "CC Admin" ticked — that path passes the admin address both in the cc
 * list and via the ccAdmin flag, so it is always a duplicate.
 */
export function describeUndeliveredRecipients(dropped: DroppedRecipient[]): string {
  return describeDroppedRecipients(
    dropped.filter((d) => d.reason === 'invalid' || d.reason === 'limit'),
  );
}
