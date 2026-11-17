/**
 * Checks run before an envelope leaves the studio.
 *
 * The only check used to be "at least one field". Anything else went out
 * broken: a field pointing at a removed recipient was quietly handed to
 * recipient 1 by the send path, a recipient with no signature field was
 * invited to sign nothing, and a dropdown with no options blocked the signer
 * from ever finishing.
 *
 * `blocking` issues stop the send. `warnings` are shown and the sender may
 * send anyway.
 */
import type { EsignField, SignerFormData } from '../types';
import { findRecipient } from '../recipientIdentity';

export interface PreflightResult {
  blocking: string[];
  warnings: string[];
  /** Fields that match no recipient — selected for the sender to fix. */
  unassignedFieldIds: string[];
}

const SIGNING_TYPES = new Set(['signature', 'initials']);

export function preflightIssues(
  fields: EsignField[],
  signers: SignerFormData[],
  options: { isTemplate?: boolean } = {},
): PreflightResult {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const eligible = signers.filter((s) => s.kind !== 'cc');

  if (fields.length === 0) {
    blocking.push('Place at least one field.');
  }

  const unassigned = fields.filter((f) => !findRecipient(eligible, f.signer_id));
  if (unassigned.length > 0) {
    blocking.push(
      `${unassigned.length} field${unassigned.length === 1 ? ' is' : 's are'} not assigned to a recipient. ` +
        'Select ' +
        (unassigned.length === 1 ? 'it' : 'them') +
        ' and choose who completes ' +
        (unassigned.length === 1 ? 'it' : 'them') +
        ' in Assigned To.',
    );
  }

  const noOptions = fields.filter((f) => {
    if (f.type !== 'dropdown' && f.type !== 'radio') return false;
    const opts = ((f.metadata ?? {}) as { options?: unknown }).options;
    const valid = Array.isArray(opts) ? opts.filter((o) => typeof o === 'string' && o.trim()) : [];
    return valid.length < 2;
  });
  if (noOptions.length > 0) {
    blocking.push(
      `${noOptions.length} dropdown or choice field${noOptions.length === 1 ? ' has' : 's have'} fewer than two options, so the signer could not finish.`,
    );
  }

  if (!options.isTemplate) {
    for (const s of eligible) {
      const own = fields.filter((f) => findRecipient(eligible, f.signer_id) === s);
      const label = s.name || s.email || 'A recipient';
      if (own.length === 0) {
        warnings.push(`${label} has no fields, so they will have nothing to sign.`);
      } else if (!own.some((f) => SIGNING_TYPES.has(f.type))) {
        warnings.push(`${label} has no signature or initials field.`);
      }
    }
  }

  return { blocking, warnings, unassignedFieldIds: unassigned.map((f) => f.id) };
}
