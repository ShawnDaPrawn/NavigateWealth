/**
 * Refund Clusters Service
 *
 * Storage + crypto layer for the Locked → Accounts → Refund Clusters feature.
 * Clusters group "entities" (sole proprietors or companies) whose tax,
 * banking, identity and accounting details are captured for VAT refunds.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - eFiling passwords are encrypted at rest with AES-256-GCM before the
 *     record is written to KV. The plaintext NEVER leaves this module except
 *     through the explicit, audited `reveal` endpoint.
 *   - Sanitized records returned to the client carry only a
 *     `hasEfilingPassword` flag — never the ciphertext or plaintext.
 *   - Every mutation and sensitive read is recorded via AdminAuditService.
 *
 * KV layout:
 *   refund-clusters:cluster:{clusterId}            → RefundClusterRecord
 *   refund-clusters:entity:{clusterId}:{entityId}  → RefundEntityRecord
 *   refund-clusters:doc:{entityId}:{docId}         → RefundEntityDocument
 *
 * @module server/refund-clusters-service
 */

import * as kv from '../kv_store.tsx';
import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('refund-clusters');

// ============================================================================
// Types
// ============================================================================

export type RefundEntityType = 'sole_proprietor' | 'company';
export type VatPeriodCategory = 'A' | 'B' | 'C';

export interface BankAccountDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

