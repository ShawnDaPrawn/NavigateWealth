/**
 * Refund Clusters Routes
 *
 * Locked → Accounts → Refund Clusters. Stores highly sensitive tax, banking
 * and identity information, so every route requires SUPER ADMIN access and
 * every mutation / sensitive read is written to the admin audit trail.
 *
 * Static routes are registered before parameterised routes (§14.2).
 */

import { Hono, type Context } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import { AdminAuditService } from '../admin-audit-service.ts';
import {
  RefundClustersService,
  transactionStoragePaths,
  type AttachmentKind,
  type EntityInput,
  type ManagerInput,
  type SubmissionInput,
  type TransactionInput,
} from './refund-clusters-service.ts';
import { isLockedStatus } from './vat201.ts';
import { extractInvoiceCapture } from './invoice-capture-ai.ts';
import { computeTransactionFlags } from './vat-validation.ts';
import { SuppliersService } from './suppliers-service.ts';
import { buildSubmissionPack, COMPLIANCE_PACK_DOC_TYPES } from './vat-pack-service.ts';

const app = new Hono();
const log = createModuleLogger('refund-clusters-routes');

const BUCKET = 'make-91ed8379-refund-clusters';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Every route in this module is super-admin only.
app.use('*', requireSuperAdmin);

function audit(
  c: Context,
  action: string,
  summary: string,
  options: {
    severity?: 'info' | 'warning' | 'critical';
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  // Awaited at every call site so the isolate cannot suspend before the
  // audit entry is persisted. AdminAuditService.record never throws.
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'security',
    action,
    summary,
    severity: options.severity ?? 'info',
    entityType: options.entityType ?? 'refund_cluster',
    entityId: options.entityId,
    metadata: options.metadata,
  });
}

function errStatus(error: unknown): number {
  const status = (error as { status?: number })?.status;
  return typeof status === 'number' ? status : 500;
}

/** Validates an uploaded file against the allowed types/size. Returns an error message or null. */
function validateUpload(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return 'File exceeds the 10MB limit';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only PDF, JPEG and PNG files are allowed';
  }
  return null;
}

/** Lazily creates the private bucket on first upload. */
async function ensureBucket(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  }
}

// ============================================================================
// Clusters
// ============================================================================

app.get(
  '/',
  asyncHandler(async (c) => {
    const clusters = await RefundClustersService.listClusters();
    return c.json({ success: true, clusters });
  }),
);

app.post(
  '/',
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const cluster = await RefundClustersService.createCluster({
      name: String(body?.name ?? ''),
      description: String(body?.description ?? ''),
      vatPeriod: body?.vatPeriod,
      vatYearEndMonth: body?.vatYearEndMonth,
      createdBy: c.get('userId') as string,
    });
    await audit(c, 'refund_cluster_created', 'Refund cluster created', { entityId: cluster.id });
    return c.json({ success: true, cluster }, 201);
  }),
);

