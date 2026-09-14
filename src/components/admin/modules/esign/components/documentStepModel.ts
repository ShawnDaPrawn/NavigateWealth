/**
 * Shape and validation rules for the wizard's documents step.
 *
 * Separate from `DocumentUploadStep.tsx` on purpose: the step itself is
 * lazy-loaded (it is the entry to a heavy chunk), but the wizard shell around
 * it has to know — before that chunk resolves — whether Continue is allowed
 * and what to tell the user when it is not. Keeping the rule here lets the
 * shell import it eagerly without dragging the step's chunk along.
 */

export interface DocumentUploadValue {
  files: File[];
  title: string;
  message: string;
  expiryDays: number;
}

export const MAX_ENVELOPE_MESSAGE_LENGTH = 500;
export const MIN_EXPIRY_DAYS = 1;
export const MAX_EXPIRY_DAYS = 365;
export const DEFAULT_EXPIRY_DAYS = 30;

/**
 * What still stops this step from being finished, phrased for the wizard's
 * footer hint. `null` once the step is ready to continue.
 *
 * One rule, read by both the step and the shell's Continue button — the step
 * used to let the click through and then answer with an error, which is a
 * worse way to learn that a title is missing.
 */
export function documentStepBlocker(value: DocumentUploadValue): string | null {
  if (value.files.length === 0) return 'Add at least one PDF to continue.';
  if (!value.title.trim()) return 'Give the envelope a title to continue.';
  if (!isValidExpiry(value.expiryDays)) {
    return `Expiry must be between ${MIN_EXPIRY_DAYS} and ${MAX_EXPIRY_DAYS} days.`;
  }
  return null;
}

export function isValidExpiry(expiryDays: number): boolean {
  return (
    Number.isFinite(expiryDays) && expiryDays >= MIN_EXPIRY_DAYS && expiryDays <= MAX_EXPIRY_DAYS
  );
}
