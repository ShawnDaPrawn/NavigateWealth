/**
 * Recipient identity for the e-sign wizard and field studio.
 *
 * A placed field records who completes it in `signer_id`. That used to be the
 * recipient's EMAIL, which broke three ordinary cases:
 *   - editing a recipient's email orphaned every field already placed for them;
 *   - two recipients sharing one address (spouses often do) were the same
 *     person to the studio — same colour, same fields, same send index;
 *   - removing a recipient left fields pointing at nobody, which the send
 *     path quietly gave to recipient 1.
 *
 * Each recipient now carries a stable `recipientKey`, created once and saved
 * with the draft. Fields store that key. Older drafts whose fields hold an
 * email still resolve: lookups try the key first, then the email.
 */
import type { EsignField, SignerFormData } from './types';

type RecipientLike = Pick<SignerFormData, 'email'> & { recipientKey?: string };

const makeId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

/** A new, never-reused recipient key. */
export const newRecipientKey = (): string => `r_${makeId()}`;

/** The value a field's `signer_id` stores for this recipient. */
export const recipientIdOf = (recipient: RecipientLike): string =>
  recipient.recipientKey || recipient.email;

/**
 * Index of the recipient a stored `signer_id` points at, or -1. Matches the
 * recipient key first; falls back to the email for fields placed before
 * recipients had keys.
 */
export function findRecipientIndex(
  recipients: readonly RecipientLike[],
  signerId: string | null | undefined,
): number {
  if (!signerId) return -1;
  const byKey = recipients.findIndex((r) => !!r.recipientKey && r.recipientKey === signerId);
  if (byKey >= 0) return byKey;
  return recipients.findIndex((r) => !!r.email && r.email === signerId);
}

/** The recipient a stored `signer_id` points at, if any. */
export function findRecipient<T extends RecipientLike>(
  recipients: readonly T[],
  signerId: string | null | undefined,
): T | undefined {
  const idx = findRecipientIndex(recipients, signerId);
  return idx >= 0 ? recipients[idx] : undefined;
}

/** True when the stored `signer_id` belongs to this recipient. */
export const isRecipient = (recipient: RecipientLike, signerId: string | null | undefined) =>
  !!signerId &&
  (recipient.recipientKey === signerId || (!!recipient.email && recipient.email === signerId));

/**
 * Give every recipient a key, keeping the ones they already have. Safe to
 * call on every update: fields placed against an email keep resolving
 * through the email fallback.
 */
export function withRecipientKeys(signers: SignerFormData[]): SignerFormData[] {
  let changed = false;
  const next = signers.map((s) => {
    if (s.recipientKey) return s;
    changed = true;
    return { ...s, recipientKey: newRecipientKey() };
  });
  return changed ? next : signers;
}

/**
 * Re-point fields at canonical recipient ids. A field stored against a
 * recipient's email is moved to that recipient's key; fields that match no
 * recipient are left alone (the pre-send check reports them).
 */
export function normaliseFieldRecipients(
  fields: EsignField[],
  signers: readonly RecipientLike[],
): EsignField[] {
  let changed = false;
  const next = fields.map((f) => {
    const r = findRecipient(signers, f.signer_id);
    if (!r) return f;
    const id = recipientIdOf(r);
    if (id === f.signer_id) return f;
    changed = true;
    return { ...f, signer_id: id };
  });
  return changed ? next : fields;
}