app.put(
  '/:clusterId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const body = await c.req.json();
    try {
      const cluster = await RefundClustersService.updateCluster(clusterId, {
        name: body?.name,
        description: body?.description,
        vatPeriod: body?.vatPeriod,
        vatYearEndMonth: body?.vatYearEndMonth,
        archived: body?.archived,
      });
      const action =
        body?.archived === true
          ? 'refund_cluster_archived'
          : body?.archived === false
            ? 'refund_cluster_unarchived'
            : 'refund_cluster_updated';
      await audit(c, action, 'Refund cluster updated', { entityId: clusterId });
      return c.json({ success: true, cluster });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    try {
      // Remove stored files BEFORE the metadata: if storage fails we keep the
      // records (and their paths) so the deletion can be retried.
      const docs = await RefundClustersService.listClusterDocuments(clusterId);
      const txns = await RefundClustersService.listClusterTransactions(clusterId);
      const paths = [
        ...docs.map((d) => d.storagePath),
        ...txns.flatMap((t) => transactionStoragePaths(t)),
      ];
      if (paths.length > 0) {
        const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
        if (error) {
          log.error('Failed to remove cluster files from storage', error);
          return c.json({ error: 'Failed to remove stored documents — cluster not deleted' }, 500);
        }
      }
      const { entitiesDeleted } = await RefundClustersService.deleteCluster(clusterId);
      await audit(c, 'refund_cluster_deleted', 'Refund cluster deleted', {
        severity: 'warning',
        entityId: clusterId,
        metadata: { entitiesDeleted },
      });
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

app.get(
  '/:clusterId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const cluster = await RefundClustersService.getCluster(clusterId);
    if (!cluster) {
      return c.json({ error: 'Cluster not found' }, 404);
    }
    const entities = await RefundClustersService.listEntities(clusterId);
    await audit(c, 'refund_cluster_viewed', 'Refund cluster opened', {
      entityId: clusterId,
      metadata: { entityCount: entities.length },
    });
    return c.json({ success: true, cluster, entities });
  }),
);

// ============================================================================
// Entities
// ============================================================================

app.post(
  '/:clusterId/entities',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const body = (await c.req.json()) as EntityInput;
    try {
      const entity = await RefundClustersService.createEntity(
        clusterId,
        body,
        c.get('userId') as string,
      );
      await audit(c, 'refund_entity_created', `Refund entity created (${entity.entityType})`, {
        entityType: 'refund_entity',
        entityId: entity.id,
        metadata: { clusterId, hasPassword: entity.taxDetails.hasEfilingPassword },
      });
      return c.json({ success: true, entity }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.put(
  '/:clusterId/entities/:entityId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = (await c.req.json()) as EntityInput;
    try {
      const entity = await RefundClustersService.updateEntity(clusterId, entityId, body);
      await audit(c, 'refund_entity_updated', 'Refund entity updated', {
        entityType: 'refund_entity',
        entityId,
        metadata: {
          clusterId,
          passwordChanged: Boolean(body?.taxDetails?.efilingPassword),
        },
      });
      return c.json({ success: true, entity });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId/entities/:entityId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    // Remove stored files BEFORE the metadata: if storage fails we keep the
    // records (and their paths) so the deletion can be retried.
    const docs = await RefundClustersService.listDocuments(entityId);
    const txns = await RefundClustersService.listTransactions(entityId);
    const paths = [
      ...docs.map((d) => d.storagePath),
      ...txns.flatMap((t) => transactionStoragePaths(t)),
    ];
    if (paths.length > 0) {
      const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
      if (error) {
        log.error('Failed to remove entity files from storage', error);
        return c.json({ error: 'Failed to remove stored documents — entity not deleted' }, 500);
      }
    }
    await RefundClustersService.deleteEntityRecords(clusterId, entityId);

    await audit(c, 'refund_entity_deleted', 'Refund entity deleted', {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, documentsDeleted: docs.length },
    });
    return c.json({ success: true });
  }),
);

/**
 * POST /:clusterId/entities/:entityId/efiling-password/reveal
 *
 * Decrypts and returns the stored eFiling password for a one-off,
 * explicitly requested view. Always audited at critical severity.
 */
app.post(
  '/:clusterId/entities/:entityId/efiling-password/reveal',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    try {
      const password = await RefundClustersService.revealEfilingPassword(clusterId, entityId);
      await audit(c, 'refund_entity_password_revealed', 'eFiling password revealed', {
        severity: 'critical',
        entityType: 'refund_entity',
        entityId,
        metadata: { clusterId },
      });
      return c.json({ success: true, password });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

/**
 * POST /:clusterId/entities/:entityId/bank-password/reveal
 *
 * Decrypts and returns the stored online-banking password for the named
 * account ('primary' | 'secondary'). Always audited at critical severity.
 */
app.post(
  '/:clusterId/entities/:entityId/bank-password/reveal',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = await c.req.json().catch(() => ({}));
    const account = body?.account;
    if (account !== 'primary' && account !== 'secondary') {
      return c.json({ error: "account must be 'primary' or 'secondary'" }, 400);
    }
    try {
      const password = await RefundClustersService.revealBankPassword(clusterId, entityId, account);
      await audit(c, 'refund_entity_bank_password_revealed', 'Online banking password revealed', {
        severity: 'critical',
        entityType: 'refund_entity',
        entityId,
        metadata: { clusterId, account },
      });
      return c.json({ success: true, password });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

// ============================================================================
// Documents
// ============================================================================

app.get(
  '/:clusterId/entities/:entityId/documents',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const documents = await RefundClustersService.listDocuments(entityId);
    return c.json({ success: true, documents });
  }),
);

app.post(
  '/:clusterId/entities/:entityId/documents',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';

    const entity = await RefundClustersService.getEntityRaw(clusterId, entityId);
    if (!entity) {
      return c.json({ error: 'Entity not found' }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    const documentType = typeof body['documentType'] === 'string' ? body['documentType'] : '';

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    if (!documentType) {
      return c.json({ error: 'documentType is required' }, 400);
    }
    const invalid = validateUpload(file);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const supabase = getSupabase();
    await ensureBucket(supabase);

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${clusterId}/${entityId}/${documentType}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      log.error('Document upload failed', uploadError);
      return c.json({ error: uploadError.message }, 500);
    }

    const document = await RefundClustersService.saveDocument({
      entityId,
      clusterId,
      documentType,
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedBy: c.get('userId') as string,
    });

    await audit(c, 'refund_entity_document_uploaded', `Document uploaded (${documentType})`, {
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, documentId: document.id, documentType },
    });
    return c.json({ success: true, document }, 201);
  }),
);

/**
 * GET /:clusterId/entities/:entityId/documents/:docId/url
 *
 * Issues a short-lived signed URL for viewing a stored document.
 */
app.get(
  '/:clusterId/entities/:entityId/documents/:docId/url',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const docId = c.req.param('docId') ?? '';

    const document = await RefundClustersService.getDocument(entityId, docId);
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL', error);
      return c.json({ error: 'Failed to create document link' }, 500);
    }

    await audit(c, 'refund_entity_document_viewed', `Document viewed (${document.documentType})`, {
      entityType: 'refund_entity',
      entityId,
      metadata: { documentId: docId, documentType: document.documentType },
    });
    return c.json({ success: true, url: data.signedUrl, fileName: document.fileName });
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/documents/:docId',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const docId = c.req.param('docId') ?? '';

    const document = await RefundClustersService.getDocument(entityId, docId);
    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Only drop the metadata once storage confirms the file is gone — a
    // failed storage delete must keep the record so it can be retried.
    const { error } = await getSupabase().storage.from(BUCKET).remove([document.storagePath]);
    if (error) {
      log.error('Failed to remove document from storage', error);
      return c.json({ error: 'Failed to delete the stored file — please try again' }, 500);
    }

    await RefundClustersService.deleteDocument(entityId, docId);
    await audit(
      c,
      'refund_entity_document_deleted',
      `Document deleted (${document.documentType})`,
      {
        severity: 'warning',
        entityType: 'refund_entity',
        entityId,
        metadata: { documentId: docId, documentType: document.documentType },
      },
    );
    return c.json({ success: true });
  }),
);

