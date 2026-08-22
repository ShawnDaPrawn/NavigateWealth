/**
 * Tax Planning FNA Routes
 * Backend API endpoints for Tax Planning Financial Needs Analysis
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse } from './fna-auth.ts';
import { assertClientAccess, assertRecordClientAccess } from './client-access.ts';
import { SaveTaxPlanningSessionSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const taxPlanningRoutes = new Hono();
const log = createModuleLogger('tax-planning-fna-routes');

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const TAX_DOCS_BUCKET = 'make-91ed8379-tax-docs';

// Lazy bucket initialization â€” called on first document request, not at module load time.
let taxDocsBucketInitialized = false;
async function ensureTaxDocsBucket() {
  if (taxDocsBucketInitialized) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === TAX_DOCS_BUCKET);

    if (!bucketExists) {
      log.info(`Creating storage bucket: ${TAX_DOCS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(TAX_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      });
      if (error) {
        log.error(`Failed to create bucket ${TAX_DOCS_BUCKET}:`, error);
        throw error;
      }
    }
    taxDocsBucketInitialized = true;
  } catch (error) {
    log.error('Error ensuring tax docs bucket:', error);
    throw error;
  }
}

// Root handlers
taxPlanningRoutes.get('/', (c) => c.json({ service: 'tax-planning-fna', status: 'active' }));
taxPlanningRoutes.get('', (c) => c.json({ service: 'tax-planning-fna', status: 'active' }));

taxPlanningRoutes.post('/client/:clientId/auto-populate', async (c) => {
  try {
    log.info('POST /tax-planning-fna/client/:clientId/auto-populate');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:auto-populate');

    const { taxAutoPopulateFromResolver, enrichTaxFromDomainSessions } =
      await import('./form-prefill-auto-populate.ts');
    let inputs = await taxAutoPopulateFromResolver(clientId);
    inputs = await enrichTaxFromDomainSessions(clientId, inputs);

    log.info('Auto-populated Tax Planning inputs for client:', { clientId });

    return c.json({
      success: true,
      data: inputs,
    });
  } catch (error: unknown) {
    log.error('Error auto-populating Tax Planning inputs:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * POST /tax-planning-fna/save
 * Save Tax Planning session (Final Tax Plan)
 */
