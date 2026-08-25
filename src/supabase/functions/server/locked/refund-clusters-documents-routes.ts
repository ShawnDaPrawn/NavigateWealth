/**
 * Document routes for refund clusters entities.
 *
 * Mounted at '/' by refund-clusters-routes.ts (which also registers the
 * super-admin guard), so requireSuperAdmin is intentionally NOT repeated here.
 */

import { Hono } from 'npm:hono';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import { RefundClustersService } from './refund-clusters-service.ts';
import {
  BUCKET,
  audit,
  errStatus,
  getSupabase,
  validateUpload,
  ensureBucket,
} from './refund-clusters-shared.ts';

const app = new Hono();
const log = createModuleLogger('refund-clusters-documents-routes');

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

export default app;
