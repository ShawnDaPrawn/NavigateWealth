/**
 * Refund cluster, entity, and manager operations (including the audited
 * password reveals). Method bodies moved verbatim from the
 * RefundClustersService object in refund-clusters-service.ts (documented
 * facade transform: methods -> module functions, this. calls dropped).
 */
import * as kv from '../kv_store.tsx';
import { createModuleLogger } from '../stderr-logger.ts';
import type {
  BankAccountSlot,
  EntityInput,
  ManagerInput,
  RefundClusterRecord,
  RefundEntityDocument,
  RefundEntityRecord,
  RefundManagerRecord,
  SanitizedEntity,
  VatPeriodCategory,
} from './refund-clusters-model.ts';
import { decryptSecret, encryptSecret } from './refund-clusters-crypto.ts';
import {
  CLUSTER_PREFIX,
  DEFAULT_VAT_YEAR_END_MONTH,
  ENTITY_PREFIX,
  MANAGER_PREFIX,
  buildStoredBankAccount,
  clusterKey,
  docKey,
  entityKey,
  managerKey,
  newId,
  normalizeManager,
  normalizeVatPeriod,
  normalizeYearEndMonth,
  sanitizeEntity,
  str,
  txnKey,
} from './refund-clusters-helpers.ts';
import { getEntityRaw, listDocuments, listTransactions } from './refund-clusters-records.ts';

const log = createModuleLogger('refund-clusters');

// --- Clusters --------------------------------------------------------

export async function listClusters(): Promise<
  Array<RefundClusterRecord & { entityCount: number }>
> {
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
}

export async function getCluster(clusterId: string): Promise<RefundClusterRecord | null> {
  const cluster =
    ((await kv.get(clusterKey(clusterId))) as RefundClusterRecord | undefined) ?? null;
  if (cluster && !cluster.vatPeriod) {
    // Back-compat: clusters created before the VAT category moved to the
    // cluster have no vatPeriod. Derive it once from any entity's legacy
    // taxDetails.vatPeriod and persist, so period-scoped summaries are
    // correct without a manual edit.
    const derived = await deriveLegacyVatPeriod(clusterId);
    if (derived) {
      cluster.vatPeriod = derived;
      await kv.set(clusterKey(clusterId), cluster);
    }
  }
  return cluster;
}

/** Reads the legacy per-entity VAT category (pre-migration records) for backfill. */
export async function deriveLegacyVatPeriod(clusterId: string): Promise<VatPeriodCategory | ''> {
  const entities = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
  for (const entity of entities) {
    const legacy = (entity?.taxDetails as { vatPeriod?: unknown } | undefined)?.vatPeriod;
    const normalized = normalizeVatPeriod(legacy);
    if (normalized) return normalized;
  }
  return '';
}

