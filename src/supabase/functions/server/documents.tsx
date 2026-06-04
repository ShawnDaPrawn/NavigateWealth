/**
 * Document Management Routes
 * Handles document uploads, links, and client document history
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import documentsEmailRoutes from './documents-email-routes.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { CreateDocumentLinkSchema, UpdateDocumentSchema } from './documents-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
app.route('/', documentsEmailRoutes);
const log = createModuleLogger('documents');

// Root handlers
app.get('/', (c) => c.json({ service: 'documents', status: 'active' }));
app.get('', (c) => c.json({ service: 'documents', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const BUCKET_NAME = 'make-91ed8379-documents';

// Lazy bucket initialization — called on first request, not at module load time.
let bucketInitialized = false;
async function ensureBucket() {
  if (bucketInitialized) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      log.info(`📁 Creating storage bucket: ${BUCKET_NAME}`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'image/gif',
        ],
      });

      if (error) {
        if (error.message && error.message.includes('already exists')) {
          log.info('✅ Storage bucket already exists');
        } else {
          log.error('❌ Error creating bucket:', error);
        }
      } else {
        log.info('✅ Storage bucket created successfully');
      }
    } else {
      log.info('✅ Storage bucket already exists');
    }
    bucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      log.info('✅ Storage bucket already exists');
      bucketInitialized = true;
    } else {
      log.warn('⚠️ Error initializing bucket (non-critical):', { error });
    }
  }
}

export interface DocumentMetadata {
  id: string;
  userId: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: string;
  productCategory:
    | 'Life'
    | 'Short-Term'
    | 'Investment'
    | 'Medical Aid'
    | 'Retirement'
    | 'Estate'
    | 'General';
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  uploadedBy: string; // Admin user ID who uploaded
  // Grouping
  packId?: string;
  packTitle?: string;
  subcategory?: string;
  // Document specific
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific
  url?: string;
  description?: string;
  // Visibility
  isHidden?: boolean;
}

/**
 * GET /documents/:userId
 * Get all documents for a specific user
 */
app.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    log.info(`📄 Fetching documents for user: ${userId}`);

    // Get document metadata from KV store
    const documents = await kv.getByPrefix(`document:${userId}:`);

    // Filter out null/undefined values and ensure all documents have valid data
    // Note: getByPrefix returns an array of values directly, not {key, value} objects
    const validDocuments = documents
      .filter((doc) => doc && doc.id)
      .filter((doc) => doc !== null && doc !== undefined)
      .filter((doc) => !doc.isHidden); // Filter out hidden documents (e.g. from communication tab)

    log.info(`✅ Found ${validDocuments.length} documents for user ${userId}`);

    return c.json({
      success: true,
      count: validDocuments.length,
      documents: validDocuments,
    });
  } catch (error) {
    log.error('❌ Error fetching documents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

/**
 * POST /documents/:userId/upload
 * Upload a document file for a user
 */
app.post('/:userId/upload', async (c) => {
  try {
    const userId = c.req.param('userId');

    // Wrap formData() in try/catch — the native parser uses forEach()
    // internally, which throws if the body is not valid multipart/form-data
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json(
        {
          success: false,
          error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
        },
        400,
      );
    }

    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const productCategory = formData.get('productCategory') as string;
    const policyNumber = formData.get('policyNumber') as string;
    const uploadedBy = formData.get('uploadedBy') as string;
    const packId = formData.get('packId') as string;
    const packTitle = formData.get('packTitle') as string;
    const subcategory = formData.get('subcategory') as string;
    const isHidden = formData.get('isHidden') === 'true';

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    log.info(`📤 Uploading document: ${file.name} for user: ${userId}`);

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await getSupabase()
      .storage.from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      log.error('❌ Upload error:', uploadError);
      return c.json({ success: false, error: uploadError.message }, 500);
    }

    log.info('✅ File uploaded to storage:', { filePath });

    // Create document metadata
    const documentId = `doc_${timestamp}`;
    const metadata: DocumentMetadata = {
      id: documentId,
      userId,
      type: 'document',
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      filePath,
      uploadDate: new Date().toISOString(),
      productCategory: (productCategory as string) || 'General',
      policyNumber: policyNumber || '',
      status: 'new',
      isFavourite: false,
      uploadedBy,
      packId: packId || undefined,
      packTitle: packTitle || undefined,
      subcategory: subcategory || undefined,
      isHidden,
    };

    // Store metadata in KV
    await kv.set(`document:${userId}:${documentId}`, metadata);

    log.info('✅ Document metadata saved');

    return c.json({
      success: true,
      document: metadata,
    });
  } catch (error: unknown) {
    log.error('❌ Error uploading document:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload document',
      },
      500,
    );
  }
});

/**
 * POST /documents/:userId/link
 * Create a link reference for a user
 */
app.post('/:userId/link', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();

    const parsed = CreateDocumentLinkSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { title, url, description, productCategory, policyNumber, uploadedBy } = parsed.data;

    log.info(`🔗 Creating link for user: ${userId} - ${title}`);

    const timestamp = Date.now();
    const linkId = `link_${timestamp}`;

    const metadata: DocumentMetadata = {
      id: linkId,
      userId,
      type: 'link',
      title,
      url,
      description: description || '',
      uploadDate: new Date().toISOString(),
      productCategory: productCategory || 'General',
      policyNumber: policyNumber || '',
      status: 'new',
      isFavourite: false,
      uploadedBy,
    };

    // Store metadata in KV
    await kv.set(`document:${userId}:${linkId}`, metadata);

    log.info('✅ Link metadata saved');

    return c.json({
      success: true,
      document: metadata,
    });
  } catch (error: unknown) {
    log.error('❌ Error creating link:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create link' },
      500,
    );
  }
});

