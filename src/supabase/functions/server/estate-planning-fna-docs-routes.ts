import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser } from './fna-auth.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const app = new Hono();
const log = createModuleLogger('estate-planning-fna-docs-routes');

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const LEGAL_DOCS_BUCKET = 'make-91ed8379-legal-docs';

let legalBucketInitialized = false;
async function ensureLegalDocsBucket() {
  if (legalBucketInitialized) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === LEGAL_DOCS_BUCKET);

    if (!bucketExists) {
      log.info(`Creating storage bucket: ${LEGAL_DOCS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(LEGAL_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Legal docs bucket already exists');
        } else {
          log.error('Error creating legal docs bucket:', error);
        }
      } else {
        log.info('Legal docs bucket created successfully');
      }
    }
    legalBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      legalBucketInitialized = true;
    } else {
      log.warn('Error initializing legal docs bucket (non-critical):', { error });
    }
  }
}

app.post('/estate-docs/:clientId/upload', async (c) => {
  try {
    log.info('POST /estate-planning-fna/estate-docs/:clientId/upload');
    const user = await authenticateUser(c.req.header('Authorization'));
    await ensureLegalDocsBucket();

    const clientId = c.req.param('clientId');
    const formData = await c.req.formData();

    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const notes = formData.get('notes') as string | null;
    const signingDate = formData.get('signingDate') as string | null;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    if (!title || !documentType) {
      return c.json({ success: false, error: 'Title and document type are required' }, 400);
    }

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

    const docId = `edoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `estate-docs/${clientId}/${docId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      log.error('Storage upload failed for estate document:', uploadError);
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
      notes: notes || '',
      signingDate: signingDate || null,
      fileName: file.name,
      fileSize: file.size,
      filePath: storagePath,
      mimeType: file.type,
      uploadedBy: user?.email || user?.id || 'admin',
      uploadedAt: timestamp,
      updatedAt: timestamp,
    };

    const kvKey = `estate_doc:${clientId}:${docId}`;
    await kv.set(kvKey, document);

    log.info('Estate document uploaded:', { docId, clientId, documentType });

    return c.json({ success: true, data: document });
  } catch (error: unknown) {
    log.error('Error uploading estate document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.get('/estate-docs/:clientId', async (c) => {
  try {
    log.info('GET /estate-planning-fna/estate-docs/:clientId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docs = await kv.getByPrefix(`estate_doc:${clientId}:`);

    const sorted = (docs || []).sort(
      (a: { uploadedAt?: string }, b: { uploadedAt?: string }) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime(),
    );

    log.info(`Retrieved ${sorted.length} estate documents for client:`, { clientId });

    return c.json({ success: true, data: sorted });
  } catch (error: unknown) {
    log.error('Error fetching estate documents:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.get('/estate-docs/:clientId/:docId/download', async (c) => {
  try {
    log.info('GET /estate-planning-fna/estate-docs/:clientId/:docId/download');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docId = c.req.param('docId');

    const kvKey = `estate_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Estate document not found' }, 404);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .createSignedUrl(doc.filePath, 3600);

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for estate document:', error);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      fileName: doc.fileName,
    });
  } catch (error: unknown) {
    log.error('Error fetching estate document download URL:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.delete('/estate-docs/:clientId/:docId', async (c) => {
  try {
    log.info('DELETE /estate-planning-fna/estate-docs/:clientId/:docId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');
    const docId = c.req.param('docId');

    const kvKey = `estate_doc:${clientId}:${docId}`;
    const doc = await kv.get(kvKey);

    if (!doc) {
      return c.json({ success: false, error: 'Estate document not found' }, 404);
    }

    const supabase = getSupabase();
    const { error: deleteError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .remove([doc.filePath]);

    if (deleteError) {
      log.warn('Failed to delete estate document from storage (non-critical):', {
        error: String(deleteError),
      });
    }

    await kv.del(kvKey);

    log.info('Estate document deleted:', { docId, clientId });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Error deleting estate document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

export default app;
