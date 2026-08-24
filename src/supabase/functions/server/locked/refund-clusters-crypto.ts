/**
 * Secret encryption for refund clusters (AES-256-GCM). eFiling and online
 * banking passwords are encrypted here before any record is written to KV;
 * plaintext leaves only through the audited reveal endpoints. Moved verbatim
 * from refund-clusters-service.ts.
 */
import type { EncryptedSecret } from './refund-clusters-model.ts';

const b64encode = (bytes: Uint8Array): string => {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
};

const b64decode = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));

let cachedKey: CryptoKey | null = null;

/**
 * Resolve the AES-256 vault key.
 *
 * Preferred source is the dedicated NW_REFUND_VAULT_KEY secret (any string
 * ≥ 32 chars, or base64). When unset we fall back to a key derived from the
 * service-role key via SHA-256 with a feature-specific salt, so the feature
 * works out of the box while still keeping secrets unreadable in a raw KV
 * dump. Rotating either source invalidates previously stored passwords —
 * they can simply be re-captured through the UI.
 */
async function getVaultKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const material =
    Deno.env.get('NW_REFUND_VAULT_KEY') ||
    `nw-refund-clusters-v1:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  if (material.length < 32) {
    throw new Error('Refund vault key material is too short');
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  cachedKey = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return cachedKey;
}

export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { v: 1, iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) };
}

export async function decryptSecret(secret: EncryptedSecret): Promise<string> {
  const key = await getVaultKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(secret.iv) as BufferSource },
    key,
    b64decode(secret.ct) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}
