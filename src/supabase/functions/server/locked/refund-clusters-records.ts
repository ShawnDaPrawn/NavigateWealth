/**
 * Refund cluster record accessors: the raw entity read plus the document and
 * transaction stores. Method bodies moved verbatim from the
 * RefundClustersService object in refund-clusters-service.ts (documented
 * facade transform: methods -> module functions, this. calls dropped).
 * getEntityRaw lives here rather than with the entity CRUD so the
 * core -> records dependency stays one-way (no module cycle).
 */
import * as kv from '../kv_store.tsx';
import type {
  RefundEntityDocument,
  RefundEntityRecord,
  RefundTransactionInvoice,
  RefundTransactionRecord,
  TransactionInput,
} from './refund-clusters-model.ts';
import {
  DOC_PREFIX,
  ENTITY_PREFIX,
  TXN_PREFIX,
  docKey,
  entityKey,
  newId,
  parseDirection,
  parseTreatment,
  resolveVatAmount,
  str,
  toAmount,
  txnKey,
} from './refund-clusters-helpers.ts';

export async function getEntityRaw(
  clusterId: string,
  entityId: string,
): Promise<RefundEntityRecord | null> {
  return ((await kv.get(entityKey(clusterId, entityId))) as RefundEntityRecord | undefined) ?? null;
}

// --- Documents -------------------------------------------------------

export async function listDocuments(entityId: string): Promise<RefundEntityDocument[]> {
  const rows = (await kv.getByPrefix(`${DOC_PREFIX}${entityId}:`)) as RefundEntityDocument[];
  return rows
    .filter((row) => row && row.id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** All document records across every entity in a cluster. */
export async function listClusterDocuments(clusterId: string): Promise<RefundEntityDocument[]> {
  const entities = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
  const documents: RefundEntityDocument[] = [];
  for (const entity of entities) {
    if (entity?.id) {
      documents.push(...(await listDocuments(entity.id)));
    }
  }
  return documents;
}

export async function getDocument(
  entityId: string,
  docId: string,
): Promise<RefundEntityDocument | null> {
  return ((await kv.get(docKey(entityId, docId))) as RefundEntityDocument | undefined) ?? null;
}

export async function saveDocument(
  doc: Omit<RefundEntityDocument, 'id' | 'uploadedAt'>,
): Promise<RefundEntityDocument> {
  const record: RefundEntityDocument = {
    ...doc,
    id: newId(),
    uploadedAt: new Date().toISOString(),
  };
  await kv.set(docKey(record.entityId, record.id), record);
  return record;
}

export async function deleteDocument(entityId: string, docId: string): Promise<void> {
  await kv.del(docKey(entityId, docId));
}

// --- Transactions ----------------------------------------------------

export async function listTransactions(entityId: string): Promise<RefundTransactionRecord[]> {
  const rows = (await kv.getByPrefix(`${TXN_PREFIX}${entityId}:`)) as RefundTransactionRecord[];
  return rows
    .filter((row) => row && row.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** All transaction records across every entity in a cluster. */
export async function listClusterTransactions(
  clusterId: string,
): Promise<RefundTransactionRecord[]> {
  const entities = (await kv.getByPrefix(`${ENTITY_PREFIX}${clusterId}:`)) as RefundEntityRecord[];
  const txns: RefundTransactionRecord[] = [];
  for (const entity of entities) {
    if (entity?.id) txns.push(...(await listTransactions(entity.id)));
  }
  return txns;
}

export async function getTransaction(
  entityId: string,
  txnId: string,
): Promise<RefundTransactionRecord | null> {
  return ((await kv.get(txnKey(entityId, txnId))) as RefundTransactionRecord | undefined) ?? null;
}

export async function createTransaction(
  clusterId: string,
  entityId: string,
  input: TransactionInput,
  createdBy: string,
): Promise<RefundTransactionRecord> {
  const entity = await getEntityRaw(clusterId, entityId);
  if (!entity) throw Object.assign(new Error('Entity not found'), { status: 404 });

  const amount = toAmount(input.amount);
  if (amount <= 0)
    throw Object.assign(new Error('Amount must be greater than zero'), {
      status: 400,
    });
  const direction = parseDirection(input.direction);
  const treatment = parseTreatment(input.vatTreatment ?? 'standard');
  const { vatAmount, vatOverridden } = resolveVatAmount(amount, treatment, input.vatAmount);

  const now = new Date().toISOString();
  const record: RefundTransactionRecord = {
    id: newId(),
    entityId,
    clusterId,
    date: str(input.date) || now.slice(0, 10),
    description: str(input.description),
    direction,
    vatTreatment: treatment,
    amount,
    vatAmount,
    vatOverridden,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await kv.set(txnKey(entityId, record.id), record);
  return record;
}

export async function updateTransaction(
  entityId: string,
  txnId: string,
  input: TransactionInput,
): Promise<RefundTransactionRecord> {
  const existing = await getTransaction(entityId, txnId);
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });

  const amount = input.amount !== undefined ? toAmount(input.amount) : existing.amount;
  if (amount <= 0)
    throw Object.assign(new Error('Amount must be greater than zero'), {
      status: 400,
    });
  const treatment =
    input.vatTreatment !== undefined ? parseTreatment(input.vatTreatment) : existing.vatTreatment;
  const { vatAmount, vatOverridden } = resolveVatAmount(amount, treatment, input.vatAmount);

  const next: RefundTransactionRecord = {
    ...existing,
    date: input.date !== undefined ? str(input.date) || existing.date : existing.date,
    description: input.description !== undefined ? str(input.description) : existing.description,
    direction: input.direction !== undefined ? parseDirection(input.direction) : existing.direction,
    vatTreatment: treatment,
    amount,
    vatAmount,
    vatOverridden,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(txnKey(entityId, txnId), next);
  return next;
}

/** Removes the transaction metadata (not the invoice storage file). */
export async function deleteTransaction(
  entityId: string,
  txnId: string,
): Promise<RefundTransactionRecord | null> {
  const existing = await getTransaction(entityId, txnId);
  if (existing) await kv.del(txnKey(entityId, txnId));
  return existing;
}

export async function attachTransactionInvoice(
  entityId: string,
  txnId: string,
  invoice: RefundTransactionInvoice,
): Promise<RefundTransactionRecord> {
  const existing = await getTransaction(entityId, txnId);
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
  const next = { ...existing, invoice, updatedAt: new Date().toISOString() };
  await kv.set(txnKey(entityId, txnId), next);
  return next;
}

export async function removeTransactionInvoice(
  entityId: string,
  txnId: string,
): Promise<RefundTransactionRecord> {
  const existing = await getTransaction(entityId, txnId);
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 });
  const next = { ...existing, updatedAt: new Date().toISOString() };
  delete next.invoice;
  await kv.set(txnKey(entityId, txnId), next);
  return next;
}
