/**
 * E-Signature Storage Service
 * Handles Supabase Storage operations for documents, signatures, and certificates
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createModuleLogger } from "./stderr-logger.ts";

// Initialize Supabase client lazily
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const log = createModuleLogger('esign-storage');

// Storage bucket names
const BUCKETS = {
  DOCUMENTS: 'make-91ed8379-esign-documents',
  SIGNATURES: 'make-91ed8379-esign-signatures',
  CERTIFICATES: 'make-91ed8379-esign-certificates',
  // P3.5 — Signer-uploaded attachments. Private bucket, stricter MIME
  // allow-list than DOCUMENTS so signers can't upload arbitrary executables.
  ATTACHMENTS: 'make-91ed8379-esign-attachments',
} as const;

/**
 * Initialize storage buckets if they don't exist
 */
export async function initializeStorageBuckets(): Promise<void> {
  log.info('Initializing E-Sign storage buckets...');
  const supabase = getSupabase();

  const bucketConfigs = [
    { 
      name: BUCKETS.DOCUMENTS, 
      public: false, 
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ] 
    },
    { name: BUCKETS.SIGNATURES, public: false, allowedMimeTypes: ['image/png', 'image/jpeg'] },
    { name: BUCKETS.CERTIFICATES, public: false, allowedMimeTypes: ['application/pdf'] },
    {
      name: BUCKETS.ATTACHMENTS,
      public: false,
      allowedMimeTypes: [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/heic',
        'image/heif',
        'image/webp',
      ],
    },
  ];

  for (const config of bucketConfigs) {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        log.warn(`Failed to list buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(bucket => bucket.name === config.name);

      if (!bucketExists) {
        // Create bucket
        const { error } = await supabase.storage.createBucket(config.name, {
          public: config.public,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB
          allowedMimeTypes: config.allowedMimeTypes,
        });

        if (error) {
          // Ignore "already exists" error
          if (error.message.includes('already exists') || error.message.includes('The resource already exists')) {
            log.info(`Bucket already exists (caught creation error): ${config.name}`);
          } else {
            log.error(`Failed to create bucket ${config.name}:`, error);
          }
        } else {
          log.success(`Created bucket: ${config.name}`);
        }
      } else {
        log.info(`Bucket already exists: ${config.name}`);
      }
    } catch (error) {
      log.error(`Error initializing bucket ${config.name}:`, error);
    }
  }
}

/**
 * Upload a document to storage
 */
export async function uploadDocument(
  firmId: string,
  documentId: string,
  fileBuffer: Uint8Array,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<{ path: string; error: string | null }> {
  try {
    const supabase = getSupabase();
    const extension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const path = `${firmId}/${documentId}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKETS.DOCUMENTS)
      .upload(path, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      log.error('Document upload error:', error);
      return { path: '', error: error.message };
    }

    log.success(`Uploaded document: ${path}`);
    return { path, error: null };
  } catch (error) {
    log.error('Document upload exception:', error);
    return { path: '', error: String(error) };
  }
}

/**
 * Upload a signature image to storage
 */
export async function uploadSignature(
  envelopeId: string,
  signerId: string,
  imageBuffer: Uint8Array
): Promise<{ path: string; error: string | null }> {
  try {
    const supabase = getSupabase();
    const path = `${envelopeId}/${signerId}_signature.png`;

    const { error } = await supabase.storage
      .from(BUCKETS.SIGNATURES)
      .upload(path, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      log.error('Signature upload error:', error);
      return { path: '', error: error.message };
    }

    log.success(`Uploaded signature: ${path}`);
    return { path, error: null };
  } catch (error) {
    log.error('Signature upload exception:', error);
    return { path: '', error: String(error) };
  }
}

/**
 * Upload a completion certificate to storage
 */
export async function uploadCertificate(
  envelopeId: string,
  pdfBuffer: Uint8Array
): Promise<{ path: string; error: string | null }> {
  try {
    const supabase = getSupabase();
    const path = `${envelopeId}/certificate.pdf`;

    const { error } = await supabase.storage
      .from(BUCKETS.CERTIFICATES)
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      log.error('Certificate upload error:', error);
      return { path: '', error: error.message };
    }

    log.success(`Uploaded certificate: ${path}`);
    return { path, error: null };
  } catch (error) {
    log.error('Certificate upload exception:', error);
    return { path: '', error: String(error) };
  }
}

/**
 * Upload a signed document (final artifact) to storage
 */
