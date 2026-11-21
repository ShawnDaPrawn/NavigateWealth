import { Buffer } from 'node:buffer';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import type { CredentialInput, VaultSummary } from '../../../../shared/password-manager.ts';
import { createKvRepository } from './kv-repository.ts';

interface Envelope {
  iv: string;
  ciphertext: string;
}
export interface VaultEntry {
  id: string;
  revision: string;
  metadata: Envelope;
  secret: Envelope;
  connection: { hash: string; expiresAt: string } | null;
}
export const entries = createKvRepository<VaultEntry>('password-vault:');

function db() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

let importedKey: Promise<CryptoKey> | undefined;

function key() {
  importedKey ??= loadKey().catch((error) => {
    importedKey = undefined;
    throw error;
  });
  return importedKey;
}

async function loadKey() {
  const { data: raw, error } = await db().rpc('password_manager_encryption_key');
  if (error || typeof raw !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw new Error('Password vault encryption key is not configured');
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(value: unknown, context: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
    await key(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(encrypted).toString('base64'),
  };
}

async function open<T>(value: Envelope, context: string): Promise<T> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(Buffer.from(value.iv, 'base64')),
      additionalData: new TextEncoder().encode(context),
    },
    await key(),
    Uint8Array.from(Buffer.from(value.ciphertext, 'base64')),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function encryptFields(
  id: string,
  { name, url, username, password, notes, portal }: CredentialInput,
) {
  const metadata = await seal(
    { name: name || new URL(url).hostname, url, username, portal },
    id + '/metadata',
  );
  const secret = await seal({ password, notes }, id + '/secret');
  return { metadata, secret };
}

export async function summary(entry: VaultEntry): Promise<VaultSummary> {
  const metadata = await open<Pick<CredentialInput, 'name' | 'url' | 'username' | 'portal'>>(
    entry.metadata,
    entry.id + '/metadata',
  );
  return {
    ...metadata,
    id: entry.id,
    revision: entry.revision,
    connectionExpiresAt: entry.connection?.expiresAt ?? null,
  };
}

export function reveal(entry: VaultEntry) {
  return open<Pick<CredentialInput, 'password' | 'notes'>>(entry.secret, entry.id + '/secret');
}

// Conditional UPDATE cannot recreate a deleted entry or restore a revoked token
// while another administrator is rotating the credential.
export async function replace(entry: VaultEntry, expectedRevision: string) {
  const { data, error } = await db()
    .from('kv_store_91ed8379')
    .update({ value: entry })
    .eq('key', entries.key(entry.id))
    .eq('value->>revision', expectedRevision)
    .select('key');
  if (error) throw new Error('Password vault update failed');
  return Boolean(data?.length);
}
