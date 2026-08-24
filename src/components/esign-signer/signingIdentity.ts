/**
 * Signer identity helpers.
 *
 * Pulled out of SigningWorkflow.tsx, which was over the 1,000-line budget, and
 * because these are the only pure logic in that file: everything else there is
 * bound to pdf.js canvas rendering that jsdom cannot exercise, which is why the
 * component has no tests. These now do.
 *
 * The ID checksum in particular is worth pinning — it decides whether a signer
 * is allowed to proceed on a legally binding document.
 */
/** Validate a 13-digit South African ID number with the Luhn-variant
 *  checksum used by Home Affairs. Returns true for valid IDs. */
export function isValidSaId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  // Sum odd-positioned digits (1st, 3rd, ...) — index 0,2,4,...
  let oddSum = 0;
  for (let i = 0; i < 12; i += 2) oddSum += Number(digits[i]);
  // Concatenate even-positioned digits and double, then sum each digit.
  let evenConcat = '';
  for (let i = 1; i < 12; i += 2) evenConcat += digits[i];
  const evenDoubled = String(Number(evenConcat) * 2);
  let evenSum = 0;
  for (const ch of evenDoubled) evenSum += Number(ch);
  const total = oddSum + evenSum;
  const checkDigit = (10 - (total % 10)) % 10;
  return checkDigit === Number(digits[12]);
}

/** Format a string of digits as "YYMMDD SSSS C AZ" (SA ID grouping). */
export function maskSaId(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 6));
  if (d.length > 6) parts.push(d.slice(6, 10));
  if (d.length > 10) parts.push(d.slice(10, 11));
  if (d.length > 11) parts.push(d.slice(11, 13));
  return parts.join(' ');
}

/** localStorage key for in-progress signatures (keyed by signing token). */
export const inProgressKey = (token: string) => `nw-esign-inprogress:${token}`;