export async function uploadSignedDocument(
  envelopeId: string,
  pdfBuffer: Uint8Array
): Promise<{ path: string; error: string | null }> {
  try {
    const supabase = getSupabase();
    const path = `${envelopeId}/signed_document.pdf`;

    const { error } = await supabase.storage
      .from(BUCKETS.DOCUMENTS) // Storing in documents bucket, but maybe could be separate. 
                               // Using BUCKETS.DOCUMENTS but path is different "completed/..."
                               // Wait, storage logic below uses BUCKETS.DOCUMENTS. 
                               // Let's stick to the convention in esign-keys which suggested `completed/${id}/...`
                               // But the buckets definition only has DOCUMENTS, SIGNATURES, CERTIFICATES.
                               // I'll put it in DOCUMENTS bucket for now.
      .upload(`completed/${path}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      log.error('Signed document upload error:', error);
      return { path: '', error: error.message };
    }

    const fullPath = `completed/${path}`;
    log.success(`Uploaded signed document: ${fullPath}`);
    return { path: fullPath, error: null };
  } catch (error) {
    log.error('Signed document upload exception:', error);
    return { path: '', error: String(error) };
  }
}

/**
 * Download a document from storage as buffer
 */
export async function downloadDocument(path: string): Promise<Uint8Array | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKETS.DOCUMENTS)
      .download(path);

    if (error || !data) {
      log.error('Document download error:', error);
      return null;
    }

    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    log.error('Document download exception:', error);
    return null;
  }
}

/**
 * Get a presigned URL for a document (valid for 1 hour)
 */
export async function getDocumentUrl(path: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKETS.DOCUMENTS)
      .createSignedUrl(path, 3600); // 1 hour

    if (error || !data) {
      log.error('Failed to create signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    log.error('Get document URL exception:', error);
    return null;
  }
}

/**
 * Get a presigned URL for a signature image
 */
export async function getSignatureUrl(path: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKETS.SIGNATURES)
      .createSignedUrl(path, 3600); // 1 hour

    if (error || !data) {
      log.error('Failed to create signed URL for signature:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    log.error('Get signature URL exception:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Attachment storage helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Hard cap so a signer can't ddos us with a 1GB upload. */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Closed list of MIME types we accept for attachments. */
export const ATTACHMENT_ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
  'image/webp',
]);

export async function uploadAttachment(
  envelopeId: string,
  attachmentId: string,
  fileName: string,
  fileBuffer: Uint8Array,
  mimeType: string,
): Promise<{ path: string; error: string | null }> {
  try {
    // Defence-in-depth — the bucket allow-list also blocks these, but
    // failing fast here gives a nicer error message.
    if (!ATTACHMENT_ALLOWED_MIME.has(mimeType)) {
      return { path: '', error: `Unsupported attachment type: ${mimeType}` };
    }
    if (fileBuffer.length > ATTACHMENT_MAX_BYTES) {
      return { path: '', error: `Attachment exceeds ${Math.floor(ATTACHMENT_MAX_BYTES / 1024 / 1024)}MB limit` };
    }
    const supabase = getSupabase();
    // Sanitise filename so we never write `..` / slashes into the storage path.
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${envelopeId}/${attachmentId}-${safeName}`;
    const { error } = await supabase.storage
      .from(BUCKETS.ATTACHMENTS)
      .upload(path, fileBuffer, { contentType: mimeType, upsert: false });
    if (error) {
      log.error('Attachment upload error:', error);
      return { path: '', error: error.message };
    }
    log.success(`Uploaded attachment: ${path}`);
    return { path, error: null };
  } catch (err) {
    log.error('Attachment upload exception:', err);
    return { path: '', error: String(err) };
  }
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKETS.ATTACHMENTS)
      .createSignedUrl(path, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch (err) {
    log.error('Get attachment URL exception:', err);
    return null;
  }
}

/**
 * Get a presigned URL for a completion certificate
 */
export async function getCertificateUrl(path: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKETS.CERTIFICATES)
      .createSignedUrl(path, 3600); // 1 hour

    if (error || !data) {
      log.error('Failed to create signed URL for certificate:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    log.error('Get certificate URL exception:', error);
    return null;
  }
}

/**
 * P6.7 — raw download helpers for certificate + attachment buckets so
 * the evidence-pack exporter can bundle everything into a single ZIP
 * without round-tripping through signed URLs.
 */
export async function downloadCertificate(path: string): Promise<Uint8Array | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKETS.CERTIFICATES).download(path);
    if (error || !data) {
      log.error('Certificate download error:', error);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (err) {
    log.error('Certificate download exception:', err);
    return null;
  }
}

export async function downloadAttachment(path: string): Promise<Uint8Array | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKETS.ATTACHMENTS).download(path);
    if (error || !data) {
      log.error('Attachment download error:', error);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (err) {
    log.error('Attachment download exception:', err);
    return null;
  }
}

/**
 * Delete a document from storage
 */
export async function deleteDocument(path: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(BUCKETS.DOCUMENTS)
      .remove([path]);

    if (error) {
      log.error('Document deletion error:', error);
      return false;
    }

    log.success(`Deleted document: ${path}`);
    return true;
  } catch (error) {
    log.error('Document deletion exception:', error);
    return false;
  }
}

/**
 * Calculate SHA-256 hash of a file buffer
 */
export async function calculateHash(buffer: Uint8Array): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    log.error('Hash calculation error:', error);
    throw new Error('Failed to calculate file hash');
  }
}

/**
 * Extract page count from PDF buffer (basic implementation)
 */
export function extractPageCount(buffer: Uint8Array): number {
  try {
    // Convert buffer to string to search for /Type /Page occurrences
    const text = new TextDecoder('latin1').decode(buffer);
    
    // Count /Type /Page or /Type/Page patterns
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    
    if (!pageMatches) {
      log.warn('Could not determine page count, defaulting to 1');
      return 1;
    }
    
    return pageMatches.length;
  } catch (error) {
    log.error('Page count extraction error:', error);
    return 1; // Default to 1 page on error
  }
}

/**
 * Validate Document (PDF, DOC, DOCX)
 */
export function validateDocument(buffer: Uint8Array, fileName: string): { valid: boolean; error?: string } {
  try {
    // Check minimum size (at least 1KB)
    if (buffer.length < 1024) {
      return { valid: false, error: 'Invalid file: File too small' };
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // PDF Validation
    if (ext === 'pdf') {
      const header = new TextDecoder('latin1').decode(buffer.slice(0, 5));
      if (!header.startsWith('%PDF-')) {
        return { valid: false, error: 'Invalid PDF file: Missing PDF header' };
      }
    }
    
    // Word Validation (Basic check)
    // We trust the extension and size for now as deeper validation is complex without libraries
    if (['doc', 'docx'].includes(ext || '')) {
       return { valid: true };
    }
    
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
        return { valid: false, error: 'Unsupported file type. Only PDF and Word documents are allowed.' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid file: Unable to validate' };
  }
}