export async function createCluster(input: {
  name: string;
  description: string;
  vatPeriod?: VatPeriodCategory | '';
  vatYearEndMonth?: number;
  createdBy: string;
}): Promise<RefundClusterRecord> {
  const name = str(input.name);
  if (!name) throw new Error('Cluster name is required');

  const now = new Date().toISOString();
  const cluster: RefundClusterRecord = {
    id: newId(),
    name,
    description: str(input.description),
    vatPeriod: normalizeVatPeriod(input.vatPeriod),
    vatYearEndMonth: normalizeYearEndMonth(input.vatYearEndMonth),
    archived: false,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  await kv.set(clusterKey(cluster.id), cluster);
  log.info('Cluster created', { clusterId: cluster.id });
  return cluster;
}

export async function updateCluster(
  clusterId: string,
  patch: {
    name?: string;
    description?: string;
    vatPeriod?: VatPeriodCategory | '';
    vatYearEndMonth?: number;
    archived?: boolean;
  },
): Promise<RefundClusterRecord> {
  const existing = await getCluster(clusterId);
  if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

  const next: RefundClusterRecord = {
    ...existing,
    name: patch.name !== undefined ? str(patch.name) || existing.name : existing.name,
    description: patch.description !== undefined ? str(patch.description) : existing.description,
    vatPeriod:
      patch.vatPeriod !== undefined
        ? normalizeVatPeriod(patch.vatPeriod)
        : (existing.vatPeriod ?? ''),
    vatYearEndMonth:
      patch.vatYearEndMonth !== undefined
        ? normalizeYearEndMonth(patch.vatYearEndMonth)
        : (existing.vatYearEndMonth ?? DEFAULT_VAT_YEAR_END_MONTH),
    archived: patch.archived !== undefined ? Boolean(patch.archived) : existing.archived,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(clusterKey(clusterId), next);
  return next;
}

/** Deletes the cluster and every entity + document record inside it. */
export async function deleteCluster(clusterId: string): Promise<{ entitiesDeleted: number }> {
  const existing = await getCluster(clusterId);
  if (!existing) throw Object.assign(new Error('Cluster not found'), { status: 404 });

  const entities = await listEntities(clusterId);
  for (const entity of entities) {
    await deleteEntityRecords(clusterId, entity.id);
  }
  const managers = await listManagers(clusterId);
  for (const manager of managers) {
    await kv.del(managerKey(clusterId, manager.id));
  }
  await kv.del(clusterKey(clusterId));
  log.info('Cluster deleted', {
    clusterId,
    entitiesDeleted: entities.length,
    managersDeleted: managers.length,
  });
  return { entitiesDeleted: entities.length };
}

// --- Entities --------------------------------------------------------

export async function listEntities(clusterId: string): Promise<SanitizedEntity[]> {
  const rows = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
  return rows
    .filter((row) => row && row.id)
    .map(sanitizeEntity)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createEntity(
  clusterId: string,
  input: EntityInput,
  createdBy: string,
): Promise<SanitizedEntity> {
  const cluster = await getCluster(clusterId);
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { status: 404 });

  if (input.entityType !== 'sole_proprietor' && input.entityType !== 'company') {
    throw Object.assign(new Error('Invalid entity type'), { status: 400 });
  }

  const now = new Date().toISOString();
  const record: RefundEntityRecord = {
    id: newId(),
    clusterId,
    entityType: input.entityType,
    managerId: await resolveManagerId(clusterId, input.managerId),
    bankingDetails: {
      primary: await buildStoredBankAccount(undefined, input.bankingDetails?.primary),
      secondary: await buildStoredBankAccount(undefined, input.bankingDetails?.secondary),
    },
    taxDetails: {
      efilingUsername: str(input.taxDetails?.efilingUsername),
      vatPeriod: normalizeVatPeriod(input.taxDetails?.vatPeriod),
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
}

export async function updateEntity(
  clusterId: string,
  entityId: string,
  input: EntityInput,
): Promise<SanitizedEntity> {
  const existing = await getEntityRaw(clusterId, entityId);
  if (!existing) throw Object.assign(new Error('Entity not found'), { status: 404 });

  const next: RefundEntityRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };

  if (input.managerId !== undefined) {
    next.managerId = await resolveManagerId(clusterId, input.managerId);
  }

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
      registrationNumber: str(input.businessDetails.registrationNumber ?? prev?.registrationNumber),
      tradingName: str(input.businessDetails.tradingName ?? prev?.tradingName),
      registeredAddress: str(input.businessDetails.registeredAddress ?? prev?.registeredAddress),
      physicalBusinessAddress: str(
        input.businessDetails.physicalBusinessAddress ?? prev?.physicalBusinessAddress,
      ),
      contactPerson: str(input.businessDetails.contactPerson ?? prev?.contactPerson),
      contactPersonEmail: str(input.businessDetails.contactPersonEmail ?? prev?.contactPersonEmail),
      contactPersonPhone: str(input.businessDetails.contactPersonPhone ?? prev?.contactPersonPhone),
    };
  }

  if (input.bankingDetails?.primary) {
    next.bankingDetails = {
      ...next.bankingDetails,
      primary: await buildStoredBankAccount(
        existing.bankingDetails.primary,
        input.bankingDetails.primary,
      ),
    };
  }
  if (input.bankingDetails?.secondary) {
    next.bankingDetails = {
      ...next.bankingDetails,
      secondary: await buildStoredBankAccount(
        existing.bankingDetails.secondary,
        input.bankingDetails.secondary,
      ),
    };
  }

  if (input.taxDetails) {
    next.taxDetails = {
      ...existing.taxDetails,
      efilingUsername: str(input.taxDetails.efilingUsername ?? existing.taxDetails.efilingUsername),
      vatPeriod:
        input.taxDetails.vatPeriod !== undefined
          ? normalizeVatPeriod(input.taxDetails.vatPeriod)
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
}

/** Decrypt the stored eFiling password. Caller MUST audit this access. */
export async function revealEfilingPassword(clusterId: string, entityId: string): Promise<string> {
  const entity = await getEntityRaw(clusterId, entityId);
  if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });
  if (!entity.taxDetails.efilingPasswordEnc) {
    throw Object.assign(new Error('No eFiling password is stored for this entity'), {
      status: 404,
    });
  }
  return decryptSecret(entity.taxDetails.efilingPasswordEnc);
}

/** Decrypt a stored online-banking password. Caller MUST audit this access. */
export async function revealBankPassword(
  clusterId: string,
  entityId: string,
  account: BankAccountSlot,
): Promise<string> {
  if (account !== 'primary' && account !== 'secondary') {
    throw Object.assign(new Error('Invalid bank account'), { status: 400 });
  }
  const entity = await getEntityRaw(clusterId, entityId);
  if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });
  const enc = entity.bankingDetails[account]?.onlinePasswordEnc;
  if (!enc) {
    throw Object.assign(new Error('No online banking password is stored for this account'), {
      status: 404,
    });
  }
  return decryptSecret(enc);
}