// ============================================================================
// Transactions
// ============================================================================

app.get(
  '/:clusterId/entities/:entityId/transactions',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const transactions = await RefundClustersService.listTransactions(entityId);
    // SARS-readiness flags need supplier VAT numbers for linked counterparties.
    const suppliers = await SuppliersService.listSuppliers();
    const supplierVatNumbers = Object.fromEntries(suppliers.map((s) => [s.id, s.vatNumber]));
    const flags = computeTransactionFlags(transactions, { supplierVatNumbers });
    return c.json({ success: true, transactions, flags });
  }),
);

app.post(
  '/:clusterId/entities/:entityId/transactions',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = (await c.req.json()) as TransactionInput;
    try {
      const transaction = await RefundClustersService.createTransaction(
        clusterId,
        entityId,
        body,
        c.get('userId') as string,
      );
      await audit(c, 'refund_transaction_created', `Transaction added (${transaction.direction})`, {
        entityType: 'refund_entity',
        entityId,
        metadata: {
          clusterId,
          transactionId: transaction.id,
          direction: transaction.direction,
          amount: transaction.amount,
          vatAmount: transaction.vatAmount,
        },
      });
      return c.json({ success: true, transaction }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.put(
  '/:clusterId/entities/:entityId/transactions/:txnId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';
    const body = (await c.req.json()) as TransactionInput;
    try {
      const transaction = await RefundClustersService.updateTransaction(entityId, txnId, body);
      await audit(c, 'refund_transaction_updated', 'Transaction updated', {
        entityType: 'refund_entity',
        entityId,
        metadata: { clusterId, transactionId: txnId },
      });
      return c.json({ success: true, transaction });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/transactions/:txnId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const existing = await RefundClustersService.getTransaction(entityId, txnId);
    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    // Remove evidence files first so metadata is only dropped once storage confirms.
    const paths = transactionStoragePaths(existing);
    if (paths.length > 0) {
      const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
      if (error) {
        log.error('Failed to remove transaction evidence from storage', error);
        return c.json({ error: 'Failed to delete the stored evidence — please try again' }, 500);
      }
    }
    await RefundClustersService.deleteTransaction(entityId, txnId);
    await audit(c, 'refund_transaction_deleted', 'Transaction deleted', {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, transactionId: txnId },
    });
    return c.json({ success: true });
  }),
);

app.post(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const existing = await RefundClustersService.getTransaction(entityId, txnId);
    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    const invalid = validateUpload(file);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const supabase = getSupabase();
    await ensureBucket(supabase);

    // Upload the replacement (always a unique path) and persist its metadata
    // BEFORE removing any prior invoice, so a failed upload never loses the
    // existing file. The old path is cleaned up only after the new one sticks.
    const oldPath = RefundClustersService.primaryInvoice(existing)?.storagePath;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${clusterId}/${entityId}/transactions/${txnId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      log.error('Transaction invoice upload failed', uploadError);
      return c.json({ error: uploadError.message }, 500);
    }

    const transaction = await RefundClustersService.attachTransactionInvoice(entityId, txnId, {
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: c.get('userId') as string,
    });

    if (oldPath && oldPath !== storagePath) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([oldPath]);
      // Non-fatal: the new invoice is already saved; a leftover old file is an
      // orphan, not data loss. Log it for later cleanup.
      if (removeError) log.error('Failed to remove replaced invoice (orphaned)', removeError);
    }

    await audit(c, 'refund_transaction_invoice_uploaded', 'Transaction invoice uploaded', {
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, transactionId: txnId },
    });
    return c.json({ success: true, transaction }, 201);
  }),
);