taxPlanningRoutes.post('/save', async (c) => {
  try {
    log.info('ðŸ“¥ POST /tax-planning-fna/save');
    const authUser = await authenticateUser(c.req.header('Authorization'), 'tax-planning-fna');

    const body = await c.req.json();
    // Destructure new fields: adjustments, recommendations, finalResults
    const { clientId, inputs, finalResults, adjustments, recommendations, adviserNotes, status } =
      body;

    await assertClientAccess(authUser, clientId, 'tax-planning-fna:save');

    // Validate the input data
    const validationResult = SaveTaxPlanningSessionSchema.safeParse(body);
    if (!validationResult.success) {
      const formattedError = formatZodError(validationResult.error);
      return c.json(
        {
          success: false,
          error: formattedError,
        },
        400,
      );
    }

    // Get existing sessions to determine version
    const sessions = await kv.getByPrefix(`tax-planning-fna:client:${clientId}:`);
    const version = (sessions?.length || 0) + 1;

    const sessionId = `${clientId}-v${version}`;
    const timestamp = new Date().toISOString();

    // Structure as FinalTaxPlan (mostly) but wrapped in session metadata
    const session = {
      id: sessionId,
      clientId,
      adviserId: authUser.id,
      version,
      status: status || 'published',

      // The Plan Data
      inputs,
      finalResults,
      adjustments: adjustments || [],
      recommendations: recommendations || [],
      adviserNotes: adviserNotes || '',

      createdAt: timestamp,
      updatedAt: timestamp,
      generatedAt: timestamp,
      createdBy: 'Adviser', // Default for now since we don't have user name
    };

    const key = `tax-planning-fna:client:${clientId}:${sessionId}`;
    await kv.set(key, session);

    log.info('âœ… Tax Planning session saved:', { sessionId });

    return c.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    log.error('âŒ Error saving Tax Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /tax-planning-fna/client/:clientId
 * Get all Tax Planning sessions for a client
 */
taxPlanningRoutes.get('/client/:clientId', async (c) => {
  try {
    log.info('ðŸ“¥ GET /tax-planning-fna/client/:clientId');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:list');

    const sessions = await kv.getByPrefix(`tax-planning-fna:client:${clientId}:`);
    const sortedSessions = (sessions || []).sort(
      (a: VersionedSession, b: VersionedSession) => b.version - a.version,
    );

    return c.json({
      success: true,
      data: sortedSessions,
    });
  } catch (error: unknown) {
    log.error('âŒ Error fetching Tax Planning sessions:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /tax-planning-fna/client/:clientId/latest-published
 */
taxPlanningRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    const clientId = c.req.param('clientId')!;
    const user = await authenticateUser(c.req.header('Authorization'));
    await assertClientAccess(user, clientId, 'tax-planning-fna:latest-published');

    const sessions = await kv.getByPrefix(`tax-planning-fna:client:${clientId}:`);
    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);

    return c.json({ success: true, data: published[0] || null });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// ==================== TAX DOCUMENTS (AD-HOC TAX DOC UPLOADS) ====================
// IMPORTANT: Tax document routes registered BEFORE /:fnaId catch-all (per Guidelines Â§14.2)

/**
 * POST /tax-planning-fna/tax-docs/:clientId/upload
 * Upload an ad-hoc tax document not tied to a specific tax policy record.
 * E.g., tax returns, IRP5 certificates, SARS assessments.
 */
taxPlanningRoutes.post('/tax-docs/:clientId/upload', async (c) => {
  try {
    log.info('POST /tax-planning-fna/tax-docs/:clientId/upload');
    const user = await authenticateUser(c.req.header('Authorization'));
    await ensureTaxDocsBucket();

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:doc-upload');

    const formData = await c.req.formData();

    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const notes = formData.get('notes') as string | null;
    const taxYear = formData.get('taxYear') as string | null;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    if (!title || !documentType) {
      return c.json({ success: false, error: 'Title and document type are required' }, 400);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        {
          success: false,
          error: 'Invalid file type. Only PDF, JPEG, and PNG files are allowed.',
        },
        400,
      );
    }

    // Generate unique document ID
    const docId = `tdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `tax-docs/${clientId}/${docId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(TAX_DOCS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      log.error('Storage upload failed for tax document:', uploadError);
      return c.json(
        {
          success: false,
          error: `Failed to upload document: ${uploadError.message}`,
        },
        500,
      );
    }

    const timestamp = new Date().toISOString();
    const document = {
      id: docId,
      clientId,
      title,
      documentType,
      taxYear: taxYear || null,
      notes: notes || '',
      fileName: file.name,
      fileSize: file.size,
      filePath: storagePath,
      mimeType: file.type,
      uploadedBy: user?.email || user?.id || 'admin',
      uploadedAt: timestamp,
      updatedAt: timestamp,
    };

    const kvKey = `tax_doc:${clientId}:${docId}`;
    await kv.set(kvKey, document);

    log.info('Tax document uploaded:', { docId, clientId, documentType });

    return c.json({ success: true, data: document });
  } catch (error: unknown) {
    log.error('Error uploading tax document:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /tax-planning-fna/tax-docs/:clientId
 * List all tax documents for a client.
 */
taxPlanningRoutes.get('/tax-docs/:clientId', async (c) => {
  try {
    log.info('GET /tax-planning-fna/tax-docs/:clientId');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:doc-list');

    const docs = await kv.getByPrefix(`tax_doc:${clientId}:`);

    const sorted = (docs || []).sort(
      (a: { uploadedAt?: string }, b: { uploadedAt?: string }) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime(),
    );

    log.info(`Retrieved ${sorted.length} tax documents for client:`, { clientId });

    return c.json({ success: true, data: sorted });
  } catch (error: unknown) {
    log.error('Error fetching tax documents:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /tax-planning-fna/tax-docs/:clientId/:docId/download
 * Get a signed URL to download a tax document.
 */
taxPlanningRoutes.get('/tax-docs/:clientId/:docId/download', async (c) => {
  try {
    log.info('GET /tax-planning-fna/tax-docs/:clientId/:docId/download');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    const docId = c.req.param('docId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:doc-download');

    const kvKey = `tax_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Tax document not found' }, 404);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(TAX_DOCS_BUCKET)
      .createSignedUrl(doc.filePath, 3600);

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for tax document:', error);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      fileName: doc.fileName,
    });
  } catch (error: unknown) {
    log.error('Error fetching tax document download URL:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * DELETE /tax-planning-fna/tax-docs/:clientId/:docId
 * Delete a tax document (from storage and KV).
 */
taxPlanningRoutes.delete('/tax-docs/:clientId/:docId', async (c) => {
  try {
    log.info('DELETE /tax-planning-fna/tax-docs/:clientId/:docId');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    const docId = c.req.param('docId')!;
    await assertClientAccess(user, clientId, 'tax-planning-fna:doc-delete');

    const kvKey = `tax_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Tax document not found' }, 404);
    }

    // Remove from storage
    const supabase = getSupabase();
    const { error: deleteError } = await supabase.storage
      .from(TAX_DOCS_BUCKET)
      .remove([doc.filePath]);

    if (deleteError) {
      log.warn('Failed to delete tax document from storage (non-critical):', {
        error: String(deleteError),
      });
    }

    // Remove from KV
    await kv.del(kvKey);

    log.info('Tax document deleted:', { docId, clientId });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Error deleting tax document:', error);
    return fnaErrorResponse(c, error);
  }
});

// ==================== LEGACY FNA ROUTES (CATCH-ALL) ====================
// Kept for backward compatibility with previously published FNAs

/**
 * GET /:fnaId
 * Get a specific Tax Planning FNA session by its ID
 */
taxPlanningRoutes.get('/:fnaId', async (c) => {
  try {
    log.info('GET /tax-planning-fna/:fnaId');
    const user = await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;

    // fnaId format is "${clientId}-v${version}"
    const match = fnaId.match(/^(.+)-v(\d+)$/);

    if (match) {
      const clientId = match[1];
      const key = `tax-planning-fna:client:${clientId}:${fnaId}`;
      const fna = await kv.get(key);

      if (fna) {
        // The owner comes from the stored record, not from the id the caller
        // supplied — the two only agree for a caller who already knew both.
        await assertRecordClientAccess(user, fna, 'tax-planning-fna:read');
        return c.json({ success: true, data: fna });
      }
    }

    // Fallback: search all tax-planning FNA entries by prefix
    const allSessions = await kv.getByPrefix('tax-planning-fna:client:');
    const found = (allSessions || []).find((s: VersionedSession) => s.id === fnaId);

    if (found) {
      await assertRecordClientAccess(user, found, 'tax-planning-fna:read');
      return c.json({ success: true, data: found });
    }

    return c.json({ success: false, error: 'Tax Planning FNA not found' }, 404);
  } catch (error: unknown) {
    log.error('Error fetching Tax Planning FNA by ID:', error);
    return fnaErrorResponse(c, error);
  }
});

export default taxPlanningRoutes;

interface VersionedSession {
  version: number;
  status?: string;
  [key: string]: unknown;
}
