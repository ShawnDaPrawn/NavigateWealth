import { Buffer } from 'node:buffer';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import {
  BROKERAGE_COLLECTION_ID,
  NAVIGATE_WEALTH_SERVICE_ID,
  type AiExposure,
  type AiUse,
  type Collection,
  type CredentialInput,
  type VaultSummary,
} from '../../../../shared/password-manager.ts';
import type { PortalProfile } from '../../../../shared/broker-operations.ts';
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
  /** Which key sealed this entry: absent or 'master' for entries written before collections. */
  keyRef?: string;
  collectionId?: string;
  passwordChangedAt?: string | null;
  exposure?: AiExposure[];
}
export interface StoredCollection extends Collection {
  wrappedKey: Envelope;
}
interface Metadata {
  serviceId?: string;
  name: string;
  url: string;
  username: string;
  /** Retired broker-reporting profile; read for the dormant broker backend only. */
  portal?: PortalProfile;
  aiUse?: AiUse;
  rotateMonths?: number;
  fingerprint?: string;
  weak?: boolean;
  hasOtp?: boolean;
}
export interface Secret {
  password: string;
  notes: string;
  otpSecret?: string;
}

export const entries = createKvRepository<VaultEntry>('password-vault:');
export const collections = createKvRepository<StoredCollection>('pvault-collection:');
const TABLE = 'kv_store_91ed8379';

export function db() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

// ── Keys ─────────────────────────────────────────────────────────────────────
// One master key lives in Supabase Vault. Each collection has its own data key,
// sealed by the master key, so a connection scoped to one collection only ever
// unwraps that collection's key. Entries written before collections existed are
// still sealed by the master key (`keyRef` absent) and move to their
// collection's key the next time they are saved.

interface MasterKeys {
  aes: CryptoKey;
  hmac: CryptoKey;
}
let master: Promise<MasterKeys> | undefined;
const collectionKeys = new Map<string, Promise<CryptoKey>>();

function masterKeys() {
  master ??= loadMaster().catch((error) => {
    master = undefined;
    throw error;
  });
  return master;
}

async function loadMaster(): Promise<MasterKeys> {
  const { data: raw, error } = await db().rpc('password_manager_encryption_key');
  if (error || typeof raw !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw new Error('Password vault encryption key is not configured');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return {
    aes: await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']),
    hmac: await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]),
  };
}

async function sealWith(key: CryptoKey, value: unknown, context: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(encrypted).toString('base64'),
  };
}

async function openWith<T>(key: CryptoKey, value: Envelope, context: string): Promise<T> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(Buffer.from(value.iv, 'base64')),
      additionalData: new TextEncoder().encode(context),
    },
    key,
    Uint8Array.from(Buffer.from(value.ciphertext, 'base64')),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/** Insert a KV row only when its key is free. False when it already exists. */
export async function insertIfAbsent(key: string, value: unknown) {
  const { error } = await db().from(TABLE).insert({ key, value });
  if (error && error.code !== '23505') throw new Error('Password vault write failed');
  return !error;
}

async function newCollectionRecord(
  id: string,
  fields: Omit<Collection, 'id' | 'createdAt'>,
): Promise<StoredCollection> {
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  return {
    id,
    ...fields,
    createdAt: new Date().toISOString(),
    wrappedKey: await sealWith((await masterKeys()).aes, raw, 'collection/' + id),
  };
}

/** The firm-wide collection, created on first use. Safe under concurrent first calls. */
export async function ensureBrokerage(): Promise<StoredCollection> {
  const existing = await collections.get(BROKERAGE_COLLECTION_ID);
  if (existing) return existing;
  const row = await newCollectionRecord(BROKERAGE_COLLECTION_ID, {
    name: 'Brokerage',
    kind: 'brokerage',
    ownerUserId: null,
    ownerName: 'Navigate Wealth',
  });
  if (await insertIfAbsent(collections.key(row.id), row)) return row;
  return (await collections.get(BROKERAGE_COLLECTION_ID))!;
}

async function collectionKey(id: string): Promise<CryptoKey> {
  let key = collectionKeys.get(id);
  if (!key) {
    key = (async () => {
      const row =
        id === BROKERAGE_COLLECTION_ID ? await ensureBrokerage() : await collections.get(id);
      if (!row) throw new VaultInputError('Unknown collection');
      const raw = await openWith<string>(
        (await masterKeys()).aes,
        row.wrappedKey,
        'collection/' + id,
      );
      return crypto.subtle.importKey(
        'raw',
        Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
        'AES-GCM',
        false,
        ['encrypt', 'decrypt'],
      );
    })().catch((error) => {
      collectionKeys.delete(id);
      throw error;
    });
    collectionKeys.set(id, key);
  }
  return key;
}

async function keyFor(entry: Pick<VaultEntry, 'keyRef'>) {
  return !entry.keyRef || entry.keyRef === 'master'
    ? (await masterKeys()).aes
    : collectionKey(entry.keyRef);
}

export class VaultInputError extends Error {}

// ── Entries ──────────────────────────────────────────────────────────────────

/** Rough strength: 12+ characters from at least three character classes. */
export function isWeak(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) =>
    r.test(password),
  ).length;
  return password.length < 12 || classes < 3;
}