app.get(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice/url',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const transaction = await RefundClustersService.getTransaction(entityId, txnId);
    const primary = transaction ? RefundClustersService.primaryInvoice(transaction) : null;
    if (!primary) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(primary.storagePath, 300);
    if (error || !data?.signedUrl) {
      log.error('Failed to create invoice signed URL', error);
      return c.json({ error: 'Failed to create invoice link' }, 500);
    }
    await audit(c, 'refund_transaction_invoice_viewed', 'Transaction invoice viewed', {
      entityType: 'refund_entity',
      entityId,
      metadata: { transactionId: txnId },
    });
    return c.json({ success: true, url: data.signedUrl, fileName: primary.fileName });
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const transaction = await RefundClustersService.getTransaction(entityId, txnId);
    const primary = transaction ? RefundClustersService.primaryInvoice(transaction) : null;
    if (!primary) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const { error } = await getSupabase().storage.from(BUCKET).remove([primary.storagePath]);
    if (error) {
      log.error('Failed to remove transaction invoice from storage', error);
      return c.json({ error: 'Failed to delete the stored invoice — please try again' }, 500);
    }
    const updated = await RefundClustersService.removeTransactionInvoice(entityId, txnId);
    await audit(c, 'refund_transaction_invoice_deleted', 'Transaction invoice deleted', {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { transactionId: txnId },
    });
    return c.json({ success: true, transaction: updated });
  }),
);

// ============================================================================
// AI invoice capture (received documents → draft transactions)
// ============================================================================

