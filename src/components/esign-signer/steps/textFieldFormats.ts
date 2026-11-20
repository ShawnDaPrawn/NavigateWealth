/**
 * The text dialog's per-format words and keyboard, and the SA ID grouping it
 * shows while the signer types. Moved verbatim out of TextInputDialog.tsx so
 * the Navigator redesign's text dialog (src/site/sections/ESignDialogs.tsx)
 * uses the same ones.
 */

/** The SA ID as the signer types it, grouped for reading. */
export function maskSaId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 6) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
}

export const titleByFormat: Record<string, string> = {
  sa_id: 'Enter SA ID number',
  number: 'Enter a number',
  email: 'Enter your email address',
  phone: 'Enter your phone number',
  custom_regex: 'Enter required value',
  free_text: 'Enter text',
};
export const placeholderByFormat: Record<string, string> = {
  sa_id: '000000 0000 0 00',
  number: '0',
  email: 'name@example.com',
  phone: '+27 82 123 4567',
  custom_regex: 'Enter value...',
  free_text: 'Enter text...',
};
export const inputModeByFormat: Record<string, 'text' | 'numeric' | 'email' | 'tel'> = {
  sa_id: 'numeric',
  number: 'numeric',
  email: 'email',
  phone: 'tel',
  custom_regex: 'text',
  free_text: 'text',
};
