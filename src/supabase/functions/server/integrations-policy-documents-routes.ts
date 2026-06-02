/**
 * Policy-document routes (Phase 5 Slice E decomposition).
 * =========================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST   /policy-documents/upload    — upload or replace a policy document
 *   GET    /policy-documents/download  — return a signed download URL
 *   DELETE /policy-documents           — remove a document from storage + policy record
 *
 * @module server/integrations-policy-documents-routes
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAuth } from './auth-mw.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  PolicyDocumentMetadataSchema,
  DeletePolicyDocumentSchema,
} from './integrations-validation.ts';
import type { KvPolicy } from './integrations-types.ts';
import {
  POLICY_DOC_BUCKET,
  ensurePolicyDocBucket,
  replacePolicyDocumentForPolicy,
} from './integrations-document-storage.ts';

const app = new Hono();
const log = createModuleLogger('integrations-policy-documents');

/**
 * POST /policy-documents/upload
 * Upload (or replace) a policy document for a specific policy line item.
 * Accepts multipart/form-data with fields: file, policyId, clientId, documentType, uploadedBy.
 */
app.post('/policy-documents/upload', requireAuth, async (c) => {
  try {
    await ensurePolicyDocBucket();

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Failed to parse policy document upload form data:', parseErr);
      return c.json(
        {
          error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
        },
        400,
      );
    }

    const file = formData['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate metadata
    const metadata = PolicyDocumentMetadataSchema.safeParse({
      policyId: formData['policyId'],
      clientId: formData['clientId'],
      documentType: formData['documentType'] || 'policy_schedule',
      uploadedBy: formData['uploadedBy'],
    });

    if (!metadata.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(metadata.error) }, 400);
    }

    const { policyId, clientId, documentType, uploadedBy } = metadata.data;

    const docMeta = await replacePolicyDocumentForPolicy({
      clientId,
      policyId,
      file,
      documentType,
      uploadedBy,
      fileName: file.name,
    });

    log.info('Policy document uploaded successfully', { policyId, storageKey: docMeta.storageKey });

    return c.json({ success: true, document: docMeta });
  } catch (e) {
    log.error('Error uploading policy document:', e);
    return c.json({ error: `Failed to upload policy document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-documents/download
 * Returns a signed URL for downloading a policy document.
 * Query params: policyId, clientId
 */
app.get('/policy-documents/download', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .createSignedUrl(policy.document.storageKey, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for policy document:', error);
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      document: policy.document,
    });
  } catch (e) {
    log.error('Error generating policy document download URL:', e);
    return c.json({ error: `Failed to get document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * DELETE /policy-documents
 * Remove a policy document from storage and clear metadata from the policy record.
 * Body: { policyId, clientId }
 */
app.delete('/policy-documents', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = DeletePolicyDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const { policyId, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    // Delete from storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: deleteError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .remove([policy.document.storageKey]);

    if (deleteError) {
      log.error('Failed to delete policy document from storage:', deleteError);
      // Continue anyway — clear metadata even if storage delete fails
    }

    // Clear document metadata from the policy
    const { document: _removed, ...policyWithoutDoc } = policy;
    (policies as KvPolicy[])[policyIndex] = {
      ...policyWithoutDoc,
      updatedAt: new Date().toISOString(),
    } as KvPolicy;

    await kv.set(policiesKey, policies);

    log.info('Policy document removed', { policyId, clientId });

    return c.json({ success: true });
  } catch (e) {
    log.error('Error removing policy document:', e);
    return c.json({ error: `Failed to remove document: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