/** Base64 without loading the whole file through string concatenation limits. */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * POST /:clusterId/entities/:entityId/capture
 *
 * Uploads a received invoice document and runs AI extraction over it. Nothing
 * is written to the ledger — the client shows the draft for confirmation and
 * then calls transactions/from-capture (or discards via DELETE …/capture).
 * The document (base64) is sent to the configured AI provider.
 */
app.post(
  '/:clusterId/entities/:entityId/capture',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const entity = await RefundClustersService.getEntityRaw(clusterId, entityId);
    if (!entity) return c.json({ error: 'Entity not found' }, 404);

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    const invalid = validateUpload(file);
    if (invalid) return c.json({ error: invalid }, 400);

    const supabase = getSupabase();
    await ensureBucket(supabase);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${clusterId}/${entityId}/captures/${Date.now()}_${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      log.error('Capture upload failed', uploadError);
      return c.json({ error: uploadError.message }, 500);
    }

    try {
      const { extraction, model } = await extractInvoiceCapture({
        fileBase64: bytesToBase64(bytes),
        fileName: file.name,
        contentType: file.type,
      });
      await audit(c, 'refund_capture_analyzed', 'Invoice document captured with AI', {
        entityType: 'refund_entity',
        entityId,
        metadata: { clusterId, model, confidence: extraction.confidence },
      });
      return c.json({
        success: true,
        extraction,
        upload: {
          fileName: file.name,
          storagePath,
          contentType: file.type,
          sizeBytes: file.size,
        },
      });
    } catch (error) {
      // Extraction failed — remove the stored file so nothing is orphaned.
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 500 | 502);
    }
  }),
);

/** Discard an uploaded capture the operator chose not to keep. */
app.post(
  '/:clusterId/entities/:entityId/capture/discard',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = await c.req.json().catch(() => ({}));
    const storagePath = String(body?.storagePath ?? '');
    // Only files inside this entity's captures folder can be discarded here.
    if (!storagePath.startsWith(`${clusterId}/${entityId}/captures/`)) {
      return c.json({ error: 'Invalid capture path' }, 400);
    }
    const { error } = await getSupabase().storage.from(BUCKET).remove([storagePath]);
    if (error) {
      log.error('Failed to discard capture', error);
      return c.json({ error: 'Failed to discard the uploaded file' }, 500);
    }
    return c.json({ success: true });
  }),
);

/**
 * POST /:clusterId/entities/:entityId/transactions/from-capture
 *
 * Creates the confirmed transaction and attaches the already-uploaded capture
 * document as its tax_invoice evidence in one step.
 */
app.post(
  '/:clusterId/entities/:entityId/transactions/from-capture',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = await c.req.json();
    const upload = body?.upload as
      | { fileName?: string; storagePath?: string; contentType?: string; sizeBytes?: number }
      | undefined;
    if (!upload?.storagePath?.startsWith(`${clusterId}/${entityId}/captures/`)) {
      return c.json({ error: 'Invalid capture upload reference' }, 400);
    }
    try {
      const transaction = await RefundClustersService.createTransaction(
        clusterId,
        entityId,
        body?.transaction as TransactionInput,
        c.get('userId') as string,
      );
      const { transaction: withEvidence } = await RefundClustersService.addAttachment(
        entityId,
        transaction.id,
        {
          kind: 'tax_invoice',
          fileName: String(upload.fileName ?? 'captured-invoice'),
          storagePath: upload.storagePath,
          contentType: String(upload.contentType ?? 'application/octet-stream'),
          sizeBytes: Number(upload.sizeBytes ?? 0),
          uploadedAt: new Date().toISOString(),
          uploadedBy: c.get('userId') as string,
        },
      );
      await audit(c, 'refund_transaction_created', 'Transaction created from AI capture', {
        entityType: 'refund_entity',
        entityId,
        metadata: {
          clusterId,
          transactionId: transaction.id,
          direction: transaction.direction,
          amount: transaction.amount,
          vatAmount: transaction.vatAmount,
          source: 'ai_capture',
        },
      });
      return c.json({ success: true, transaction: withEvidence }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 409 | 500);
    }
  }),
);

