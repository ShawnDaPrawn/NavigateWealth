/**
 * email-delivery-classification.ts — is a failed send the recipient's fault,
 * ours, or just bad luck?
 *
 * Lifted verbatim out of `publications-notification-state.ts` (which now
 * re-exports it, so every existing importer and its tests are untouched)
 * because the classification is not specific to article notifications: any send
 * path that wants to show an operator "rejected" versus "failed" needs the same
 * judgement. The client-communication module is the second caller.
 *
 * Pure functions only — no KV, no provider SDK, no publications types — so it
 * can be imported from anywhere on the edge without dragging a subsystem along.
 */

export type DeliveryFailureDisposition = 'retryable' | 'terminal';

export interface DeliveryFailureClassification {
  message: string;
  disposition: DeliveryFailureDisposition;
}

export function normalizeSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Unknown error';
}

/**
 * Sender-side conditions: the send failed because of OUR configuration or
 * account standing, and would fail identically for every recipient.
 *
 * These must never be attributed to a recipient. The SendGrid-era classifier
 * treated "not verified" as terminal, which is right for neither provider and
 * actively dangerous on SES: in the sandbox — where every account starts, and
 * where this platform sits until AWS grants production access — EVERY send
 * returns it. A campaign sent in that state would mark its entire audience
 * `failed_terminal`, unretryable, and the campaign would have to be rebuilt.
 *
 * Callers should stop the run and surface the message to an operator rather
 * than burn recipients against a problem no retry can fix.
 */
const SENDER_FAULT_PATTERNS = [
  // SES: sending identity unverified, or sandbox recipient-verification.
  'not verified',
  'identities failed the check',
  // SES/SendGrid: credentials wrong, missing, or lacking ses:SendEmail.
  'not authorized to perform',
  'accessdenied',
  'access denied',
  'signature',
  'security token',
  'credentials',
  // Provider config absent entirely (email-core's own guard message).
  'nw_ses_region',
  'sendgrid_api_key',
  // Account standing / quota — transient in principle, but per-recipient
  // retries cannot clear them and only burn the send budget.
  'account-level sending has been disabled',
  'sending has been paused',
  'daily message quota exceeded',
  'maximum sending rate exceeded',
  'throttl',
];

/**
 * True when a send failed for a sender-side reason — our identity, credentials,
 * account standing or quota — rather than anything about the recipient.
 */
export function isSenderConfigurationFailure(error: unknown): boolean {
  const lowerMessage = normalizeSendError(error).toLowerCase();
  return SENDER_FAULT_PATTERNS.some((pattern) => lowerMessage.includes(pattern));
}

export function classifyDeliveryFailure(error: unknown): DeliveryFailureClassification {
  const message = normalizeSendError(error);
  const lowerMessage = message.toLowerCase();

  const terminalPatterns = [
    'invalid email',
    'invalid address',
    'does not contain a valid address',
    'address is invalid',
    'bounce',
    'suppression',
    'unsubscribe',
    'spam report',
    'recipient is on the suppression list',
    'permission',
    'forbidden',
    'unauthorized',
    'from address does not match',
    'malformed',
    'bad request',
  ];

  if (terminalPatterns.some((pattern) => lowerMessage.includes(pattern))) {
    return { message, disposition: 'terminal' };
  }

  return { message, disposition: 'retryable' };
}
