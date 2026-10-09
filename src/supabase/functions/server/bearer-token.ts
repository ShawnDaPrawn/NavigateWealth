/**
 * The credential in an Authorization header, read the lenient way.
 *
 * A leading "Bearer" (any letter case) and the whitespace after it are
 * removed. A header WITHOUT that prefix is returned whole, so a caller that
 * sends the bare token still works; this is the rule these routes have
 * always applied, and some scheduled callers depend on it. No trimming is
 * done here: the call sites that trim do so themselves.
 *
 * This is deliberately not the strict reading some guards use (an exact
 * "Bearer " prefix or nothing). Those keep their own check, because moving
 * them onto this one would accept headers they refuse today.
 */
export function stripBearerPrefix(header: string): string;
export function stripBearerPrefix(header: string | undefined): string | undefined;
export function stripBearerPrefix(header: string | undefined): string | undefined {
  return header?.replace(/^Bearer\s+/i, '');
}