// ============================================================================
// VAT submissions (period lifecycle: submitted → verification → refund)
// ============================================================================

app.get(
  '/:clusterId/entities/:entityId/submissions',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const submissions = await RefundClustersService.listSubmissions(entityId);
    return c.json({ success: true, submissions });
  }),
);

/**
 * PUT /:clusterId/entities/:entityId/submissions/:periodKey
 *
 * Upserts the period's submission record. Any status other than 'open' locks
 * transaction mutations inside the period; moving a locked period back to
 * 'open' is an explicit unlock, audited at warning severity.
 */
app.put(
  '/:clusterId/entities/:entityId/submissions/:periodKey',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const pKey = c.req.param('periodKey') ?? '';
    const body = (await c.req.json()) as SubmissionInput;
    try {
      const { submission, previousStatus } = await RefundClustersService.upsertSubmission(
        clusterId,
        entityId,
        pKey,
        body,
        c.get('userId') as string,
      );
      const unlocked = isLockedStatus(previousStatus) && submission.status === 'open';
      await audit(
        c,
        unlocked ? 'vat_period_unlocked' : 'vat_submission_updated',
        unlocked
          ? `VAT period ${submission.periodLabel} unlocked for editing`
          : `VAT submission ${submission.periodLabel} → ${submission.status}`,
        {
          severity: unlocked ? 'warning' : 'info',
          entityType: 'refund_entity',
          entityId,
          metadata: {
            clusterId,
            periodKey: pKey,
            status: submission.status,
            previousStatus,
            sarsRef: submission.sarsRef,
          },
        },
      );
      return c.json({ success: true, submission });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

// ============================================================================
// VAT submission packs
// ============================================================================

interface PackPeriodBody {
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
}

function parsePackPeriod(
  body: PackPeriodBody,
): { start: string; end: string; label: string } | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const start = String(body?.periodStart ?? '');
  const end = String(body?.periodEnd ?? '');
  if (!iso.test(start) || !iso.test(end) || start > end) return null;
  return { start, end, label: String(body?.periodLabel ?? `${start} to ${end}`).slice(0, 120) };
}

/** Streams a stored file as bytes; null when missing (pack notes the gap). */
async function makeFileFetcher(supabase: ReturnType<typeof getSupabase>) {
  return async (storagePath: string): Promise<Uint8Array | null> => {
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  };
}

async function buildEntityPack(
  clusterId: string,
  entityId: string,
  period: { start: string; end: string; label: string },
): Promise<
  { zip: Uint8Array; txnCount: number; flaggedCount: number } | { error: string; status: 404 }
> {
  const cluster = await RefundClustersService.getCluster(clusterId);
  const entity = await RefundClustersService.getEntityRaw(clusterId, entityId);
  if (!cluster || !entity) return { error: 'Entity not found', status: 404 };

  const all = await RefundClustersService.listTransactions(entityId);
  const transactions = all.filter((t) => t.date >= period.start && t.date <= period.end);
  const suppliers = await SuppliersService.listSuppliers();
  const supplierVatNumbers = Object.fromEntries(suppliers.map((s) => [s.id, s.vatNumber]));
  const flags = computeTransactionFlags(transactions, { supplierVatNumbers });
  const documents = (await RefundClustersService.listDocuments(entityId)).filter((d) =>
    COMPLIANCE_PACK_DOC_TYPES.includes(d.documentType),
  );

  const zip = await buildSubmissionPack({
    cluster,
    entity,
    period,
    transactions,
    flags,
    documents,
    fetchFile: await makeFileFetcher(getSupabase()),
  });
  return {
    zip,
    txnCount: transactions.length,
    flaggedCount: transactions.filter((t) => (flags[t.id] ?? []).length > 0).length,
  };
}

/**
 * POST /:clusterId/entities/:entityId/submission-pack
 *
 * Streams the SARS verification pack (ZIP) for the given period. Never
 * stored — generated per request and audited.
 */
app.post(
  '/:clusterId/entities/:entityId/submission-pack',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const period = parsePackPeriod(await c.req.json().catch(() => ({})));
    if (!period) {
      return c.json({ error: 'periodStart and periodEnd must be ISO dates (start ≤ end)' }, 400);
    }

    const result = await buildEntityPack(clusterId, entityId, period);
    if ('error' in result) return c.json({ error: result.error }, result.status);

    await audit(c, 'vat_pack_generated', 'VAT submission pack generated', {
      entityType: 'refund_entity',
      entityId,
      metadata: {
        clusterId,
        period: period.label,
        transactions: result.txnCount,
        flagged: result.flaggedCount,
      },
    });
    return c.body(result.zip.buffer as ArrayBuffer, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="vat-pack_${period.start}_${period.end}.zip"`,
    });
  }),
);

/**
 * POST /:clusterId/submission-pack
 *
 * Cluster roll-up: one outer ZIP containing a full pack per entity for the
 * same period.
 */
app.post(
  '/:clusterId/submission-pack',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const period = parsePackPeriod(await c.req.json().catch(() => ({})));
    if (!period) {
      return c.json({ error: 'periodStart and periodEnd must be ISO dates (start ≤ end)' }, 400);
    }
    const cluster = await RefundClustersService.getCluster(clusterId);
    if (!cluster) return c.json({ error: 'Cluster not found' }, 404);

    const entities = await RefundClustersService.listEntities(clusterId);
    const { zipSync } = await import('npm:fflate@0.8.2');
    const outer: Record<string, Uint8Array> = {};
    let totalTxns = 0;
    for (const entity of entities) {
      const result = await buildEntityPack(clusterId, entity.id, period);
      if ('error' in result) continue;
      const name = (
        entity.businessDetails?.tradingName ||
        entity.businessDetails?.companyName ||
        [entity.personalDetails?.name, entity.personalDetails?.surname].filter(Boolean).join(' ') ||
        entity.id
      )
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .slice(0, 40);
      outer[`${name}_vat-pack_${period.start}_${period.end}.zip`] = result.zip;
      totalTxns += result.txnCount;
    }

    await audit(c, 'vat_pack_generated', 'Cluster VAT submission packs generated', {
      entityId: clusterId,
      metadata: {
        period: period.label,
        entities: Object.keys(outer).length,
        transactions: totalTxns,
      },
    });
    const bundle = zipSync(outer, { level: 0 }); // inner zips are already compressed
    return c.body(bundle.buffer as ArrayBuffer, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="cluster-vat-packs_${period.start}_${period.end}.zip"`,
    });
  }),
);

