/**
 * Refund Clusters Routes
 *
 * Locked → Accounts → Refund Clusters. Stores highly sensitive tax, banking
 * and identity information, so every route requires SUPER ADMIN access and
 * every mutation / sensitive read is written to the admin audit trail.
 *
 * Static routes are registered before parameterised routes (§14.2).
 *
 * Transaction routes live in ./refund-clusters-transactions-routes.ts and are
 * mounted at the bottom of this file; shared helpers live in
 * ./refund-clusters-shared.ts. The split keeps each file small enough for the
 * edge-function deploy bundler.
 */

import { Hono } from 'npm:hono';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import {
  RefundClustersService,
  type EntityInput,
  type ManagerInput,
} from './refund-clusters-service.ts';
import {
  BUCKET,
  audit,
  errStatus,
  getSupabase,
  validateUpload,
  ensureBucket,
} from './refund-clusters-shared.ts';
import transactionsApp from './refund-clusters-transactions-routes.ts';

const app = new Hono();
const log = createModuleLogger('refund-clusters-routes');

// Every route in this module is super-admin only.
app.use('*', requireSuperAdmin);

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
        ...txns.flatMap((t) => (t.invoice ? [t.invoice.storagePath] : [])),
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
      ...txns.flatMap((t) => (t.invoice ? [t.invoice.storagePath] : [])),
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

// Transaction routes (per-entity VAT ledger + invoices) — sibling module.
app.route('/', transactionsApp);

export default app;