export interface RefundClusterRecord {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PersonalDetails {
  name: string;
  surname: string;
  physicalAddress: string;
}

export interface BusinessDetails {
  companyName: string;
  registrationNumber: string;
  tradingName: string;
  registeredAddress: string;
  physicalBusinessAddress: string;
  contactPerson: string;
  contactPersonEmail: string;
  contactPersonPhone: string;
}

/** Encrypted secret envelope persisted in KV (AES-256-GCM). */
interface EncryptedSecret {
  v: 1;
  iv: string; // base64
  ct: string; // base64 (ciphertext + GCM tag)
}

export interface TaxDetailsStored {
  efilingUsername: string;
  /** Present only when a password has been captured. Never sent to clients. */
  efilingPasswordEnc?: EncryptedSecret;
  vatPeriod: VatPeriodCategory | '';
  currentPeriodVat: string;
  previousPeriodVat: string;
}

export interface RefundEntityRecord {
  id: string;
  clusterId: string;
  entityType: RefundEntityType;
  personalDetails?: PersonalDetails;
  businessDetails?: BusinessDetails;
  bankingDetails: {
    primary: BankAccountDetails;
    secondary: BankAccountDetails;
  };
  taxDetails: TaxDetailsStored;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Client-safe projection — ciphertext stripped, presence flag added. */
export type SanitizedEntity = Omit<RefundEntityRecord, 'taxDetails'> & {
  taxDetails: Omit<TaxDetailsStored, 'efilingPasswordEnc'> & {
    hasEfilingPassword: boolean;
  };
};

export interface RefundEntityDocument {
  id: string;
  entityId: string;
  clusterId: string;
  documentType: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface EntityInput {
  entityType: RefundEntityType;
  personalDetails?: Partial<PersonalDetails>;
  businessDetails?: Partial<BusinessDetails>;
  bankingDetails?: {
    primary?: Partial<BankAccountDetails>;
    secondary?: Partial<BankAccountDetails>;
  };
  taxDetails?: {
    efilingUsername?: string;
    /** Plaintext from the form; encrypted before persistence, then discarded. */
    efilingPassword?: string;
    vatPeriod?: VatPeriodCategory | '';
    currentPeriodVat?: string;
    previousPeriodVat?: string;
  };
}

// ============================================================================
// KV keys
// ============================================================================

const CLUSTER_PREFIX = 'refund-clusters:cluster:';
const ENTITY_PREFIX = 'refund-clusters:entity:';
const DOC_PREFIX = 'refund-clusters:doc:';

const clusterKey = (clusterId: string) => `${CLUSTER_PREFIX}${clusterId}`;
const entityKey = (clusterId: string, entityId: string) =>
  `${ENTITY_PREFIX}${clusterId}:${entityId}`;
const docKey = (entityId: string, docId: string) => `${DOC_PREFIX}${entityId}:${docId}`;

const newId = () => crypto.randomUUID();

// ============================================================================
// Secret encryption (AES-256-GCM)
// ============================================================================

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

async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { v: 1, iv: b64encode(iv), ct: b64encode(new Uint8Array(ct)) };
}

async function decryptSecret(secret: EncryptedSecret): Promise<string> {
  const key = await getVaultKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(secret.iv) as BufferSource },
    key,
    b64decode(secret.ct) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

// ============================================================================
// Helpers
// ============================================================================

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function normalizeBankAccount(input?: Partial<BankAccountDetails>): BankAccountDetails {
  return {
    bankName: str(input?.bankName),
    accountHolder: str(input?.accountHolder),
    accountNumber: str(input?.accountNumber),
    branchCode: str(input?.branchCode),
    accountType: str(input?.accountType),
  };
}

function sanitizeEntity(entity: RefundEntityRecord): SanitizedEntity {
  const { efilingPasswordEnc, ...taxRest } = entity.taxDetails;
  return {
    ...entity,
    taxDetails: { ...taxRest, hasEfilingPassword: Boolean(efilingPasswordEnc) },
  };
}

const VAT_PERIODS: ReadonlyArray<string> = ['A', 'B', 'C', ''];

// ============================================================================
// Service
// ============================================================================

export const RefundClustersService = {
  // --- Clusters --------------------------------------------------------

  async listClusters(): Promise<Array<RefundClusterRecord & { entityCount: number }>> {
    const clusters = (await kv.getByPrefix(CLUSTER_PREFIX)) as RefundClusterRecord[];
    const entities = (await kv.getByPrefix(ENTITY_PREFIX)) as RefundEntityRecord[];
    const counts = new Map<string, number>();
    for (const entity of entities) {
      counts.set(entity.clusterId, (counts.get(entity.clusterId) ?? 0) + 1);
    }
    return clusters
      .filter((c) => c && c.id)
      .map((c) => ({ ...c, entityCount: counts.get(c.id) ?? 0 }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCluster(clusterId: string): Promise<RefundClusterRecord | null> {
    return ((await kv.get(clusterKey(clusterId))) as RefundClusterRecord | undefined) ?? null;
  },

  async createCluster(input: {
    name: string;
    description: string;
    createdBy: string;
  }): Promise<RefundClusterRecord> {
    const name = str(input.name);
    if (!name) throw new Error('Cluster name is required');

    const now = new Date().toISOString();
    const cluster: RefundClusterRecord = {
      id: newId(),
      name,
      description: str(input.description),
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };
    await kv.set(clusterKey(cluster.id), cluster);
    log.info('Cluster created', { clusterId: cluster.id });
    return cluster;
  },

  async updateCluster(
    clusterId: string,
    patch: { name?: string; description?: string; archived?: boolean },
  ): Promise<RefundClusterRecord> {
    const existing = await this.getCluster(clusterId);
    if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    const next: RefundClusterRecord = {
      ...existing,
      name: patch.name !== undefined ? str(patch.name) || existing.name : existing.name,
      description: patch.description !== undefined ? str(patch.description) : existing.description,
      archived: patch.archived !== undefined ? Boolean(patch.archived) : existing.archived,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(clusterKey(clusterId), next);
    return next;
  },

  /** Deletes the cluster and every entity + document record inside it. */
  async deleteCluster(clusterId: string): Promise<{ entitiesDeleted: number }> {
    const existing = await this.getCluster(clusterId);
    if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    const entities = await this.listEntities(clusterId);
    for (const entity of entities) {
      await this.deleteEntityRecords(clusterId, entity.id);
    }
    await kv.del(clusterKey(clusterId));
    log.info('Cluster deleted', { clusterId, entitiesDeleted: entities.length });
    return { entitiesDeleted: entities.length };
  },

  // --- Entities --------------------------------------------------------

  async listEntities(clusterId: string): Promise<SanitizedEntity[]> {
    const rows = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
    return rows
      .filter((row) => row && row.id)
      .map(sanitizeEntity)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getEntityRaw(clusterId: string, entityId: string): Promise<RefundEntityRecord | null> {
    return (
      ((await kv.get(entityKey(clusterId, entityId))) as RefundEntityRecord | undefined) ?? null
    );
  },

  async createEntity(
    clusterId: string,
    input: EntityInput,
    createdBy: string,
  ): Promise<SanitizedEntity> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) throw Object.assign(new Error('Cluster not found'), { status: 404 });

    if (input.entityType !== 'sole_proprietor' && input.entityType !== 'company') {
      throw Object.assign(new Error('Invalid entity type'), { status: 400 });
    }

    const now = new Date().toISOString();
    const record: RefundEntityRecord = {
      id: newId(),
      clusterId,
      entityType: input.entityType,
      bankingDetails: {
        primary: normalizeBankAccount(input.bankingDetails?.primary),
        secondary: normalizeBankAccount(input.bankingDetails?.secondary),
      },
      taxDetails: {
        efilingUsername: str(input.taxDetails?.efilingUsername),
        vatPeriod: this.normalizeVatPeriod(input.taxDetails?.vatPeriod),
        currentPeriodVat: str(input.taxDetails?.currentPeriodVat),
        previousPeriodVat: str(input.taxDetails?.previousPeriodVat),
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    if (input.entityType === 'sole_proprietor') {
      record.personalDetails = {
        name: str(input.personalDetails?.name),
        surname: str(input.personalDetails?.surname),
        physicalAddress: str(input.personalDetails?.physicalAddress),
      };
      if (!record.personalDetails.name) {
        throw Object.assign(new Error('Name is required for a sole proprietor'), { status: 400 });
      }
    } else {
      record.businessDetails = {
        companyName: str(input.businessDetails?.companyName),
        registrationNumber: str(input.businessDetails?.registrationNumber),
        tradingName: str(input.businessDetails?.tradingName),
        registeredAddress: str(input.businessDetails?.registeredAddress),
        physicalBusinessAddress: str(input.businessDetails?.physicalBusinessAddress),
        contactPerson: str(input.businessDetails?.contactPerson),
        contactPersonEmail: str(input.businessDetails?.contactPersonEmail),
        contactPersonPhone: str(input.businessDetails?.contactPersonPhone),
      };
      if (!record.businessDetails.companyName) {
        throw Object.assign(new Error('Company name is required'), { status: 400 });
      }
    }

    const password = input.taxDetails?.efilingPassword;
    if (password) {
      record.taxDetails.efilingPasswordEnc = await encryptSecret(password);
    }

    await kv.set(entityKey(clusterId, record.id), record);
    log.info('Entity created', { clusterId, entityId: record.id, type: record.entityType });
    return sanitizeEntity(record);
  },

  async updateEntity(
    clusterId: string,
    entityId: string,
    input: EntityInput,
  ): Promise<SanitizedEntity> {
    const existing = await this.getEntityRaw(clusterId, entityId);
    if (!existing) throw Object.assign(new Error('Entity not found'), { status: 404 });

    const next: RefundEntityRecord = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    if (existing.entityType === 'sole_proprietor' && input.personalDetails) {
      next.personalDetails = {
        name: str(input.personalDetails.name ?? existing.personalDetails?.name),
        surname: str(input.personalDetails.surname ?? existing.personalDetails?.surname),
        physicalAddress: str(
          input.personalDetails.physicalAddress ?? existing.personalDetails?.physicalAddress,
        ),
      };
    }
    if (existing.entityType === 'company' && input.businessDetails) {
      const prev = existing.businessDetails;
      next.businessDetails = {
        companyName: str(input.businessDetails.companyName ?? prev?.companyName),
        registrationNumber: str(
          input.businessDetails.registrationNumber ?? prev?.registrationNumber,
        ),
        tradingName: str(input.businessDetails.tradingName ?? prev?.tradingName),
        registeredAddress: str(input.businessDetails.registeredAddress ?? prev?.registeredAddress),
        physicalBusinessAddress: str(
          input.businessDetails.physicalBusinessAddress ?? prev?.physicalBusinessAddress,
        ),
        contactPerson: str(input.businessDetails.contactPerson ?? prev?.contactPerson),
        contactPersonEmail: str(
          input.businessDetails.contactPersonEmail ?? prev?.contactPersonEmail,
        ),
        contactPersonPhone: str(
          input.businessDetails.contactPersonPhone ?? prev?.contactPersonPhone,
        ),
      };
    }

    if (input.bankingDetails?.primary) {
      next.bankingDetails = {
        ...next.bankingDetails,
        primary: normalizeBankAccount({
          ...existing.bankingDetails.primary,
          ...input.bankingDetails.primary,
        }),
      };
    }
    if (input.bankingDetails?.secondary) {
      next.bankingDetails = {
        ...next.bankingDetails,
        secondary: normalizeBankAccount({
          ...existing.bankingDetails.secondary,
          ...input.bankingDetails.secondary,
        }),
      };
    }

    if (input.taxDetails) {
      next.taxDetails = {
        ...existing.taxDetails,
        efilingUsername: str(
          input.taxDetails.efilingUsername ?? existing.taxDetails.efilingUsername,
        ),
        vatPeriod:
          input.taxDetails.vatPeriod !== undefined
            ? this.normalizeVatPeriod(input.taxDetails.vatPeriod)
            : existing.taxDetails.vatPeriod,
        currentPeriodVat: str(
          input.taxDetails.currentPeriodVat ?? existing.taxDetails.currentPeriodVat,
        ),
        previousPeriodVat: str(
          input.taxDetails.previousPeriodVat ?? existing.taxDetails.previousPeriodVat,
        ),
      };
      // Only overwrite the stored secret when a new password is supplied.
      if (input.taxDetails.efilingPassword) {
        next.taxDetails.efilingPasswordEnc = await encryptSecret(input.taxDetails.efilingPassword);
      }
    }

    await kv.set(entityKey(clusterId, entityId), next);
    return sanitizeEntity(next);
  },

  /** Decrypt the stored eFiling password. Caller MUST audit this access. */
  async revealEfilingPassword(clusterId: string, entityId: string): Promise<string> {
    const entity = await this.getEntityRaw(clusterId, entityId);
    if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });
    if (!entity.taxDetails.efilingPasswordEnc) {
      throw Object.assign(new Error('No eFiling password is stored for this entity'), {
        status: 404,
      });
    }
    return decryptSecret(entity.taxDetails.efilingPasswordEnc);
  },

  /** Removes the entity record and its document metadata (not storage files). */
  async deleteEntityRecords(clusterId: string, entityId: string): Promise<RefundEntityDocument[]> {
    const docs = await this.listDocuments(entityId);
    for (const doc of docs) {
      await kv.del(docKey(entityId, doc.id));
    }
    await kv.del(entityKey(clusterId, entityId));
    return docs;
  },

  normalizeVatPeriod(value: unknown): VatPeriodCategory | '' {
    const v = typeof value === 'string' ? value.toUpperCase().trim() : '';
    return VAT_PERIODS.includes(v) ? (v as VatPeriodCategory | '') : '';
  },

  // --- Documents -------------------------------------------------------

  async listDocuments(entityId: string): Promise<RefundEntityDocument[]> {
    const rows = (await kv.getByPrefix(`${DOC_PREFIX}${entityId}:`)) as RefundEntityDocument[];
    return rows
      .filter((row) => row && row.id)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  /** All document records across every entity in a cluster. */
  async listClusterDocuments(clusterId: string): Promise<RefundEntityDocument[]> {
    const entities = (await kv.getByPrefix(
      `${ENTITY_PREFIX}${clusterId}:`,
    )) as RefundEntityRecord[];
    const documents: RefundEntityDocument[] = [];
    for (const entity of entities) {
      if (entity?.id) {
        documents.push(...(await this.listDocuments(entity.id)));
      }
    }
    return documents;
  },

  async getDocument(entityId: string, docId: string): Promise<RefundEntityDocument | null> {
    return ((await kv.get(docKey(entityId, docId))) as RefundEntityDocument | undefined) ?? null;
  },

  async saveDocument(
    doc: Omit<RefundEntityDocument, 'id' | 'uploadedAt'>,
  ): Promise<RefundEntityDocument> {
    const record: RefundEntityDocument = {
      ...doc,
      id: newId(),
      uploadedAt: new Date().toISOString(),
    };
    await kv.set(docKey(record.entityId, record.id), record);
    return record;
  },

  async deleteDocument(entityId: string, docId: string): Promise<void> {
    await kv.del(docKey(entityId, docId));
  },
};