// ============================================================================
// Transaction attachments (evidence files: tax invoices, proof of payment, …)
// ============================================================================

const ATTACHMENT_KINDS: ReadonlyArray<AttachmentKind> = [
  'tax_invoice',
  'proof_of_payment',
  'credit_note',
  'debit_note',
  'statement',
  'other',
];

app.post(
  '/:clusterId/entities/:entityId/transactions/:txnId/attachments',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const existing = await RefundClustersService.getTransaction(entityId, txnId);
    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    const kind = typeof body['kind'] === 'string' ? (body['kind'] as AttachmentKind) : 'other';
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    if (!ATTACHMENT_KINDS.includes(kind)) {
      return c.json({ error: `kind must be one of: ${ATTACHMENT_KINDS.join(', ')}` }, 400);
    }
    const invalid = validateUpload(file);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const supabase = getSupabase();
    await ensureBucket(supabase);

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${clusterId}/${entityId}/transactions/${txnId}/${kind}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      log.error('Attachment upload failed', uploadError);
      return c.json({ error: uploadError.message }, 500);
    }

    const { transaction } = await RefundClustersService.addAttachment(entityId, txnId, {
      kind,
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: c.get('userId') as string,
      verifiedFull: body['verifiedFull'] === 'true' ? true : undefined,
    });

    await audit(c, 'refund_transaction_attachment_uploaded', `Evidence uploaded (${kind})`, {
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, transactionId: txnId, kind },
    });
    return c.json({ success: true, transaction }, 201);
  }),
);

