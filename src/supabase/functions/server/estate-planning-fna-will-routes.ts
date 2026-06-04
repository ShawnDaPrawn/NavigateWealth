import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser } from './fna-auth.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const app = new Hono();
const log = createModuleLogger('estate-planning-fna-will-routes');

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

interface VersionedSession {
  version: number;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

function parseWillId(willId: string): { clientId: string; type: string } {
  const lastWillMatch = willId.match(/^(.+)-(last_will)-v\d+$/);
  const livingWillMatch = willId.match(/^(.+)-(living_will)-v\d+$/);
  const match = lastWillMatch || livingWillMatch;
  if (!match) {
    throw new Error(`Invalid willId format: ${willId}`);
  }
  return { clientId: match[1], type: match[2] };
}

app.get('/wills/client/:clientId/profile-prefill', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/client/:clientId/profile-prefill');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');

    const [profile, clientKeys] = await Promise.all([
      kv.get(`user_profile:${clientId}:personal_info`),
      kv.get(`user_profile:${clientId}:client_keys`),
    ]);

    if (!profile && !clientKeys) {
      log.warn('⚠️ No client data found for will pre-fill', { clientId });
      return c.json({ success: true, profile: null, clientKeys: null });
    }

    log.info('✅ Client data retrieved for will pre-fill', {
      clientId,
      hasProfile: !!profile,
      hasClientKeys: !!clientKeys,
      profileKeys: profile ? Object.keys(profile) : [],
      clientKeyIds: clientKeys ? Object.keys(clientKeys) : [],
    });

