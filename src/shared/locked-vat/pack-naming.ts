/**
 * Submission-pack file naming — pure helpers.
 *
 * Evidence files inside the SARS pack are renamed so a verifier can walk the
 * schedule line-by-line to the matching file. Locked-owned shared module
 * (tested with Vitest, consumed by the edge pack generator); deleted together
 * with the locked module.
 *
 * @module shared/locked-vat/pack-naming
 */

/** Filesystem-safe fragment: alphanumerics and dashes only. */
export function sanitizeFragment(value: string, maxLength = 40): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return cleaned || 'unnamed';
}

export interface EvidenceNameTxn {
  date: string;
  description?: string;
  reference?: string;
  counterparty?: { name: string };
}

export interface EvidenceNameAttachment {
  kind: string;
  fileName: string;
}

/**
 * Consistent evidence file name so a verifier can walk schedule → file:
 * `{date}_{counterparty}_{reference}_{kind}[.n].{ext}`
 */
export function evidenceFileName(
  txn: EvidenceNameTxn,
  attachment: EvidenceNameAttachment,
  duplicateIndex = 0,
): string {
  const who = sanitizeFragment(txn.counterparty?.name || txn.description || 'transaction');
  const ref = txn.reference ? `_${sanitizeFragment(txn.reference, 20)}` : '';
  const ext = attachment.fileName.includes('.')
    ? attachment.fileName.split('.').pop()!.toLowerCase()
    : 'bin';
  const suffix = duplicateIndex > 0 ? `.${duplicateIndex}` : '';
  return `${txn.date}_${who}${ref}_${attachment.kind.replace(/_/g, '-')}${suffix}.${ext}`;
}