/**
 * Removes the entity record plus its document and transaction metadata
 * (not the underlying storage files — the route removes those first).
 */
export async function deleteEntityRecords(
  clusterId: string,
  entityId: string,
): Promise<RefundEntityDocument[]> {
  const docs = await listDocuments(entityId);
  for (const doc of docs) {
    await kv.del(docKey(entityId, doc.id));
  }
  const txns = await listTransactions(entityId);
  for (const txn of txns) {
    await kv.del(txnKey(entityId, txn.id));
  }
  await kv.del(entityKey(clusterId, entityId));
  return docs;
}

// --- Managers --------------------------------------------------------

export async function listManagers(clusterId: string): Promise<RefundManagerRecord[]> {
  const rows = (await kv.getByPrefix(`${MANAGER_PREFIX}${clusterId}:`)) as RefundManagerRecord[];
  return rows
    .filter((row) => row && row.id)
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

export async function getManager(
  clusterId: string,
  managerId: string,
): Promise<RefundManagerRecord | null> {
  return (
    ((await kv.get(managerKey(clusterId, managerId))) as RefundManagerRecord | undefined) ?? null
  );
}

/** Returns the id only when it names a manager that exists in the cluster; else undefined. */
export async function resolveManagerId(
  clusterId: string,
  managerId: string | null | undefined,
): Promise<string | undefined> {
  const id = str(managerId);
  if (!id) return undefined;
  const manager = await getManager(clusterId, id);
  return manager ? id : undefined;
}

export async function createManager(
  clusterId: string,
  input: ManagerInput,
  createdBy: string,
): Promise<RefundManagerRecord> {
  const cluster = await getCluster(clusterId);
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { status: 404 });

  const fields = normalizeManager(input);
  if (!fields.name) throw Object.assign(new Error('Manager name is required'), { status: 400 });

  const now = new Date().toISOString();
  const record: RefundManagerRecord = {
    id: newId(),
    clusterId,
    ...fields,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await kv.set(managerKey(clusterId, record.id), record);
  log.info('Manager created', { clusterId, managerId: record.id });
  return record;
}

export async function updateManager(
  clusterId: string,
  managerId: string,
  input: ManagerInput,
): Promise<RefundManagerRecord> {
  const existing = await getManager(clusterId, managerId);
  if (!existing) throw Object.assign(new Error('Manager not found'), { status: 404 });

  const fields = normalizeManager(input, existing);
  if (!fields.name) throw Object.assign(new Error('Manager name is required'), { status: 400 });

  const next: RefundManagerRecord = {
    ...existing,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(managerKey(clusterId, managerId), next);
  return next;
}

/** Deletes the manager and clears it from any entity that referenced it. */
export async function deleteManager(clusterId: string, managerId: string): Promise<void> {
  const existing = await getManager(clusterId, managerId);
  if (!existing) throw Object.assign(new Error('Manager not found'), { status: 404 });

  const entities = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
  const now = new Date().toISOString();
  for (const entity of entities) {
    if (entity?.id && entity.managerId === managerId) {
      await kv.set(entityKey(clusterId, entity.id), {
        ...entity,
        managerId: undefined,
        updatedAt: now,
      });
    }
  }
  await kv.del(managerKey(clusterId, managerId));
  log.info('Manager deleted', { clusterId, managerId });
}
