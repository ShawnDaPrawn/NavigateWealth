/**
 * Integration document storage helpers (Phase 5 decomposition).
 * =============================================================
 *
 * Extracted verbatim from integrations.tsx. Supabase Storage bucket
 * provisioning (legal-docs + policy-documents) and the upload/replace
 * helpers for estate documents and policy schedules, plus the
 * POLICY_CATEGORY_LABELS map used to stamp a document's productType.
 *
 * Shared by the portal worker routes (estate-document / policy-document
 * upload) and the staying /policy-documents/* routes, so it lives in a
 * common module both import from (vs a circular import back into
 * integrations.tsx once the portal routes move to their own sub-app).
 * Deps: createClient + kv + logger + getErrMsg + 2 types only.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { KvPolicy, PolicyDocument } from './integrations-types.ts';

const log = createModuleLogger('integrations-document-storage');

const LEGAL_DOCS_BUCKET = 'make-91ed8379-legal-docs';
export const POLICY_DOC_BUCKET = 'make-91ed8379-policy-documents';

// Lazy bucket initialization — called on first document request, not at module load time.
let legalDocBucketInitialized = false;
let policyDocBucketInitialized = false;

async function ensureLegalDocsBucket(): Promise<void> {
  if (legalDocBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === LEGAL_DOCS_BUCKET);

    if (!bucketExists) {
      log.info(`Creating legal document storage bucket: ${LEGAL_DOCS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(LEGAL_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Legal document bucket already exists');
        } else {
          log.error('Error creating legal document bucket:', error);
          return;
        }
      } else {
        log.info('Legal document bucket created successfully');
      }
    } else {
      log.info('Legal document bucket already exists');
    }
    legalDocBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      legalDocBucketInitialized = true;
    } else {
      log.error('Error initializing legal document bucket (non-critical):', { error });
    }
  }
}

export async function ensurePolicyDocBucket(): Promise<void> {
  if (policyDocBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === POLICY_DOC_BUCKET);

    if (!bucketExists) {
      log.info(`Creating policy document storage bucket: ${POLICY_DOC_BUCKET}`);
      const { error } = await supabase.storage.createBucket(POLICY_DOC_BUCKET, {
        public: false,
        fileSizeLimit: 20971520, // 20MB
        allowedMimeTypes: ['application/pdf'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Policy document bucket already exists');
        } else {
          log.error('Error creating policy document bucket:', error);
          return;
        }
      } else {
        log.info('Policy document bucket created successfully');
      }
    } else {
      log.info('Policy document bucket already exists');
    }
    policyDocBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      policyDocBucketInitialized = true;
    } else {
      log.error('Error initializing policy document bucket (non-critical):', { error });
    }
  }
}

export const POLICY_CATEGORY_LABELS: Record<string, string> = {
  risk_planning: 'Risk Planning',
  medical_aid: 'Medical Aid',
  retirement_planning: 'Retirement Planning',
  retirement_pre: 'Pre-Retirement',
  retirement_post: 'Post-Retirement (Living Annuity)',
  retirement_post_fixed: 'Post-Retirement (Fixed Annuity)',
  investments: 'Investments',
  investments_voluntary: 'Voluntary Investments',
  investments_guaranteed: 'Guaranteed Investments',
  employee_benefits: 'Employee Benefits',
  employee_benefits_risk: 'Employee Benefits (Risk)',
  employee_benefits_retirement: 'Employee Benefits (Retirement)',
  tax_planning: 'Tax Planning',
  estate_planning: 'Estate Planning',
};

/**
 * A short-lived download link for a stored policy document.
 *
 * Returns null when Storage refuses (a key that no longer exists, a bucket
 * hiccup) so the caller can answer 404/500 with its own wording rather than
 * surfacing the Storage error text.
 */
export async function createPolicyDocumentSignedUrl(
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase.storage
    .from(POLICY_DOC_BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);
  if (error || !data?.signedUrl) {
    log.error('Failed to create signed URL for policy document:', error);
    return null;
  }
  return data.signedUrl;
}