app.get(
  '/:clusterId/entities/:entityId/transactions/:txnId/attachments/:attId/url',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';
    const attId = c.req.param('attId') ?? '';

    const attachment = await RefundClustersService.getAttachment(entityId, txnId, attId);
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(attachment.storagePath, 300);
    if (error || !data?.signedUrl) {
      log.error('Failed to create attachment signed URL', error);
      return c.json({ error: 'Failed to create attachment link' }, 500);
    }
    await audit(c, 'refund_transaction_attachment_viewed', `Evidence viewed (${attachment.kind})`, {
      entityType: 'refund_entity',
      entityId,
      metadata: { transactionId: txnId, attachmentId: attId, kind: attachment.kind },
    });
    return c.json({ success: true, url: data.signedUrl, fileName: attachment.fileName });
  }),
);

/** Toggle the "full tax invoice verified" confirmation on an attachment. */
app.put(
  '/:clusterId/entities/:entityId/transactions/:txnId/attachments/:attId',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';
    const attId = c.req.param('attId') ?? '';
    const body = await c.req.json().catch(() => ({}));
    try {
      const transaction = await RefundClustersService.setAttachmentVerifiedFull(
        entityId,
        txnId,
        attId,
        body?.verifiedFull === true,
      );
      await audit(c, 'refund_transaction_attachment_verified', 'Evidence verification updated', {
        entityType: 'refund_entity',
        entityId,
        metadata: {
          transactionId: txnId,
          attachmentId: attId,
          verifiedFull: body?.verifiedFull === true,
        },
      });
      return c.json({ success: true, transaction });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/transactions/:txnId/attachments/:attId',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';
    const attId = c.req.param('attId') ?? '';

    const attachment = await RefundClustersService.getAttachment(entityId, txnId, attId);
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }
    // Only drop the metadata once storage confirms the file is gone.
    const { error } = await getSupabase().storage.from(BUCKET).remove([attachment.storagePath]);
    if (error) {
      log.error('Failed to remove attachment from storage', error);
      return c.json({ error: 'Failed to delete the stored file — please try again' }, 500);
    }
    const transaction = await RefundClustersService.removeAttachment(entityId, txnId, attId);
    await audit(
      c,
      'refund_transaction_attachment_deleted',
      `Evidence deleted (${attachment.kind})`,
      {
        severity: 'warning',
        entityType: 'refund_entity',
        entityId,
        metadata: { transactionId: txnId, attachmentId: attId, kind: attachment.kind },
      },
    );
    return c.json({ success: true, transaction });
  }),
);

// ============================================================================
// Managers
// ============================================================================

app.get(
  '/:clusterId/managers',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const managers = await RefundClustersService.listManagers(clusterId);
    return c.json({ success: true, managers });
  }),
);

app.post(
  '/:clusterId/managers',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const body = (await c.req.json()) as ManagerInput;
    try {
      const manager = await RefundClustersService.createManager(
        clusterId,
        body,
        c.get('userId') as string,
      );
      await audit(c, 'refund_manager_created', 'Refund manager created', {
        entityType: 'refund_manager',
        entityId: manager.id,
        metadata: { clusterId },
      });
      return c.json({ success: true, manager }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.put(
  '/:clusterId/managers/:managerId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const managerId = c.req.param('managerId') ?? '';
    const body = (await c.req.json()) as ManagerInput;
    try {
      const manager = await RefundClustersService.updateManager(clusterId, managerId, body);
      await audit(c, 'refund_manager_updated', 'Refund manager updated', {
        entityType: 'refund_manager',
        entityId: managerId,
        metadata: { clusterId },
      });
      return c.json({ success: true, manager });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId/managers/:managerId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const managerId = c.req.param('managerId') ?? '';
    try {
      await RefundClustersService.deleteManager(clusterId, managerId);
      await audit(c, 'refund_manager_deleted', 'Refund manager deleted', {
        severity: 'warning',
        entityType: 'refund_manager',
        entityId: managerId,
        metadata: { clusterId },
      });
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

export default app;
