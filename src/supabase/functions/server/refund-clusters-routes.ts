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
import { requireSuperAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { RefundClustersService, type EntityInput } from './refund-clusters-service.ts';

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
  // Fire-and-forget — AdminAuditService.record never throws.
  void AdminAuditService.record({
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
      createdBy: c.get('userId') as string,
    });
    audit(c, 'refund_cluster_created', 'Refund cluster created', { entityId: cluster.id });
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
        archived: body?.archived,
      });
      const action =
        body?.archived === true
          ? 'refund_cluster_archived'
          : body?.archived === false
            ? 'refund_cluster_unarchived'
            : 'refund_cluster_updated';
      audit(c, action, 'Refund cluster updated', { entityId: clusterId });
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
      const { entitiesDeleted } = await RefundClustersService.deleteCluster(clusterId);
      audit(c, 'refund_cluster_deleted', 'Refund cluster deleted', {
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
    audit(c, 'refund_cluster_viewed', 'Refund cluster opened', {
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
      audit(c, 'refund_entity_created', `Refund entity created (${entity.entityType})`, {
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
      audit(c, 'refund_entity_updated', 'Refund entity updated', {
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
    const docs = await RefundClustersService.deleteEntityRecords(clusterId, entityId);

    // Best-effort removal of the underlying storage objects.
    if (docs.length > 0) {
      const { error } = await getSupabase()
        .storage.from(BUCKET)
        .remove(docs.map((d) => d.storagePath));
      if (error) log.error('Failed to remove entity files from storage', error);
    }

    audit(c, 'refund_entity_deleted', 'Refund entity deleted', {
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
      audit(c, 'refund_entity_password_revealed', 'eFiling password revealed', {
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
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: 'File exceeds the 10MB limit' }, 400);
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json({ error: 'Only PDF, JPEG and PNG files are allowed' }, 400);
    }

    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
    }

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

    audit(c, 'refund_entity_document_uploaded', `Document uploaded (${documentType})`, {
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

    audit(c, 'refund_entity_document_viewed', `Document viewed (${document.documentType})`, {
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

    const { error } = await getSupabase().storage.from(BUCKET).remove([document.storagePath]);
    if (error) log.error('Failed to remove document from storage', error);

    await RefundClustersService.deleteDocument(entityId, docId);
    audit(c, 'refund_entity_document_deleted', `Document deleted (${document.documentType})`, {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { documentId: docId, documentType: document.documentType },
    });
    return c.json({ success: true });
  }),
);

export default app;