async function fingerprint(password: string) {
  const mac = await crypto.subtle.sign(
    'HMAC',
    (await masterKeys()).hmac,
    new TextEncoder().encode('fingerprint/' + password),
  );
  return Buffer.from(mac).toString('hex').slice(0, 32);
}

export async function encryptFields(id: string, input: CredentialInput) {
  const collectionId = input.collectionId || BROKERAGE_COLLECTION_ID;
  const key = await collectionKey(collectionId);
  const metadata: Metadata = {
    serviceId: input.serviceId,
    name: input.name || new URL(input.url).hostname,
    url: input.url,
    username: input.username,
    aiUse: input.aiUse ?? 'ask',
    rotateMonths: input.rotateMonths ?? 12,
    fingerprint: await fingerprint(input.password),
    weak: isWeak(input.password),
    hasOtp: Boolean(input.otpSecret),
  };
  const secret: Secret = { password: input.password, notes: input.notes };
  if (input.otpSecret) secret.otpSecret = input.otpSecret;
  return {
    keyRef: collectionId,
    collectionId,
    metadata: await sealWith(key, metadata, id + '/metadata'),
    secret: await sealWith(key, secret, id + '/secret'),
  };
}

export async function sealSecret(entry: VaultEntry, secret: Secret) {
  return sealWith(await keyFor(entry), secret, entry.id + '/secret');
}

export async function sealMetadataPatch(entry: VaultEntry, patch: Partial<Metadata>) {
  const key = await keyFor(entry);
  const current = await openWith<Metadata>(key, entry.metadata, entry.id + '/metadata');
  return sealWith(key, { ...current, ...patch }, entry.id + '/metadata');
}

export async function passwordFingerprint(password: string) {
  return fingerprint(password);
}

/** Decrypted summary plus the fingerprint used to spot reused passwords. */
export async function decode(
  entry: VaultEntry,
): Promise<{ summary: VaultSummary; fingerprint: string }> {
  const m = await openWith<Metadata>(await keyFor(entry), entry.metadata, entry.id + '/metadata');
  const rotateMonths = m.rotateMonths ?? 12;
  const changed = entry.passwordChangedAt ?? null;
  const exposure = entry.exposure ?? [];
  const lastExposure = exposure.at(-1)?.at;
  return {
    fingerprint: m.fingerprint ?? '',
    summary: {
      id: entry.id,
      revision: entry.revision,
      serviceId: m.serviceId ?? NAVIGATE_WEALTH_SERVICE_ID,
      name: m.name,
      url: m.url,
      username: m.username,
      ...(m.portal ? { portal: m.portal } : {}),
      collectionId: entry.collectionId ?? BROKERAGE_COLLECTION_ID,
      aiUse: m.aiUse ?? 'ask',
      rotateMonths,
      passwordChangedAt: changed,
      hasOtp: m.hasOtp ?? false,
      seenByAi: exposure,
      health: {
        reused: false,
        weak: m.weak ?? false,
        stale: Boolean(
          rotateMonths &&
          changed &&
          Date.now() - Date.parse(changed) > rotateMonths * 30.44 * 86400000,
        ),
        exposed: Boolean(lastExposure && (!changed || lastExposure > changed)),
      },
    },
  };
}

export async function summary(entry: VaultEntry): Promise<VaultSummary> {
  return (await decode(entry)).summary;
}

/** Marks reused passwords across a set of decoded entries. */
export function markReused(rows: { summary: VaultSummary; fingerprint: string }[]) {
  const counts = new Map<string, number>();
  for (const r of rows)
    if (r.fingerprint) counts.set(r.fingerprint, (counts.get(r.fingerprint) ?? 0) + 1);
  return rows.map((r) => ({
    ...r.summary,
    health: { ...r.summary.health, reused: (counts.get(r.fingerprint) ?? 0) > 1 },
  }));
}

export async function revealSecret(entry: VaultEntry): Promise<Secret> {
  return openWith<Secret>(await keyFor(entry), entry.secret, entry.id + '/secret');
}

export async function reveal(entry: VaultEntry): Promise<Pick<Secret, 'password' | 'notes'>> {
  const { password, notes } = await revealSecret(entry);
  return { password, notes };
}

// Conditional UPDATE cannot recreate a deleted entry while another
// administrator is changing the credential.
export async function replace(entry: VaultEntry, expectedRevision: string) {
  const { data, error } = await db()
    .from(TABLE)
    .update({ value: entry })
    .eq('key', entries.key(entry.id))
    .eq('value->>revision', expectedRevision)
    .select('key');
  if (error) throw new Error('Password vault update failed');
  return Boolean(data?.length);
}

/** Every entry, decoded, with reuse marked. The vault is small; this is deliberate. */
export async function allSummaries() {
  const rows = await entries.listAll('password vault: decode every entry for health and scoping');
  const decoded = await Promise.all(rows.map(async (e) => ({ entry: e, ...(await decode(e)) })));
  const marked = markReused(decoded);
  return decoded.map((d, i) => ({ entry: d.entry, summary: marked[i] }));
}

/** Records that an AI connection saw a credential's password. */
export async function recordExposure(entry: VaultEntry, exposure: AiExposure) {
  const next = {
    ...entry,
    exposure: [...(entry.exposure ?? []), exposure].slice(-20),
    revision: crypto.randomUUID(),
  };
  return (await replace(next, entry.revision)) ? next : null;
}
