/**
 * P6.4 — ECTA consent text registry + versioning.
 *
 * The signing UI must present an ECTA-compliant consent prompt and
 * record which exact version of that text the signer agreed to. Once a
 * version is "active", it is immutable — editing the text creates a new
 * version and leaves every historical signer stamped against the copy
 * they actually saw. This keeps the evidence package legally defensible
 * even after product / legal revisions to the wording.
 *
 * Storage layout (KV):
 *   esign:consent:active         → currently active version id
 *   esign:consent:version:<id>   → ConsentVersion record
 *   esign:consent:versions       → ordered list of version ids (oldest → newest)
 *
 * Consumers:
 *   • `getActiveConsent()` — called at envelope send-time; stamped onto
 *     `EsignEnvelope.consent_version` so all signers for that envelope
 *     see the same text even if a newer version is published mid-flight.
 *   • `getConsentByVersion()` — called by the certificate renderer so
 *     the evidence page can inline the exact wording the signer saw.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-consent-registry');

const ACTIVE_KEY = 'esign:consent:active';
const VERSION_KEY = (id: string) => `esign:consent:version:${id}`;
const INDEX_KEY = 'esign:consent:versions';

export interface ConsentVersion {
  /** Stable short slug, e.g. "v1.0.0". Also the version id. */
  id: string;
  /** ECTA/POPIA-aligned consent text shown to the signer. */
  text: string;
  /** Short human summary surfaced in the admin registry UI. */
  summary?: string;
  /** Who published this version. */
  published_by: string;
  /** ISO-8601 publication timestamp. Immutable once set. */
  published_at: string;
}

/**
 * Seed a baseline ECTA consent entry on first access so the signer UI
 * always has something to present. Keeps the first-run experience
 * predictable without requiring an out-of-band admin action.
 */
const BASELINE_TEXT =
  'I agree to sign this document electronically. I understand that my ' +
  'electronic signature is the legal equivalent of my handwritten ' +
  'signature under the Electronic Communications and Transactions Act 25 ' +
  'of 2002 (ECTA) of South Africa, and that Navigate Wealth may retain ' +
  'an electronic copy of the signed document and associated audit trail ' +
  'for evidentiary purposes.';

async function seedBaselineIfMissing(): Promise<string> {
  const index = await kv.get(INDEX_KEY);
  if (Array.isArray(index) && index.length > 0) {
    const existing = await kv.get(ACTIVE_KEY);
    if (typeof existing === 'string') return existing;
  }

  const id = 'v1.0.0';
  const now = new Date().toISOString();
  const record: ConsentVersion = {
    id,
    text: BASELINE_TEXT,
    summary: 'Initial ECTA-aligned consent wording.',
    published_by: 'system',
    published_at: now,
  };

  await kv.set(VERSION_KEY(id), record);
  await kv.set(INDEX_KEY, [id]);
  await kv.set(ACTIVE_KEY, id);
  log.info(`Seeded baseline consent version ${id}`);
  return id;
}

/** Return the currently active consent version, seeding if necessary. */
export async function getActiveConsent(): Promise<ConsentVersion> {
  const activeId = (await kv.get(ACTIVE_KEY)) as string | null;
  const id = activeId || (await seedBaselineIfMissing());
  const record = (await kv.get(VERSION_KEY(id))) as ConsentVersion | null;
  if (record) return record;
  const fallbackId = await seedBaselineIfMissing();
  return (await kv.get(VERSION_KEY(fallbackId))) as ConsentVersion;
}

/**
 * Resolve a consent record by version id. Falls back to the active
 * version when the requested id is missing so the cert renderer never
 * blows up on legacy envelopes.
 */
export async function getConsentByVersion(versionId: string | undefined | null): Promise<ConsentVersion> {
  if (versionId) {
    const record = (await kv.get(VERSION_KEY(versionId))) as ConsentVersion | null;
    if (record) return record;
  }
  return getActiveConsent();
}

/** List every consent version in publication order (oldest → newest). */
export async function listConsentVersions(): Promise<ConsentVersion[]> {
  await seedBaselineIfMissing();
  const index = (await kv.get(INDEX_KEY)) as string[] | null;
  const ids = Array.isArray(index) ? index : [];
  const records = await Promise.all(ids.map((id) => kv.get(VERSION_KEY(id))));
  return records.filter((r): r is ConsentVersion => !!r && typeof r === 'object');
}

/**
 * Publish a new consent version and immediately activate it. The
 * previous version stays retrievable by id; historical envelopes keep
 * their stamped version so the audit trail remains truthful.
 */
export async function publishConsentVersion(params: {
  id: string;
  text: string;
  summary?: string;
  publishedBy: string;
}): Promise<ConsentVersion> {
  const id = params.id.trim();
  if (!id) throw new Error('Consent version id is required');
  if (!params.text.trim()) throw new Error('Consent text is required');

  const existing = (await kv.get(VERSION_KEY(id))) as ConsentVersion | null;
  if (existing) {
    throw new Error(`Consent version ${id} already exists and is immutable`);
  }

  const record: ConsentVersion = {
    id,
    text: params.text.trim(),
    summary: params.summary?.trim(),
    published_by: params.publishedBy,
    published_at: new Date().toISOString(),
  };

  await kv.set(VERSION_KEY(id), record);

  const index = (await kv.get(INDEX_KEY)) as string[] | null;
  const updated = Array.isArray(index) ? [...index, id] : [id];
  await kv.set(INDEX_KEY, updated);
  await kv.set(ACTIVE_KEY, id);

  log.info(`Published consent version ${id}`);
  return record;
}

/** Select a pre-existing consent version as the active one. */
export async function setActiveConsent(versionId: string): Promise<ConsentVersion> {
  const record = (await kv.get(VERSION_KEY(versionId))) as ConsentVersion | null;
  if (!record) throw new Error(`Consent version ${versionId} not found`);
  await kv.set(ACTIVE_KEY, versionId);
  log.info(`Activated consent version ${versionId}`);
  return record;
}