    return c.json({ success: true, profile, clientKeys });
  } catch (error: unknown) {
    log.error('❌ Error fetching client profile for will pre-fill:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.post('/wills/create', async (c) => {
  try {
    log.info('📥 POST /estate-planning-fna/wills/create');
    const user = await authenticateUser(c.req.header('Authorization'));

    const body = await c.req.json();
    const { clientId, type, data } = body;

    if (!clientId || !type || !data) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: clientId, type, data',
        },
        400,
      );
    }

    if (!['last_will', 'living_will'].includes(type)) {
      return c.json(
        {
          success: false,
          error: 'Invalid will type. Must be "last_will" or "living_will"',
        },
        400,
      );
    }

    const existingWills = await kv.getByPrefix(`will:${clientId}:${type}:`);
    const version = (existingWills?.length || 0) + 1;

    const willId = `${clientId}-${type}-v${version}`;
    const timestamp = new Date().toISOString();

    const will = {
      id: willId,
      clientId,
      clientName: data?.personalDetails?.fullName || '',
      type,
      version,
      status: 'draft',
      data,
      createdBy: user?.email || user?.id || 'admin',
      createdAt: timestamp,
      updatedAt: timestamp,
      finalizedAt: null,
      finalizedBy: null,
    };

    const key = `will:${clientId}:${type}:${willId}`;
    await kv.set(key, will);

    log.info('✅ Will draft created:', { willId, type });

    return c.json({
      success: true,
      data: will,
    });
  } catch (error: unknown) {
    log.error('❌ Error creating will draft:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.put('/wills/:willId', async (c) => {
  try {
    log.info('📥 PUT /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const key = `will:${clientId}:${type}:${willId}`;
    const existingWill = await kv.get(key);

    if (!existingWill) {
      return c.json(
        {
          success: false,
          error: 'Will not found',
        },
        404,
      );
    }

    if (existingWill.status === 'finalized') {
      return c.json(
        {
          success: false,
          error: 'Cannot update a finalized will',
        },
        400,
      );
    }

    const body = await c.req.json();
    const { data } = body;

    if (!data) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: data',
        },
        400,
      );
    }

    const updatedWill = {
      ...existingWill,
      data,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(key, updatedWill);

    log.info('✅ Will draft updated:', { willId });

    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('❌ Error updating will draft:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.get('/wills/client/:clientId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/client/:clientId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId');

    const wills = await kv.getByPrefix(`will:${clientId}:`);
    const sortedWills = (wills || []).sort(
      (a: VersionedSession, b: VersionedSession) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );

    log.info(`✅ Retrieved ${sortedWills.length} wills for client:`, { clientId });

    return c.json({
      success: true,
      data: sortedWills,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching wills:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.get('/wills/:willId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const key = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(key);

    if (!will) {
      return c.json(
        {
          success: false,
          error: 'Will not found',
        },
        404,
      );
    }

    log.info('✅ Will retrieved:', { willId });

    return c.json({
      success: true,
      data: will,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.put('/wills/:willId/finalize', async (c) => {
  try {
    log.info('📥 PUT /estate-planning-fna/wills/:willId/finalize');
    const user = await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const key = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(key);

    if (!will) {
      return c.json(
        {
          success: false,
          error: 'Will not found',
        },
        404,
      );
    }

    if (will.status === 'finalized') {
      return c.json(
        {
          success: false,
          error: 'Will is already finalized',
        },
        400,
      );
    }

    if (will.status === 'signed') {
      return c.json(
        {
          success: false,
          error: 'Will already has a signed copy attached',
        },
        400,
      );
    }

    const updatedWill = {
      ...will,
      status: 'finalized',
      updatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      finalizedBy: user.id,
    };

    await kv.set(key, updatedWill);

    log.info('✅ Will finalized:', { willId });

    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('❌ Error finalizing will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.delete('/wills/:willId', async (c) => {
  try {
    log.info('📥 DELETE /estate-planning-fna/wills/:willId');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const key = `will:${clientId}:${type}:${willId}`;
    const existingWill = await kv.get(key);

    if (!existingWill) {
      return c.json(
        {
          success: false,
          error: 'Will not found',
        },
        404,
      );
    }

    // Only draft wills may be deleted — published/finalized wills are retained for compliance
    if (existingWill.status !== 'draft') {
      return c.json(
        {
          success: false,
          error: `Cannot delete a ${existingWill.status} will. Only draft wills can be discarded.`,
        },
        400,
      );
    }

    await kv.del(key);

    log.info('✅ Draft will discarded:', { willId, type });

    return c.json({
      success: true,
    });
  } catch (error: unknown) {
    log.error('❌ Error deleting will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.post('/wills/:willId/attach-signed', async (c) => {
  try {
    log.info('POST /estate-planning-fna/wills/:willId/attach-signed');
    const user = await authenticateUser(c.req.header('Authorization'));
    await ensureLegalDocsBucket();

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    if (will.status === 'draft') {
      return c.json(
        {
          success: false,
          error: 'Cannot attach a signed document to a draft will. Please finalize the will first.',
        },
        400,
      );
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
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

    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `signed-wills/${clientId}/${willId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Allow re-uploading (replacing previous signed copy)
      });

    if (uploadError) {
      log.error('Storage upload failed for signed will document:', uploadError);
      return c.json(
        {
          success: false,
          error: `Failed to upload signed document: ${uploadError.message}`,
        },
        500,
      );
    }

    const timestamp = new Date().toISOString();
    const updatedWill = {
      ...will,
      status: 'signed',
      signedDocumentPath: storagePath,
      signedDocumentFileName: file.name,
      signedDocumentFileSize: file.size,
      signedAt: timestamp,
      signedBy: user?.email || user?.id || 'admin',
      updatedAt: timestamp,
    };

    await kv.set(kvKey, updatedWill);

    log.info('Signed document attached to will:', { willId, storagePath });

    return c.json({
      success: true,
      data: updatedWill,
    });
  } catch (error: unknown) {
    log.error('Error attaching signed document to will:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.get('/wills/:willId/signed-document', async (c) => {
  try {
    log.info('GET /estate-planning-fna/wills/:willId/signed-document');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    if (!will.signedDocumentPath) {
      return c.json({ success: false, error: 'No signed document attached to this will' }, 404);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .createSignedUrl(will.signedDocumentPath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for will document:', error);
      return c.json({ success: false, error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      fileName: will.signedDocumentFileName || 'signed-will.pdf',
    });
  } catch (error: unknown) {
    log.error('Error fetching signed document URL:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

app.delete('/wills/:willId/signed-document', async (c) => {
  try {
    log.info('DELETE /estate-planning-fna/wills/:willId/signed-document');
    await authenticateUser(c.req.header('Authorization'));

    const willId = c.req.param('willId');
    const { clientId, type } = parseWillId(willId);

    const kvKey = `will:${clientId}:${type}:${willId}`;
    const will = await kv.get(kvKey);

    if (!will) {
      return c.json({ success: false, error: 'Will not found' }, 404);
    }

    if (!will.signedDocumentPath) {
      return c.json({ success: false, error: 'No signed document to remove' }, 404);
    }

    const supabase = getSupabase();
    const { error: deleteError } = await supabase.storage
      .from(LEGAL_DOCS_BUCKET)
      .remove([will.signedDocumentPath]);

    if (deleteError) {
      log.warn('Failed to delete signed document from storage (non-critical):', {
        error: String(deleteError),
      });
    }

    const updatedWill = {
      ...will,
      status: 'finalized',
      signedDocumentPath: null,
      signedDocumentFileName: null,
      signedDocumentFileSize: null,
      signedAt: null,
      signedBy: null,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(kvKey, updatedWill);

    log.info('Signed document removed from will:', { willId });

    return c.json({ success: true, data: updatedWill });
  } catch (error: unknown) {
    log.error('Error removing signed document:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

export default app;
