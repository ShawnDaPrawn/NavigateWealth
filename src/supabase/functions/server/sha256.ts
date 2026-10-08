/**
 * Lowercase hex SHA-256 digest of a UTF-8 string. Used for request-body
 * hashes (idempotency, SES SigV4) and for storing one-time codes as hashes.
 *
 * Deliberately its own module rather than part of crypto-utils.ts: the email
 * transport needs it, and router-auth-guard.test.ts treats the secret-compare
 * helper in crypto-utils.ts as an auth marker, so importing that file from the
 * transport would make every public router that sends email look
 * authenticated. Keep this file free of the marker names that test lists.
 */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