/**
 * GET /documents/:userId/:documentId/download
 * Get a signed URL for downloading a document
 */
app.get('/:userId/:documentId/download', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');

    log.info(`⬇️ Generating download URL for: ${documentId}`);

    // Get document metadata
    const docData = await kv.get(`document:${userId}:${documentId}`);

    if (!docData || !docData.filePath) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    if (docData.sourceSystem === 'record-of-advice') {
      const storedRoAFile = (await kv.get(docData.filePath)) as Record<string, unknown> | null;

      const blobStoragePath =
        typeof storedRoAFile?.blobStoragePath === 'string'
          ? storedRoAFile.blobStoragePath.trim()
          : '';
      if (blobStoragePath) {
        await ensureBucket();
        const { data: blobSigned, error: blobSignedErr } = await getSupabase()
          .storage.from(BUCKET_NAME)
          .createSignedUrl(blobStoragePath, 3600);

        if (!blobSignedErr && blobSigned?.signedUrl) {
          log.info('✅ RoA document signed URL (object storage)');
          return c.json({
            success: true,
            url: blobSigned.signedUrl,
            fileName: docData.fileName,
            contentType:
              typeof docData.contentType === 'string'
                ? docData.contentType
                : typeof storedRoAFile?.contentType === 'string'
                  ? storedRoAFile.contentType
                  : typeof storedRoAFile?.mimeType === 'string'
                    ? storedRoAFile.mimeType
                    : 'application/octet-stream',
            sha256: typeof docData.sha256 === 'string' ? docData.sha256 : storedRoAFile?.sha256,
          });
        }
        log.warn('RoA blob signed URL failed — falling back to embedded bytes if present', {
          message: blobSignedErr?.message,
        });
      }

      const bytesBase64 =
        typeof storedRoAFile?.bytesBase64 === 'string'
          ? storedRoAFile.bytesBase64
          : typeof storedRoAFile?.downloadBase64 === 'string'
            ? storedRoAFile.downloadBase64
            : '';
      const contentType =
        typeof docData.contentType === 'string'
          ? docData.contentType
          : typeof storedRoAFile?.contentType === 'string'
            ? storedRoAFile.contentType
            : typeof storedRoAFile?.mimeType === 'string'
              ? storedRoAFile.mimeType
              : 'application/octet-stream';

      if (!bytesBase64) {
        return c.json({ success: false, error: 'RoA document content not found' }, 404);
      }

      log.info('RoA document URL generated (embedded payload)');
      return c.json({
        success: true,
        url: `data:${contentType};base64,${bytesBase64}`,
        fileName: docData.fileName,
        contentType,
        sha256: typeof docData.sha256 === 'string' ? docData.sha256 : storedRoAFile?.sha256,
      });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await getSupabase()
      .storage.from(BUCKET_NAME)
      .createSignedUrl(docData.filePath, 3600);

    if (signedUrlError) {
      log.error('❌ Signed URL error:', signedUrlError);
      return c.json({ success: false, error: signedUrlError.message }, 500);
    }

    log.info('✅ Signed URL generated');

    return c.json({
      success: true,
      url: signedUrlData.signedUrl,
      fileName: docData.fileName,
    });
  } catch (error: unknown) {
    log.error('❌ Error generating download URL:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL',
      },
      500,
    );
  }
});

/**
 * PATCH /documents/:userId/:documentId
 * Update document metadata (mark as viewed, toggle favorite, etc.)
 */
app.patch('/:userId/:documentId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');
    const body = await c.req.json();
    const parsed = UpdateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const updates = parsed.data;

    log.info(`✏️ Updating document: ${documentId}`, updates);

    // Get existing document
    const existingDoc = await kv.get(`document:${userId}:${documentId}`);

    if (!existingDoc) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // Merge updates
    const updatedDoc = {
      ...existingDoc,
      ...updates,
    };

    // Save updated document
    await kv.set(`document:${userId}:${documentId}`, updatedDoc);

    log.info('✅ Document updated');

    return c.json({
      success: true,
      document: updatedDoc,
    });
  } catch (error: unknown) {
    log.error('❌ Error updating document:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document',
      },
      500,
    );
  }
});

/**
 * DELETE /documents/:userId/:documentId
 * Delete a document (both metadata and file if applicable)
 */
app.delete('/:userId/:documentId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');

    log.info(`🗑️ Deleting document: ${documentId}`);

    // Get document metadata
    const docData = await kv.get(`document:${userId}:${documentId}`);

    if (!docData) {
      // Idempotent: If document is already gone, return success
      log.info('⚠️ Document not found, assuming already deleted');
      return c.json({
        success: true,
        message: 'Document deleted successfully',
      });
    }

    // If it's a file document, delete from storage
    if (docData.type === 'document' && docData.filePath) {
      const { error: deleteError } = await getSupabase()
        .storage.from(BUCKET_NAME)
        .remove([docData.filePath]);

      if (deleteError) {
        log.warn('⚠️ Error deleting file from storage:', { error: String(deleteError) });
        // Continue anyway to delete metadata
      } else {
        log.info('✅ File deleted from storage');
      }
    }

    // Delete metadata from KV
    await kv.del(`document:${userId}:${documentId}`);

    log.info('✅ Document metadata deleted');

    return c.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: unknown) {
    log.error('❌ Error deleting document:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      },
      500,
    );
  }
});

export default app;