function safeStorageFileName(fileName: string, fallback = 'policy_schedule.pdf'): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export async function uploadEstateDocumentForClient(params: {
  clientId: string;
  file: File;
  documentType:
    | 'last_will_scanned'
    | 'living_will_scanned'
    | 'trust_deed'
    | 'power_of_attorney'
    | 'codicil'
    | 'letter_of_executorship'
    | 'other';
  uploadedBy: string;
  fileName?: string;
  title?: string;
  notes?: string;
  signingDate?: string;
}) {
  await ensureLegalDocsBucket();

  const { clientId, file, documentType, uploadedBy } = params;
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (file.type && !allowedTypes.has(file.type)) {
    throw new Error('Only PDF, JPEG, and PNG files are accepted');
  }
  if (file.size > 52428800) {
    throw new Error('File exceeds maximum size of 50MB');
  }

  const fileExtension = (params.fileName || file.name || 'document.pdf').split('.').pop() || 'pdf';
  const docId = `edoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `estate-docs/${clientId}/${docId}.${fileExtension}`;
  const fileBuffer = await file.arrayBuffer();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: uploadError } = await supabase.storage
    .from(LEGAL_DOCS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const timestamp = new Date().toISOString();
  const document = {
    id: docId,
    clientId,
    title:
      String(params.title || params.fileName || file.name || 'Estate document')
        .trim()
        .slice(0, 200) || 'Estate document',
    documentType,
    notes: String(params.notes || '').slice(0, 1000),
    signingDate:
      typeof params.signingDate === 'string' && params.signingDate.trim()
        ? params.signingDate.trim().slice(0, 40)
        : null,
    fileName: params.fileName || file.name,
    fileSize: file.size,
    filePath: storagePath,
    mimeType: file.type || 'application/pdf',
    uploadedBy,
    uploadedAt: timestamp,
    updatedAt: timestamp,
  };

  await kv.set(`estate_doc:${clientId}:${docId}`, document);
  return document;
}

export async function replacePolicyDocumentForPolicy(params: {
  clientId: string;
  policyId: string;
  file: File;
  documentType: PolicyDocument['documentType'];
  uploadedBy: string;
  stableStorageKey?: boolean;
  fileName?: string;
}): Promise<PolicyDocument> {
  await ensurePolicyDocBucket();

  const { clientId, policyId, file, documentType, uploadedBy } = params;
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted');
  }
  if (file.size > 20971520) {
    throw new Error('File exceeds maximum size of 20MB');
  }

  const fileBuffer = await file.arrayBuffer();
  const signature = new TextDecoder().decode(fileBuffer.slice(0, 5));
  if (!signature.startsWith('%PDF-')) {
    throw new Error('Downloaded file is not a valid PDF');
  }

  const policiesKey = `policies:client:${clientId}`;
  const policiesBefore = await readClientPolicies(policiesKey);
  const policyBefore = policiesBefore.find((p: KvPolicy) => p.id === policyId);

  if (!policyBefore) {
    throw new Error('Policy not found');
  }

  const previousStorageKey = policyBefore.document?.storageKey;
  const fileName = params.fileName || file.name || 'policy_schedule.pdf';
  const storageFileName = params.stableStorageKey
    ? `${documentType}.pdf`
    : `${Date.now()}_${safeStorageFileName(fileName)}`;
  const storageKey = `${clientId}/${policyId}/${storageFileName}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: uploadError } = await supabase.storage
    .from(POLICY_DOC_BUCKET)
    .upload(storageKey, fileBuffer, {
      contentType: 'application/pdf',
      upsert: params.stableStorageKey === true || previousStorageKey === storageKey,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  if (previousStorageKey && previousStorageKey !== storageKey) {
    const { error: deleteError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .remove([previousStorageKey]);

    if (deleteError) {
      await supabase.storage
        .from(POLICY_DOC_BUCKET)
        .remove([storageKey])
        .catch(() => undefined);
      throw new Error(
        `New PDF uploaded but previous policy document could not be deleted: ${deleteError.message}`,
      );
    }
  }

  // The PDF upload is the slow part. The list read above is only there to
  // refuse a missing policy before that, and to know which object to replace.
  // Writing that list back would erase a policy update — or a removed policy —
  // that landed while the bytes were in flight. The update bot does exactly
  // that: it writes `policies:client:{clientId}` and hands over the PDF
  // together. Attach the document to the list as it stands now.
  try {
    return await attachDocumentToCurrentPolicies({
      policiesKey,
      policyId,
      storageKey,
      fileName,
      fileSize: file.size,
      documentType,
      uploadedBy,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Policy not found') {
      await supabase.storage
        .from(POLICY_DOC_BUCKET)
        .remove([storageKey])
        .catch(() => undefined);
    }
    throw error;
  }
}

/**
 * How many times to re-read and patch after a write we cannot see again.
 * Each pass reads the current list, so a write that landed after the previous
 * pass is kept. The window that remains is one read plus one write.
 */
const DOCUMENT_ATTACH_ATTEMPTS = 3;

/** The client's policy list, or an empty list when the row is missing or not a list. */
async function readClientPolicies(policiesKey: string): Promise<KvPolicy[]> {
  const policies = ((await kv.get(policiesKey)) || []) as KvPolicy[];
  return Array.isArray(policies) ? policies : [];
}

/**
 * Set `document` on `policyId` inside the client's current policy list.
 *
 * Throws `Policy not found` when that policy is no longer in the list, and
 * never writes a list it did not just read.
 */
async function attachDocumentToCurrentPolicies(params: {
  policiesKey: string;
  policyId: string;
  storageKey: string;
  fileName: string;
  fileSize: number;
  documentType: PolicyDocument['documentType'];
  uploadedBy: string;
}): Promise<PolicyDocument> {
  for (let attempt = 0; attempt < DOCUMENT_ATTACH_ATTEMPTS; attempt++) {
    const policies = await readClientPolicies(params.policiesKey);
    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === params.policyId);
    if (policyIndex === -1) throw new Error('Policy not found');

    const policy = policies[policyIndex];
    const updatedAt = new Date().toISOString();
    const docMeta: PolicyDocument = {
      storageKey: params.storageKey,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: 'application/pdf',
      provider: policy.providerName || '',
      productType: POLICY_CATEGORY_LABELS[policy.categoryId] || policy.categoryId,
      documentType: params.documentType,
      uploadDate: new Date().toISOString(),
      uploadedBy: params.uploadedBy,
    };
    const next = policies.slice();
    next[policyIndex] = { ...policy, document: docMeta, updatedAt };
    await kv.set(params.policiesKey, next);

    const saved = (await readClientPolicies(params.policiesKey)).find(
      (p: KvPolicy) => p.id === params.policyId,
    );
    // Our write is the one stored when this policy still carries the timestamp
    // we just set. Anything newer is read again on the next pass and patched.
    if (saved?.document?.storageKey === docMeta.storageKey && saved.updatedAt === updatedAt) {
      return docMeta;
    }
  }
  throw new Error('Policy changed while its document was being saved');
}
