/**
 * E-Signature API Routes (KV Store Version)
 * RESTful API endpoints for e-signature functionality
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import type { EsignField } from './esign-types.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { 
  createEnvelope,
  createDocument,
  getEnvelopeDetails,
  getClientEnvelopes,
  getAllEnvelopes,
  updateEnvelopeStatus,
  updateSignerStatus,
  getEnvelopeSigners,
  updateFieldValue,
  logAuditEvent,
  getAuditTrail,
  getSignerByToken,
  checkEnvelopeCompletion,
  addSignersToEnvelope,
  addFieldsToEnvelope,
  clearAllEsignData,
} from './esign-services.ts';
import {
  initializeStorageBuckets,
  uploadDocument,
  downloadDocument,
  getDocumentUrl,
  getCertificateUrl,
  validateDocument,
  calculateHash,
  extractPageCount,
} from './esign-storage.ts';
import { PDFService } from './esign-pdf.service.ts';
import {
  generateOTP,
  verifyOTP,
  markOTPVerified,
  clearOTP,
  isOTPRequired,
  generateAndStoreOTP,
  verifyAccessCode,
} from './esign-otp.ts';
import { generateCompletionCertificate } from "./esign-certificates.ts";
import {
  createSigningInviteEmail,
  createOTPEmail,
} from './esign-email-templates.ts';
import { getCertificate } from './esign-certificates.ts';
import { completeEnvelope } from './esign-workflow.ts';
import {
  getReminderConfig,
  setReminderConfig,
} from './esign-automation.ts';
import { runExpirySweep } from './esign-expiry-service.ts';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createTemplateFromEnvelope,
  incrementUsageCount,
} from './esign-template-service.ts';
import { 
  checkRateLimit, 
  clearRateLimit,
  RATE_LIMITS 
} from './rateLimiter.ts';
import { 
  sendEmail,
  sendSigningInvitation,
  sendSigningReminder,
  sendRecallNotification,
  sendCompletionNotification,
} from './email-service.ts';
import {
  EnvelopeContextSchema,
  DraftSignersSchema,
  UpdateFieldsSchema,
  UpdateFieldValueSchema,
  SignEnvelopeSchema,
  RejectEnvelopeSchema,
  SignerValidateSchema,
  OtpVerifySchema,
} from './esign-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { startExpirySweepScheduler } from './esign-scheduler.ts';
import { AdminAuditService } from './admin-audit-service.ts';

// Initialize Hono router
const esignRoutes = new Hono();
const log = createModuleLogger('esign-routes');

// Lazy Supabase client for admin operations (e.g. getUserById)
// Must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Root handlers
esignRoutes.get('/', (c) => c.json({ service: 'esign', status: 'active' }));
esignRoutes.get('', (c) => c.json({ service: 'esign', status: 'active' }));

// Start the background expiry sweep scheduler on first module load.
// Safe to call multiple times — internally deduped.
startExpirySweepScheduler();

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract client IP and User Agent from request
 */
/** Shared callback types for e-sign route operations */
interface SignerRecord { id: string; name: string; email: string; phone?: string; role?: string; order?: number; status?: string; access_token?: string; requiresOtp?: boolean; accessCode?: string; clientId?: string; [key: string]: unknown }
interface FieldRecord { id?: string; type?: string; signerId?: string; signerIndex?: number; signer_id?: string; [key: string]: unknown }

function getRequestMetadata(c: { req: { header: (name: string) => string | undefined } }) {
  return {
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown',
  };
}

// Storage bucket initialization is deferred to first upload request
// to avoid top-level async side effects that can cause deployment errors (544).
let storageBucketsInitialized = false;
async function ensureStorageBuckets(): Promise<void> {
  if (storageBucketsInitialized) return;
  try {
    await initializeStorageBuckets();
    storageBucketsInitialized = true;
  } catch (error) {
    log.error('Failed to initialize E-Sign storage buckets:', error);
  }
}

// ==================== API ROUTES ====================

/**
 * GET /health
 * Health check endpoint
 */
esignRoutes.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'esign',
    timestamp: new Date().toISOString() 
  });
});

// ==================== MAINTENANCE ROUTES (§14.2 — before parameterised routes) ====================

/**
 * POST /maintenance/expiry-sweep
 * Run envelope expiry sweep (admin only, dry-run-first pattern §14.1)
 */
esignRoutes.post('/maintenance/expiry-sweep', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const { dryRun = true } = await c.req.json().catch(() => ({ dryRun: true }));

    log.info(`Expiry sweep requested by ${ctx.user.id} (dryRun=${dryRun})`);
    const result = await runExpirySweep(dryRun);

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: dryRun ? 'expiry_sweep_preview' : 'expiry_sweep_applied',
      metadata: {
        scannedCount: result.scannedCount,
        expiredCount: result.expiredCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
        durationMs: result.durationMs,
      },
    });

    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('Expiry sweep error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Expiry sweep failed' }, status);
  }
});

/**
 * POST /cron/expiry-sweep
 * Scheduled CRON endpoint — runs the expiry sweep in live mode.
 * Authenticated via the SUPABASE_SERVICE_ROLE_KEY (passed as Bearer token
 * by the Supabase scheduled function or external CRON scheduler).
 *
 * Usage with Supabase Edge Function scheduling or external CRON:
 *   curl -X POST \
 *     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
 *     https://<project>.supabase.co/functions/v1/make-server-91ed8379/esign/cron/expiry-sweep
 *
 * Runs live (dryRun=false) and logs audit events as actorType='system'.
 */
esignRoutes.post('/cron/expiry-sweep', async (c) => {
  try {
    // Authenticate via service role key (no user session — system actor)
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!token || token !== serviceRoleKey) {
      return c.json({ error: 'Unauthorized — CRON endpoint requires service role key' }, 401);
    }

    log.info('CRON expiry sweep triggered');
    const result = await runExpirySweep(false); // Always live for scheduled runs

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'system',
      action: 'expiry_sweep_cron',
      metadata: {
        scannedCount: result.scannedCount,
        expiredCount: result.expiredCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
        durationMs: result.durationMs,
      },
    });

    log.info(`CRON expiry sweep complete: expired=${result.expiredCount}, errors=${result.errors.length}`);
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('CRON expiry sweep error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'CRON expiry sweep failed' }, 500);
  }
});

/**
 * POST /maintenance/bulk-remind
 * Send reminders to pending signers across multiple envelopes (admin only)
 */
esignRoutes.post('/maintenance/bulk-remind', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const { envelopeIds, dryRun = true } = await c.req.json();

    if (!Array.isArray(envelopeIds) || envelopeIds.length === 0) {
      return c.json({ error: 'envelopeIds array is required' }, 400);
    }

    log.info(`Bulk remind requested for ${envelopeIds.length} envelopes (dryRun=${dryRun})`);

    const results: Array<{
      envelopeId: string;
      title: string;
      pendingSigners: Array<{ name: string; email: string }>;
      remindersSent: number;
      error?: string;
    }> = [];

    for (const envelopeId of envelopeIds) {
      try {
        const envelope = await getEnvelopeDetails(envelopeId);
        if (!envelope) {
          results.push({ envelopeId, title: 'Unknown', pendingSigners: [], remindersSent: 0, error: 'Envelope not found' });
          continue;
        }
        if (!['sent', 'viewed', 'partially_signed'].includes(envelope.status)) {
          results.push({ envelopeId, title: envelope.title, pendingSigners: [], remindersSent: 0, error: `Status '${envelope.status}' is not remindable` });
          continue;
        }

        const signers = await getEnvelopeSigners(envelopeId);
        const pendingSigners = signers.filter((s: { status: string }) =>
          ['pending', 'sent', 'viewed', 'otp_verified'].includes(s.status)
        );

        if (pendingSigners.length === 0) {
          results.push({ envelopeId, title: envelope.title, pendingSigners: [], remindersSent: 0, error: 'No pending signers' });
          continue;
        }

        const pending = pendingSigners.map((s: { name: string; email: string }) => ({ name: s.name, email: s.email }));

        if (!dryRun) {
          for (const signer of pendingSigners) {
            try {
              await sendSigningReminder({
                signerEmail: signer.email,
                signerName: signer.name,
                envelopeTitle: envelope.title,
                signingUrl: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}/sign?token=${signer.access_token}`,
              });
            } catch (err) {
              log.error(`Failed to send reminder to ${signer.email}:`, err);
            }
          }
        }

        results.push({ envelopeId, title: envelope.title, pendingSigners: pending, remindersSent: dryRun ? 0 : pendingSigners.length });
      } catch (err) {
        results.push({ envelopeId, title: 'Unknown', pendingSigners: [], remindersSent: 0, error: getErrMsg(err) });
      }
    }

    // Admin audit trail for live runs (non-blocking — §12.2)
    if (!dryRun) {
      const totalSent = results.reduce((sum, r) => sum + r.remindersSent, 0);
      AdminAuditService.record({
        actorId: ctx.user.id,
        actorRole: 'admin',
        category: 'bulk_operation',
        action: 'esign_bulk_remind',
        summary: `Bulk remind: ${totalSent} reminders sent across ${envelopeIds.length} envelopes`,
        severity: 'info',
        entityType: 'envelope',
        metadata: { envelopeCount: envelopeIds.length, totalRemindersSent: totalSent },
      }).catch(() => {});
    }

    return c.json({
      success: true,
      dryRun,
      envelopeCount: envelopeIds.length,
      totalPendingSigners: results.reduce((sum, r) => sum + r.pendingSigners.length, 0),
      totalRemindersSent: results.reduce((sum, r) => sum + r.remindersSent, 0),
      results,
    });
  } catch (error: unknown) {
    log.error('Bulk remind error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Bulk remind failed' }, status);
  }
});

/**
 * POST /maintenance/bulk-void
 * Void multiple envelopes at once (admin only, dry-run-first pattern)
 */
esignRoutes.post('/maintenance/bulk-void', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const { envelopeIds, reason = 'Bulk void by admin', dryRun = true } = await c.req.json();

    if (!Array.isArray(envelopeIds) || envelopeIds.length === 0) {
      return c.json({ error: 'envelopeIds array is required' }, 400);
    }

    log.info(`Bulk void requested for ${envelopeIds.length} envelopes (dryRun=${dryRun})`);

    const voidableStatuses = ['sent', 'viewed', 'partially_signed'];
    const results: Array<{
      envelopeId: string;
      title: string;
      previousStatus: string;
      voided: boolean;
      error?: string;
    }> = [];

    for (const envelopeId of envelopeIds) {
      try {
        const envelope = await getEnvelopeDetails(envelopeId);
        if (!envelope) {
          results.push({ envelopeId, title: 'Unknown', previousStatus: '', voided: false, error: 'Envelope not found' });
          continue;
        }
        if (!voidableStatuses.includes(envelope.status)) {
          results.push({ envelopeId, title: envelope.title, previousStatus: envelope.status, voided: false, error: `Status '${envelope.status}' cannot be voided` });
          continue;
        }

        if (!dryRun) {
          await updateEnvelopeStatus(envelopeId, 'voided', { voided_at: new Date().toISOString(), void_reason: reason });
          await logAuditEvent({
            envelopeId,
            actorType: 'sender_user',
            actorId: ctx.user.id,
            action: 'envelope_voided_bulk',
            metadata: { reason, previousStatus: envelope.status },
          });
        }

        results.push({ envelopeId, title: envelope.title, previousStatus: envelope.status, voided: !dryRun });
      } catch (err) {
        results.push({ envelopeId, title: 'Unknown', previousStatus: '', voided: false, error: getErrMsg(err) });
      }
    }

    // Admin audit trail for live runs (non-blocking — §12.2)
    if (!dryRun) {
      AdminAuditService.record({
        actorId: ctx.user.id,
        actorRole: 'admin',
        category: 'bulk_operation',
        action: 'esign_bulk_void',
        summary: `Bulk void: ${results.filter(r => r.voided).length} of ${envelopeIds.length} envelopes voided`,
        severity: 'critical',
        entityType: 'envelope',
        metadata: { reason, envelopeCount: envelopeIds.length, voidedCount: results.filter(r => r.voided).length },
      }).catch(() => {});
    }

    return c.json({
      success: true,
      dryRun,
      envelopeCount: envelopeIds.length,
      voidedCount: dryRun ? results.filter(r => !r.error).length : results.filter(r => r.voided).length,
      results,
    });
  } catch (error: unknown) {
    log.error('Bulk void error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Bulk void failed' }, status);
  }
});

/**
 * POST /verify-hash
 * Public endpoint — verify a document hash against stored envelope data
 */
esignRoutes.post('/verify-hash', async (c) => {
  try {
    const { hash } = await c.req.json();
    if (!hash || typeof hash !== 'string') {
      return c.json({ error: 'hash is required' }, 400);
    }

    // Search all envelopes for a matching document hash.
    // We check two possible locations:
    //   1. envelope.signed_document_hash — the sealed final PDF hash (most common for verification)
    //   2. document.hash — the original uploaded PDF hash
    const allValues = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
    const envelopes = allValues.filter((item: Record<string, unknown>) =>
      item && typeof item === 'object' && !Array.isArray(item) && item.id && item.status
    );

    let matchedEnvelope: Record<string, unknown> | null = null;
    let matchType: 'original' | 'signed' | null = null;

    // Pass 1: Check sealed document hash on envelope record (fast — no extra KV read)
    for (const env of envelopes) {
      if (env.signed_document_hash === hash) {
        matchedEnvelope = env;
        matchType = 'signed';
        break;
      }
    }

    // Pass 2: Check original document hash (requires reading document record)
    if (!matchedEnvelope) {
      for (const env of envelopes) {
        if (env.document_id) {
          const doc = await kv.get(EsignKeys.PREFIX_DOCUMENT + env.document_id);
          if (doc?.hash === hash) {
            matchedEnvelope = env;
            matchType = 'original';
            break;
          }
        }
      }
    }

    if (!matchedEnvelope) {
      return c.json({
        verified: false,
        message: 'No matching document found. The file may have been modified after signing, or it was not signed through this platform.',
      });
    }

    // Fetch signers
    const rawSIds = await kv.get(EsignKeys.envelopeSigners(matchedEnvelope.id as string));
    const signerIds = Array.isArray(rawSIds) ? rawSIds : [];
    const signers = await Promise.all(signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id)));
    const validSigners = signers.filter(Boolean);

    return c.json({
      verified: true,
      matchType,
      envelope: {
        id: matchedEnvelope.id,
        title: matchedEnvelope.title,
        status: matchedEnvelope.status,
        completedAt: matchedEnvelope.completed_at || null,
        createdAt: matchedEnvelope.created_at,
      },
      signers: validSigners.map((s: Record<string, unknown>) => ({
        name: s.name,
        role: s.role,
        status: s.status,
        signedAt: s.signed_at || null,
      })),
      message: matchedEnvelope.status === 'completed'
        ? matchType === 'signed'
          ? 'Document verified. This is an authentic signed and sealed document from Navigate Wealth.'
          : 'Document verified. This matches the original uploaded document. The signed copy may have additional content (signatures, certificate).'
        : `Document found but envelope status is "${matchedEnvelope.status}". Signing may not be complete.`,
    });
  } catch (error: unknown) {
    log.error('Verify hash error:', error);
    return c.json({ error: 'Verification failed. Please try again.' }, 500);
  }
});

// ==================== ENVELOPE ROUTES ====================

/**
 * GET /envelopes
 * Get all envelopes (admin only)
 */
esignRoutes.get('/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    
    // Get query params
    const status = c.req.query('status');
    
    const envelopes = await getAllEnvelopes(status);
    
    return c.json({ envelopes });
  } catch (error: unknown) {
    log.error('❌ Get all envelopes error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch envelopes' }, status);
  }
});

/**
 * DELETE /envelopes
 * Clear all envelopes and related data (Admin only)
 */
esignRoutes.delete('/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    
    // Safety check - require a confirmation query param
    const confirm = c.req.query('confirm');
    if (confirm !== 'true') {
      return c.json({ error: 'Confirmation required. set confirm=true' }, 400);
    }

    await clearAllEsignData();
    
    // Log audit event for the wipe
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: user.id,
      action: 'system_reset',
      ip,
      userAgent,
      email: user.email,
      metadata: { note: 'Full system wipe initiated' },
    });

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_system_reset',
      summary: 'All e-signature data cleared (system wipe)',
      severity: 'critical',
      entityType: 'system',
    }).catch(() => {});

    return c.json({ success: true, message: 'All E-Signature data cleared' });
  } catch (error: unknown) {
    log.error('❌ Clear all data error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to clear data' }, status);
  }
});

/**
 * POST /envelopes/upload
 * Upload a PDF document and create an envelope
 */
esignRoutes.post('/envelopes/upload', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;

    // Ensure storage buckets exist (lazy init)
    await ensureStorageBuckets();

    // Parse multipart form data — use { all: true } so duplicate keys
    // (e.g. multiple files under 'files') are returned as arrays.
    // Wrap in try/catch because Hono's parseBody calls formData.forEach()
    // internally, which throws if the body cannot be parsed as FormData
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json({ 
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
        details: parseErr?.message || String(parseErr)
      }, 400);
    }
    
    // With { all: true }, duplicate keys become arrays.
    // Single values remain as-is, so normalise both cases.
    let files: File[] = [];
    
    const rawFiles = body['files'] ?? body['file'];
    if (rawFiles) {
      if (Array.isArray(rawFiles)) {
        files = rawFiles.filter((f: unknown): f is File => f instanceof File);
      } else if (rawFiles instanceof File) {
        files = [rawFiles];
      }
    }

    // contextStr may also be wrapped in an array by { all: true }
    const contextStr: string | undefined = Array.isArray(body['context'])
      ? (body['context'][0] as string)
      : (body['context'] as string);

    if (files.length === 0 || !contextStr) {
      return c.json({ error: 'Files and context required' }, 400);
    }

    const context = JSON.parse(contextStr);
    const { clientId, adviceCaseId, requestId, productId, title, message, expiryDays } = context;

    if (!title) {
      return c.json({ error: 'title required in context' }, 400);
    }

    // Use 'standalone' as clientId if not provided (for standalone e-sign module)
    const effectiveClientId = clientId || 'standalone';

    // Process files
    let finalFileBuffer: Uint8Array;
    let finalFileName: string;

    if (files.length === 1) {
       const file = files[0];
       finalFileName = file.name;
       const arrayBuffer = await file.arrayBuffer();
       finalFileBuffer = new Uint8Array(arrayBuffer);
    } else {
       // Merge files
       log.info(`Merging ${files.length} files for envelope: ${title}`);
       const buffers: Uint8Array[] = [];
       // Sort files if needed? For now assume client sends them in order.
       for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          buffers.push(new Uint8Array(arrayBuffer));
       }
       finalFileBuffer = await PDFService.mergeDocuments(buffers);
       // Create a meaningful name for the merged file
       finalFileName = `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    }

    // Validate Document
    const validation = validateDocument(finalFileBuffer, finalFileName);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Calculate hash and page count
    const hash = await calculateHash(finalFileBuffer);
    const pageCount = extractPageCount(finalFileBuffer);

    // Generate IDs
    const documentId = crypto.randomUUID();
    const firmId = 'firm_' + crypto.randomUUID(); // Placeholder firm ID

    // Determine MIME type (Always PDF for merged or single PDF, but if single was docx we might have issues)
    // The current validateDocument allows PDF. If we merged, it's definitely PDF.
    // If it was a single file, it could be DOC/DOCX but validateDocument might catch it if it expects PDF headers?
    // Let's assume input is PDF for now as PDFService expects PDF.
    let mimeType = 'application/pdf';
    
    // Upload to storage
    const { path, error: uploadError } = await uploadDocument(
      firmId,
      documentId,
      finalFileBuffer,
      finalFileName,
      mimeType
    );

    if (uploadError || !path) {
      return c.json({ error: uploadError || 'Upload failed' }, 500);
    }

    // Create document record
    await createDocument({
      id: documentId,
      firm_id: firmId,
      storage_path: path,
      original_filename: finalFileName,
      page_count: pageCount,
      hash,
      created_at: new Date().toISOString(),
    });

    // Create envelope
    const { envelopeId, error: envError } = await createEnvelope({
      firmId,
      clientId: effectiveClientId,
      title,
      documentId,
      createdByUserId: user.id,
      adviceCaseId,
      requestId,
      productId,
      signers: [],
      message,
      expiryDays,
      signingMode: context.signingMode || 'sequential',
    });

    if (envError || !envelopeId) {
      return c.json({ error: envError || 'Failed to create envelope' }, 500);
    }

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);
    const documentUrl = await getDocumentUrl(path);

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'document_uploaded',
      ip,
      userAgent,
      email: user.email,
      metadata: { filename: finalFileName, pageCount, hash, fileCount: files.length },
    });

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'configuration',
      action: 'esign_envelope_created',
      summary: `E-signature envelope created: ${title || finalFileName}`,
      severity: 'info',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { fileName: finalFileName, pageCount },
    }).catch(() => {});

    return c.json({
      envelope: {
        ...envelope,
        document: {
          ...envelope.document,
          url: documentUrl,
        },
      },
    });
  } catch (error: unknown) {
    log.error('❌ Upload error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Upload failed' }, status);
  }
});

/**
 * GET /envelopes/:envelopeId
 * Get envelope details with signers, fields, and document URL
 */
esignRoutes.get('/envelopes/:envelopeId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get document URL
    const documentPath = envelope.document?.storage_path;
    const documentUrl = documentPath ? await getDocumentUrl(documentPath) : null;

    return c.json({
      ...envelope,
      document: {
        ...envelope.document,
        url: documentUrl,
      },
    });
  } catch (error: unknown) {
    log.error('❌ Get envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch envelope' }, status);
  }
});

/**
 * PUT /envelopes/:envelopeId/draft-signers
 * Persist signer configuration on a draft envelope so it survives page
 * reloads / "Continue Editing" resume flow.  These are NOT the real signer
 * records (those are created at invite-send time); they are the lightweight
 * form data the admin entered during the recipients step.
 */
esignRoutes.put('/envelopes/:envelopeId/draft-signers', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = DraftSignersSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { signers } = parsed.data;

    // Fetch the envelope
    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow updates to draft envelopes
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Can only update signers on draft envelopes' }, 400);
    }

    // Persist the draft signer config on the envelope record
    const updated = {
      ...envelope,
      draft_signers: signers,
      updated_at: new Date().toISOString(),
    };

    await kv.set(EsignKeys.envelope(envelopeId), updated);

    log.info(`Saved ${signers.length} draft signer(s) on envelope ${envelopeId}`);

    return c.json({ success: true, count: signers.length });
  } catch (error: unknown) {
    log.error('Save draft signers error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to save draft signers' }, status);
  }
});

/**
 * POST /envelopes/:envelopeId/invites
 * Send signing invitations to signers
 */
esignRoutes.post('/envelopes/:envelopeId/invites', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const { signers, fields, expiryDays, message, signingMode } = body;

    if (!signers || signers.length === 0) {
      return c.json({ error: 'At least one signer required' }, 400);
    }

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Determine signing mode: sequential (default) or parallel
    const effectiveMode = signingMode || envelope.signing_mode || 'sequential';

    // Add signers
    const { signerIds, error: signerError } = await addSignersToEnvelope(
      envelopeId,
      signers.map((s: SignerRecord, index: number) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role || 'Signer',
        requiresOtp: s.requiresOtp !== false,
        accessCode: s.accessCode,
        clientId: s.clientId,
      }))
    );

    if (signerError) {
      return c.json({ error: signerError }, 500);
    }

    // Add fields if provided
    if (fields && fields.length > 0) {
      // First, clear any existing fields (e.g. from draft saves) to avoid duplicates
      // and ensure we have clean fields with correct signer IDs
      await kv.del(EsignKeys.envelopeFields(envelopeId));
      
      // Map signer indices to actual signer IDs
      const fieldsWithSignerIds = fields.map((field: FieldRecord) => ({
        ...field,
        signerId: signerIds[field.signerIndex] || signerIds[0],
      }));

      await addFieldsToEnvelope(envelopeId, fieldsWithSignerIds);
    }

    // Update envelope status and persist signing mode
    await updateEnvelopeStatus(envelopeId, 'sent', {
      sent_at: new Date().toISOString(),
      signing_mode: effectiveMode,
    });

    // Determine which signers to invite based on signing mode:
    // - sequential: only first signer (subsequent signers notified when previous completes)
    // - parallel: all signers at once
    const createdSigners = await getEnvelopeSigners(envelopeId);
    const sortedSigners = [...createdSigners].sort((a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0));
    const invitesSent: Array<{ signerId: string; email: string; success: boolean }> = [];
    const { ip, userAgent } = getRequestMetadata(c);

    const signersToInvite = effectiveMode === 'parallel'
      ? sortedSigners
      : sortedSigners.slice(0, 1); // Sequential: first signer only

    for (const targetSigner of signersToInvite) {
      const signingUrl = `https://navigatewealth.co/sign?token=${targetSigner.access_token}`;

      const emailContent = createSigningInviteEmail({
        signerName: targetSigner.name,
        envelopeTitle: envelope.title,
        senderName: user.email || 'Navigate Wealth',
        signingLink: signingUrl,
        message,
      });

      const emailSent = await sendEmail({
        to: targetSigner.email,
        subject: `Signature Request: ${envelope.title}`,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (emailSent) {
        await updateSignerStatus(targetSigner.id, 'sent', {
          invite_sent_at: new Date().toISOString(),
        });
        invitesSent.push({ signerId: targetSigner.id, email: targetSigner.email });
      }

      await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'invite_sent',
        email: targetSigner.email,
        ip,
        userAgent,
        metadata: {
          signerId: targetSigner.id,
          signerName: targetSigner.name,
          signingMode: effectiveMode,
          totalSigners: sortedSigners.length,
        },
      });
    }

    log.info(`Invites sent for envelope ${envelopeId} in ${effectiveMode} mode: ${invitesSent.length} of ${sortedSigners.length} signers`);

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'communication',
      action: 'esign_invites_sent',
      summary: `Signing invitations sent (${invitesSent.length} of ${sortedSigners.length} signers)`,
      severity: 'warning',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { signingMode: effectiveMode, inviteCount: invitesSent.length, totalSigners: sortedSigners.length },
    }).catch(() => {});

    return c.json({
      success: true,
      invitesSent,
      envelopeId,
      totalSigners: sortedSigners.length,
      signingMode: effectiveMode,
    });
  } catch (error: unknown) {
    log.error('❌ Send invites error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send invites' }, status);
  }
});

/**
 * PUT /envelopes/:envelopeId/fields
 * Update/replace all fields for an envelope (used during form preparation)
 */
esignRoutes.put('/envelopes/:envelopeId/fields', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = UpdateFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { fields } = parsed.data;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get existing field IDs to clean up
    const fieldsListKey = EsignKeys.envelopeFields(envelopeId);
    const existingFieldIds = await kv.get(fieldsListKey);
    
    // If existingFieldIds is an array of strings (correct format), delete those fields
    if (Array.isArray(existingFieldIds)) {
       for (const item of existingFieldIds) {
          if (typeof item === 'string') {
             await kv.del(EsignKeys.field(item));
          }
       }
    }

    // Prepare new fields
    const newFieldIds: string[] = [];
    const fieldsToReturn: FieldRecord[] = [];

    for (const field of fields) {
      const fieldId = field.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const fieldData = {
        id: fieldId,
        envelope_id: envelopeId,
        type: field.type,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required !== undefined ? field.required : true,
        signer_id: field.signer_id,
        value: field.value || null,
        metadata: field.metadata || {},
        created_at: field.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await kv.set(EsignKeys.field(fieldId), fieldData);
      newFieldIds.push(fieldId);
      fieldsToReturn.push(fieldData);
    }

    // Save list of IDs
    await kv.set(fieldsListKey, newFieldIds);

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'fields_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: { fieldCount: newFieldIds.length },
    });

    return c.json({
      success: true,
      fields: fieldsToReturn,
      count: fieldsToReturn.length,
    });
  } catch (error: unknown) {
    log.error('❌ Update fields error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update fields' }, status);
  }
});

/**
 * GET /envelopes/:envelopeId/fields
 * Get all fields for an envelope
 */
esignRoutes.get('/envelopes/:envelopeId/fields', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Return the hydrated fields from the envelope details
    return c.json({
      fields: envelope.fields || [],
      count: (envelope.fields || []).length,
    });
  } catch (error: unknown) {
    log.error('❌ Get fields error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch fields' }, status);
  }
});

/**
 * PATCH /envelopes/:envelopeId/fields/:fieldId
 * Update a single field (for real-time position updates)
 */
esignRoutes.patch('/envelopes/:envelopeId/fields/:fieldId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const fieldId = c.req.param('fieldId');

    const body = await c.req.json();
    const updates = body;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Retrieve current fields list (IDs or Objects)
    const kvKey = EsignKeys.envelopeFields(envelopeId);
    const fieldsList = await kv.get(kvKey) || [];

    // Check if we are dealing with a list of IDs or Objects
    const isIdList = Array.isArray(fieldsList) && fieldsList.length > 0 && typeof fieldsList[0] === 'string';

    if (isIdList) {
      // New format: List of IDs
      // Check if ID is in list
      if (!fieldsList.includes(fieldId)) {
        return c.json({ error: 'Field not found' }, 404);
      }
      
      // Get the individual field object
      const fieldKey = EsignKeys.field(fieldId);
      const field = await kv.get(fieldKey);
      
      if (!field) {
        return c.json({ error: 'Field data not found' }, 404);
      }

      // Update the field object
      const updatedField = {
        ...field,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Save updated object
      await kv.set(fieldKey, updatedField);

      return c.json({
        success: true,
        field: updatedField,
      });

    } else {
      // Legacy format: List of Objects
      const fieldIndex = fieldsList.findIndex((f: FieldRecord) => f.id === fieldId);
      
      if (fieldIndex === -1) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Update the field
      fieldsList[fieldIndex] = {
        ...fieldsList[fieldIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Save back to KV store
      await kv.set(kvKey, fieldsList);

      return c.json({
        success: true,
        field: fieldsList[fieldIndex],
      });
    }
  } catch (error: unknown) {
    log.error('❌ Update field error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update field' }, status);
  }
});

/**
 * DELETE /envelopes/:envelopeId/fields/:fieldId
 * Delete a single field
 */
esignRoutes.delete('/envelopes/:envelopeId/fields/:fieldId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');
    const fieldId = c.req.param('fieldId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Retrieve current fields list
    const kvKey = EsignKeys.envelopeFields(envelopeId);
    const fieldsList = await kv.get(kvKey) || [];
    
    // Check format
    const isIdList = Array.isArray(fieldsList) && fieldsList.some((item: unknown) => typeof item === 'string');

    if (isIdList) {
       // Filter out the deleted ID
       const updatedIds = fieldsList.filter((id: unknown) => id !== fieldId && typeof id === 'string');
       
       if (fieldsList.length === updatedIds.length) {
         return c.json({ error: 'Field not found' }, 404);
       }
       
       // Update list
       await kv.set(kvKey, updatedIds);
       
       // Delete individual object
       await kv.del(EsignKeys.field(fieldId));

    } else {
       // Legacy: Filter objects
       const updatedFields = fieldsList.filter((f: FieldRecord) => f.id !== fieldId);

       if (fieldsList.length === updatedFields.length) {
         return c.json({ error: 'Field not found' }, 404);
       }

       // Save back to KV store
       await kv.set(kvKey, updatedFields);
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'field_deleted',
      ip,
      userAgent,
      email: user.email,
      metadata: { fieldId },
    });

    return c.json({
      success: true,
      deletedFieldId: fieldId,
    });
  } catch (error: unknown) {
    log.error('❌ Delete field error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete field' }, status);
  }
});

/**
 * GET /clients/:clientId/envelopes
 * Get all envelopes for a client (merges client_id linkage + signer-email index)
 */
esignRoutes.get('/clients/:clientId/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const clientId = c.req.param('clientId');
    const clientEmail = c.req.query('email') || undefined;

    const envelopes = await getClientEnvelopes(clientId, clientEmail);

    return c.json({ envelopes });
  } catch (error: unknown) {
    log.error('❌ Get client envelopes error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch envelopes' }, status);
  }
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/otp/send
 * Send OTP to signer
 */
esignRoutes.post('/envelopes/:envelopeId/signers/:signerId/otp/send', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');
    const signerId = c.req.param('signerId');

    // Check if OTP is required
    const required = await isOTPRequired(signerId);
    if (!required) {
      return c.json({ error: 'OTP not required for this signer' }, 400);
    }

    // Generate and store OTP
    const { otp, error } = await generateAndStoreOTP(signerId);

    if (error || !otp) {
      return c.json({ error: error || 'Failed to generate OTP' }, 500);
    }

    // Get signer info
    const signers = await getEnvelopeSigners(envelopeId);
    const signer = signers.find(s => s.id === signerId);

    if (!signer) {
      return c.json({ error: 'Signer not found' }, 404);
    }

    // Send OTP via email
    const emailSent = await sendEmail({
      to: signer.email,
      subject: `Your Verification Code for Navigate Wealth E-Signature`,
      html: `
        <h2>Your Verification Code</h2>
        <p>Hi ${signer.name},</p>
        <p>Your one-time verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
    });

    if (!emailSent) {
      return c.json({ error: 'Failed to send OTP email' }, 500);
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'system',
      action: 'otp_sent',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId },
    });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Send OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send OTP' }, 500);
  }
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/verify
 * Verify OTP and access code
 */
esignRoutes.post('/envelopes/:envelopeId/signers/:signerId/verify', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');
    const signerId = c.req.param('signerId');

    const body = await c.req.json();
    const { otp, accessCode } = body;

    // Verify access code (if provided)
    if (accessCode) {
      const accessCodeResult = await verifyAccessCode(signerId, accessCode);
      if (!accessCodeResult.valid) {
        return c.json({ error: accessCodeResult.error || 'Invalid access code' }, 401);
      }
    }

    // Verify OTP
    const otpResult = await verifyOTP(signerId, otp);
    if (!otpResult.valid) {
      return c.json({ error: otpResult.error || 'Invalid OTP' }, 401);
    }

    // Mark as verified
    await markOTPVerified(signerId);
    await clearOTP(signerId);

    // Update signer status
    await updateSignerStatus(signerId, 'viewed', {
      viewed_at: new Date().toISOString(),
    });

    // Log audit event
    const signers = await getEnvelopeSigners(envelopeId);
    const signer = signers.find(s => s.id === signerId);
    const { ip, userAgent } = getRequestMetadata(c);
    
    await logAuditEvent({
      envelopeId,
      actorType: 'signer',
      actorId: signerId,
      action: 'otp_verified',
      email: signer?.email,
      ip,
      userAgent,
      metadata: { signerId },
    });

    return c.json({ success: true, verified: true });
  } catch (error: unknown) {
    log.error('❌ Verify OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Verification failed' }, 500);
  }
});

/**
 * POST /envelopes/:envelopeId/sign
 * Submit signature
 */
esignRoutes.post('/envelopes/:envelopeId/sign', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = SignEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { signerId, signatureData, fieldValues } = parsed.data;

    if (!signatureData) {
      return c.json({ error: 'signatureData required' }, 400);
    }

    // Get signer
    const signers = await getEnvelopeSigners(envelopeId);
    const signer = signers.find(s => s.id === signerId);

    if (!signer) {
      return c.json({ error: 'Signer not found' }, 404);
    }

    // Check if already signed
    if (signer.status === 'signed') {
      return c.json({ error: 'Already signed' }, 400);
    }

    // Update field values
    if (fieldValues && Array.isArray(fieldValues)) {
      for (const fv of fieldValues) {
        if (fv.fieldId && fv.value !== undefined) {
          await updateFieldValue(fv.fieldId, fv.value);
        }
      }
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signerId, 'signed', {
      signed_at: new Date().toISOString(),
      signature_data: signatureData,
      ip_address: ip,
      user_agent: userAgent,
    });

    // Log audit event
    await logAuditEvent({
      envelopeId,
      actorType: 'signer',
      actorId: signerId,
      action: 'signed',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId, signerName: signer.name },
    });

    // Check if envelope is complete
    const isComplete = await checkEnvelopeCompletion(envelopeId);

    if (isComplete) {
      // Trigger full completion workflow (Burn-in + Certificate)
      await completeEnvelope(envelopeId);

      await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'envelope_completed',
        ip,
        userAgent,
        metadata: { allSignersCompleted: true },
      });
    } else {
      // Not all signers have signed — handle next-signer notification based on signing mode
      const envelopeForMode = await getEnvelopeDetails(envelopeId);
      const adminSignMode = envelopeForMode?.signing_mode || 'sequential';

      // Update envelope to partially_signed
      await updateEnvelopeStatus(envelopeId, 'partially_signed');

      // Sequential mode: notify next pending signer in order
      if (adminSignMode === 'sequential') {
        const allSigners = await getEnvelopeSigners(envelopeId);
        const sorted = [...allSigners].sort((a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0));
        const nextSigner = sorted.find((s: SignerRecord) => s.status === 'pending');

        if (nextSigner) {
          try {
            const signingUrl = `https://navigatewealth.co/sign?token=${nextSigner.access_token}`;

            const emailContent = createSigningInviteEmail({
              signerName: nextSigner.name,
              envelopeTitle: envelopeForMode?.title || 'Document',
              senderName: 'Navigate Wealth',
              signingLink: signingUrl,
              message: envelopeForMode?.message,
            });

            const emailSent = await sendEmail({
              to: nextSigner.email,
              subject: `Signature Request: ${envelopeForMode?.title || 'Document'}`,
              html: emailContent.html,
              text: emailContent.text,
            });

            if (emailSent) {
              await updateSignerStatus(nextSigner.id, 'sent', {
                invite_sent_at: new Date().toISOString(),
              });
            }

            await logAuditEvent({
              envelopeId,
              actorType: 'system',
              action: 'invite_sent',
              email: nextSigner.email,
              ip,
              userAgent,
              metadata: { signerId: nextSigner.id, signerName: nextSigner.name, signingMode: 'sequential', triggeredBy: signerId },
            });

            log.info(`Sequential signing: notified next signer ${nextSigner.email} (order ${nextSigner.order})`);
          } catch (notifyErr) {
            log.error('Failed to notify next signer:', notifyErr);
            // Non-critical: signing still succeeded
          }
        }
      }
      // Parallel mode: no next-signer notification needed (all already invited)
    }

    return c.json({
      success: true,
      signed: true,
      envelopeComplete: isComplete,
    });
  } catch (error: unknown) {
    log.error('❌ Sign error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Signing failed' }, 500);
  }
});

/**
 * POST /envelopes/:envelopeId/reject
 * Reject signing
 */
esignRoutes.post('/envelopes/:envelopeId/reject', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = RejectEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { signerId, reason } = parsed.data;

    // Get signer
    const signers = await getEnvelopeSigners(envelopeId);
    const signer = signers.find(s => s.id === signerId);

    if (!signer) {
      return c.json({ error: 'Signer not found' }, 404);
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signerId, 'declined', {
      declined_at: new Date().toISOString(),
      decline_reason: reason,
    });

    // Log audit event
    await logAuditEvent({
      envelopeId,
      actorType: 'signer',
      actorId: signerId,
      action: 'declined',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId, reason },
    });

    return c.json({
      success: true,
      rejected: true,
    });
  } catch (error: unknown) {
    log.error('❌ Reject error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Rejection failed' }, 500);
  }
});

/**
 * GET /envelopes/:envelopeId/audit
 * Get audit trail
 */
esignRoutes.get('/envelopes/:envelopeId/audit', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const events = await getAuditTrail(envelopeId);

    return c.json({ events });
  } catch (error: unknown) {
    log.error('❌ Get audit trail error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch audit trail' }, status);
  }
});

/**
 * GET /envelopes/:envelopeId/document
 * Get document URL
 */
esignRoutes.get('/envelopes/:envelopeId/document', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope || !envelope.document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const url = await getDocumentUrl(envelope.document.storage_path);

    return c.json({ url });
  } catch (error: unknown) {
    log.error('❌ Get document URL error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get document URL' }, status);
  }
});

/**
 * GET /envelopes/:envelopeId/certificate
 * Get certificate URL
 */
esignRoutes.get('/envelopes/:envelopeId/certificate', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const certificate = await getCertificate(envelopeId);

    if (!certificate.exists) {
      return c.json({ error: 'Certificate not found' }, 404);
    }

    const url = await getCertificateUrl(certificate.storagePath!);

    return c.json({ url, certificate });
  } catch (error: unknown) {
    log.error('❌ Get certificate URL error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get certificate URL' }, status);
  }
});

/**
 * GET /sign-by-token/:token
 * Get envelope and signer info by access token (public endpoint for signing page)
 */
esignRoutes.get('/sign-by-token/:token', async (c) => {
  try {
    const token = c.req.param('token');

    // Get signer by token
    const signer = await getSignerByToken(token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired signing link' }, 404);
    }

    // Get envelope
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const signerFields = envelope.fields.filter((f: FieldRecord) => f.signer_id === signer.id);

    return c.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        message: envelope.message,
        status: envelope.status,
        document: {
          ...envelope.document,
          url: documentUrl,
        },
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        status: signer.status,
        requires_otp: signer.requires_otp,
        otp_verified: signer.otp_verified,
      },
      fields: signerFields,
    });
  } catch (error: unknown) {
    log.error('❌ Get signing info error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch signing information' }, 500);
  }
});

// ==================== SIGNER PUBLIC ENDPOINTS (No Auth Required) ====================

/**
 * POST /signer/validate
 * Validate access token and get signer session data (public endpoint)
 */
esignRoutes.post('/signer/validate', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SignerValidateSchema.safeParse({ token: body.access_token });
    if (!parsed.success) {
      return c.json({ error: 'access_token required', ...formatZodError(parsed.error) }, 400);
    }
    const access_token = parsed.data.token;

    // Rate limit check (IP based to prevent scanning)
    const { ip } = getRequestMetadata(c);
    const rateLimit = await checkRateLimit(ip, 'esign_token_validate', {
      maxAttempts: 60, // 1 per minute on average
      windowMs: 60 * 60 * 1000, 
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    // Get envelope
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Check if envelope is expired
    const now = new Date();
    const expiresAt = new Date(envelope.expires_at);
    if (now > expiresAt) {
      return c.json({ error: 'Document has expired' }, 410);
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const signerFields = envelope.fields.filter((f: FieldRecord) => f.signer_id === signer.id);

    // Determine if it's this signer's turn based on signing mode
    const allSigners = envelope.signers || [];
    const sortedAllSigners = [...allSigners].sort((a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0));
    const signerOrder = signer.order || 1;
    const signingMode = envelope.signing_mode || 'sequential';

    // In parallel mode, all signers can sign at any time.
    // In sequential mode, a signer can only sign when all lower-order signers have signed.
    const isTurn = signingMode === 'parallel'
      ? true
      : sortedAllSigners
          .filter((s: SignerRecord) => (s.order || 0) < signerOrder)
          .every((s: SignerRecord) => s.status === 'signed');

    // Build a summary of all signers (non-sensitive) for the waiting UI
    const signersSummary = sortedAllSigners.map((s: SignerRecord) => ({
      order: s.order,
      name: s.name,
      role: s.role,
      status: s.status,
      is_current: s.id === signer.id,
    }));

    // Auto-send OTP if required and not verified
    if (signer.requires_otp && !signer.otp_verified) {
      try {
        // Generate OTP
        const { otp, error: otpError } = await generateAndStoreOTP(signer.id);
        
        if (!otpError && otp) {
          // Send OTP Email
          const emailContent = createOTPEmail({
            signerName: signer.name,
            otp,
            envelopeTitle: envelope.title,
            expiresInMinutes: 15
          });

          await sendEmail({
            to: signer.email,
            subject: `Verification Code: ${envelope.title}`,
            html: emailContent.html,
            text: emailContent.text
          });
          
          // Log audit event
          const { ip, userAgent } = getRequestMetadata(c);
          await logAuditEvent({
            envelopeId: envelope.id,
            actorType: 'system',
            action: 'otp_sent',
            email: signer.email,
            ip,
            userAgent,
            metadata: { signerId: signer.id, note: 'Auto-sent on access' }
          });
          
          log.info(`✅ Auto-sent OTP to ${signer.email} for signer ${signer.id}`);
        }
      } catch (err) {
        log.warn('❌ Failed to auto-send OTP:', err);
        // We don't block the response, but we log the error
      }
    }

    // Return session data
    return c.json({
      envelope_id: envelope.id,
      envelope_title: envelope.title,
      envelope_message: envelope.message,
      envelope_status: envelope.status,
      document_url: documentUrl,
      document_filename: envelope.document?.original_filename,
      document_page_count: envelope.document?.page_count,
      signer_id: signer.id,
      signer_name: signer.name,
      signer_email: signer.email,
      signer_role: signer.role,
      signer_status: signer.status,
      signer_order: signerOrder,
      otp_required: signer.requires_otp,
      otp_verified: signer.otp_verified,
      access_code_required: !!signer.access_code,
      is_turn: isTurn,
      all_signers: signersSummary,
      fields: signerFields,
    });
  } catch (error: unknown) {
    log.error('❌ Validate token error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to validate token' }, 500);
  }
});

/**
 * POST /signer/verify-otp
 * Verify OTP for signer (public endpoint)
 */
esignRoutes.post('/signer/verify-otp', async (c) => {
  try {
    const body = await c.req.json();
    const { access_token, access_code } = body as Record<string, unknown>;
    const otpParsed = OtpVerifySchema.safeParse({ otp: body.otp });

    if (!access_token || !otpParsed.success) {
      return c.json({ error: 'access_token and valid otp required', ...(otpParsed.success ? {} : formatZodError(otpParsed.error)) }, 400);
    }
    const otp = otpParsed.data.otp;

    // Get signer by token (needed for rate limiting by user ID)
    const signer = await getSignerByToken(access_token as string);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Rate limit check (Per signer to prevent OTP guessing)
    const rateLimit = await checkRateLimit(signer.id, 'esign_otp_verify', RATE_LIMITS.EMAIL_VERIFICATION);

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Verify access code if required
    if (access_code) {
      const accessCodeResult = await verifyAccessCode(signer.id, access_code);
      if (!accessCodeResult.valid) {
        return c.json({ error: accessCodeResult.error || 'Invalid access code' }, 401);
      }
    }

    // Verify OTP
    const otpResult = await verifyOTP(signer.id, otp);
    if (!otpResult.valid) {
      return c.json({ error: otpResult.error || 'Invalid OTP' }, 401);
    }

    // Mark as verified
    await markOTPVerified(signer.id);
    await clearOTP(signer.id);

    // Update signer status
    await updateSignerStatus(signer.id, 'viewed', {
      viewed_at: new Date().toISOString(),
    });

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'otp_verified',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id },
    });

    return c.json({ 
      success: true, 
      verified: true,
      message: 'OTP verified successfully' 
    });
  } catch (error: unknown) {
    log.error('❌ Verify OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Verification failed' }, 500);
  }
});

/**
 * POST /signer/resend-otp
 * Resend OTP to signer (public endpoint)
 */
esignRoutes.post('/signer/resend-otp', async (c) => {
  try {
    const body = await c.req.json();
    const { access_token } = body;

    if (!access_token) {
      return c.json({ error: 'access_token required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Rate limit check (Per signer to prevent email spam)
    // Using slightly different config than verification
    const rateLimit = await checkRateLimit(signer.id, 'esign_otp_resend', {
        maxAttempts: 3, 
        windowMs: 60 * 60 * 1000, // 3 per hour
        blockDurationMs: 60 * 60 * 1000 
    });

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Check if OTP is required
    if (!signer.requires_otp) {
      return c.json({ error: 'OTP not required for this signer' }, 400);
    }

    // Generate and store new OTP
    const { otp, error } = await generateAndStoreOTP(signer.id);

    if (error || !otp) {
      return c.json({ error: error || 'Failed to generate OTP' }, 500);
    }

    // Get envelope details for email
    const envelope = await getEnvelopeDetails(signer.envelope_id);
    const envelopeTitle = envelope ? envelope.title : 'Document';

    // Send OTP via email
    const emailContent = createOTPEmail({
      signerName: signer.name,
      otp,
      envelopeTitle,
      expiresInMinutes: 15
    });

    const emailSent = await sendEmail({
      to: signer.email,
      subject: `Verification Code: ${envelopeTitle}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailSent) {
      return c.json({ error: 'Failed to send OTP email' }, 500);
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'system',
      action: 'otp_resent',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id },
    });

    return c.json({ 
      success: true, 
      message: 'OTP sent successfully' 
    });
  } catch (error: unknown) {
    log.error('❌ Resend OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to resend OTP' }, 500);
  }
});

/**
 * POST /signer/submit
 * Submit signature (public endpoint)
 */
esignRoutes.post('/signer/submit', async (c) => {
  try {
    const body = await c.req.json();
    const { access_token, signature_data, field_values } = body;

    if (!access_token || !signature_data) {
      return c.json({ error: 'access_token and signature_data required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Check if already signed
    if (signer.status === 'signed') {
      return c.json({ error: 'Document already signed' }, 400);
    }

    // Check if OTP verification is required but not done
    if (signer.requires_otp && !signer.otp_verified) {
      return c.json({ error: 'OTP verification required before signing' }, 403);
    }

    // Update field values
    if (field_values && Array.isArray(field_values)) {
      for (const fv of field_values) {
        if (fv.field_id && fv.value !== undefined) {
          await updateFieldValue(fv.field_id, fv.value);
        }
      }
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signer.id, 'signed', {
      signed_at: new Date().toISOString(),
      signature_data,
      ip_address: ip,
      user_agent: userAgent,
    });

    // Log audit event
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'signed',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, signerName: signer.name },
    });

    // Check if envelope is complete
    const isComplete = await checkEnvelopeCompletion(signer.envelope_id);

    if (isComplete) {
      // Trigger full completion workflow
      await completeEnvelope(signer.envelope_id);

      // Log completion
      await logAuditEvent({
        envelopeId: signer.envelope_id,
        actorType: 'system',
        action: 'envelope_completed',
        ip,
        userAgent,
        metadata: { allSignersCompleted: true },
      });
    } else {
      // Not all signers have signed yet — handle next-signer notification and progress updates
      const envelopeForProgress = await getEnvelopeDetails(signer.envelope_id);
      const currentMode = envelopeForProgress?.signing_mode || 'sequential';
      const allSigners = await getEnvelopeSigners(signer.envelope_id);
      const sorted = [...allSigners].sort((a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0));
      const signedCount = sorted.filter((s: SignerRecord) => s.status === 'signed').length;
      const totalSigners = sorted.length;

      // Update envelope to partially_signed
      await updateEnvelopeStatus(signer.envelope_id, 'partially_signed');

      // Sequential mode: notify next pending signer in order
      if (currentMode === 'sequential') {
        const nextSigner = sorted.find((s: SignerRecord) => s.status === 'pending');

        if (nextSigner) {
          try {
            const signingUrl = `https://navigatewealth.co/sign?token=${nextSigner.access_token}`;

            const emailContent = createSigningInviteEmail({
              signerName: nextSigner.name,
              envelopeTitle: envelopeForProgress?.title || 'Document',
              senderName: 'Navigate Wealth',
              signingLink: signingUrl,
              message: envelopeForProgress?.message,
            });

            const emailSent = await sendEmail({
              to: nextSigner.email,
              subject: `Signature Request: ${envelopeForProgress?.title || 'Document'}`,
              html: emailContent.html,
              text: emailContent.text,
            });

            if (emailSent) {
              await updateSignerStatus(nextSigner.id, 'sent', {
                invite_sent_at: new Date().toISOString(),
              });
            }

            await logAuditEvent({
              envelopeId: signer.envelope_id,
              actorType: 'system',
              action: 'invite_sent',
              email: nextSigner.email,
              ip,
              userAgent,
              metadata: {
                signerId: nextSigner.id,
                signerName: nextSigner.name,
                signingMode: 'sequential',
                triggeredBy: signer.id,
              },
            });

            log.info(`Sequential signing: notified next signer ${nextSigner.email} (order ${nextSigner.order})`);
          } catch (notifyErr) {
            log.error('Failed to notify next signer after public submit:', notifyErr);
            // Non-critical: signing still succeeded, don't fail the response
          }
        }
      }
      // Parallel mode: no next-signer notification needed (all already invited)

      // Notify sender (admin) of per-signer progress
      try {
        if (envelopeForProgress?.created_by_user_id) {
          const { data: senderUser } = await getSupabase().auth.admin.getUserById(envelopeForProgress.created_by_user_id);
          const senderEmail = senderUser?.user?.email;

          if (senderEmail) {
            const progressHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                  <h2 style="color: white; margin: 0; font-size: 18px;">Signing Progress Update</h2>
                </div>
                <div style="background: #ffffff; padding: 24px 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="color: #374151; margin: 0 0 16px;">
                    <strong>${signer.name}</strong> has signed <strong>${envelopeForProgress.title}</strong>.
                  </p>
                  <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;">Progress: ${signedCount} of ${totalSigners} signers completed</p>
                    <div style="background: #E5E7EB; border-radius: 4px; height: 8px; overflow: hidden;">
                      <div style="background: #4F46E5; height: 100%; width: ${Math.round((signedCount / totalSigners) * 100)}%; border-radius: 4px;"></div>
                    </div>
                  </div>
                  <p style="color: #9CA3AF; font-size: 12px; margin: 16px 0 0;">
                    Mode: ${currentMode === 'sequential' ? 'Sequential' : 'Parallel'} signing
                  </p>
                </div>
              </div>`;

            await sendEmail({
              to: senderEmail,
              subject: `Progress: ${signer.name} signed "${envelopeForProgress.title}" (${signedCount}/${totalSigners})`,
              html: progressHtml,
              text: `${signer.name} has signed "${envelopeForProgress.title}". Progress: ${signedCount} of ${totalSigners} signers completed.`,
            });
          }
        }
      } catch (progressEmailErr) {
        log.error('Failed to send progress notification to sender:', progressEmailErr);
        // Non-critical
      }
    }

    // Get envelope details for response
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    return c.json({
      success: true,
      signed: true,
      envelope_complete: isComplete,
      envelope_id: signer.envelope_id,
      envelope_title: envelope.title,
    });
  } catch (error: unknown) {
    log.error('❌ Submit signature error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to submit signature' }, 500);
  }
});

/**
 * POST /signer/reject
 * Reject document (public endpoint)
 */
esignRoutes.post('/signer/reject', async (c) => {
  try {
    const body = await c.req.json();
    const { access_token, reason } = body;

    if (!access_token) {
      return c.json({ error: 'access_token required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signer.id, 'declined', {
      declined_at: new Date().toISOString(),
      decline_reason: reason || 'No reason provided',
    });

    // Update envelope status to declined
    await updateEnvelopeStatus(signer.envelope_id, 'declined');

    // Log audit event
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'declined',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, signerName: signer.name, reason },
    });

    log.info(`Signer ${signer.email} declined envelope ${signer.envelope_id}`);

    // Notify sender (admin) about the decline
    try {
      const envelopeForNotify = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForNotify?.created_by_user_id) {
        const { data: senderUser } = await getSupabase().auth.admin.getUserById(envelopeForNotify.created_by_user_id);
        const senderEmail = senderUser?.user?.email;

        if (senderEmail) {
          const declineHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #DC2626, #F59E0B); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px;">Document Declined</h2>
              </div>
              <div style="background: #ffffff; padding: 24px 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; margin: 0 0 16px;">
                  <strong>${signer.name}</strong> (${signer.email}) has declined to sign <strong>${envelopeForNotify.title}</strong>.
                </p>
                ${reason ? `
                <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0 0 4px; color: #92400E; font-size: 12px; font-weight: 600;">Reason provided:</p>
                  <p style="margin: 0; color: #78350F; font-size: 14px;">${reason}</p>
                </div>` : ''}
                <p style="color: #6B7280; font-size: 13px; margin: 16px 0 0;">
                  The envelope status has been updated to <strong>Declined</strong>. You may void this envelope and create a new one if needed.
                </p>
              </div>
            </div>`;

          await sendEmail({
            to: senderEmail,
            subject: `Declined: ${signer.name} declined to sign "${envelopeForNotify.title}"`,
            html: declineHtml,
            text: `${signer.name} (${signer.email}) has declined to sign "${envelopeForNotify.title}". ${reason ? `Reason: ${reason}` : 'No reason provided.'}`,
          });

          log.info(`Decline notification sent to sender ${senderEmail}`);
        }
      }
    } catch (notifyErr) {
      log.error('Failed to send decline notification to sender:', notifyErr);
      // Non-critical: decline still succeeded
    }

    return c.json({
      success: true,
      rejected: true,
      envelope_id: signer.envelope_id,
    });
  } catch (error: unknown) {
    log.error('❌ Reject document error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to reject document' }, 500);
  }
});

/**
 * GET /signer/download/:token
 * Download signed document using signer token (public endpoint)
 */
esignRoutes.get('/signer/download/:token', async (c) => {
  try {
    const token = c.req.param('token');

    // Get signer by token
    const signer = await getSignerByToken(token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired signing link' }, 404);
    }
    
    // Get envelope details
    const envelopeId = signer.envelope_id;
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
       return c.json({ error: 'Envelope not found' }, 404);
    }
    
    // Only allow download if completed
    if (envelope.status !== 'completed') {
       return c.json({ error: 'Document not completed yet' }, 400);
    }

    // Check if we have a pre-generated signed document
    if (envelope.signed_document_path) {
       const signedPdfBuffer = await downloadDocument(envelope.signed_document_path);
       
       if (signedPdfBuffer) {
         return new Response(signedPdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
            },
         });
       }
    }

    // FALLBACK: On-the-fly generation
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
       return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        envelope.fields || [],
        signers
      );
      
      let finalPdfBuffer = burnedPdfBuffer;
      
      try {
         const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
         if (certBuffer) {
            finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
         }
      } catch (certError) {
         log.warn('Certificate merge failed during fallback download', certError);
      }

      return new Response(finalPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
        },
      });

    } catch (burnInError: unknown) {
      log.error('❌ Burn-in error:', burnInError);
      return c.json({ error: 'Failed to generate signed PDF' }, 500);
    }

  } catch (error: unknown) {
    log.error('❌ Signer download error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to download document' }, 500);
  }
});

/**
 * DELETE /envelopes/:envelopeId
 * Discard an envelope.
 *
 * Allowed when:
 *  - status is 'draft'  (no signers have been notified)
 *  - status is 'sent' or 'viewed' and NO signer has completed signing
 *
 * For sent/viewed envelopes, recall-notification emails are sent to all
 * signers so they know the envelope has been discarded.
 *
 * Completed, voided, or partially-signed (any signer has signed) envelopes
 * cannot be discarded — use void/recall for those.
 */
esignRoutes.delete('/envelopes/:envelopeId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      // Envelope already deleted or not found, treat as success (idempotency)
      return c.json({
        success: true,
        deleted: true,
      });
    }

    const signers = await getEnvelopeSigners(envelopeId);
    const anyoneSigned = signers.some((s: SignerRecord) => s.status === 'signed');

    // Determine whether the envelope can be discarded
    const discardableStatuses = ['draft', 'sent', 'viewed'];
    if (!discardableStatuses.includes(envelope.status)) {
      return c.json({
        error: `Cannot discard an envelope with status "${envelope.status}". Use void for completed or partially-signed envelopes.`,
      }, 400);
    }

    if (anyoneSigned) {
      return c.json({
        error: 'Cannot discard this envelope because one or more recipients have already signed. Use void instead.',
      }, 400);
    }

    const wasSent = envelope.status === 'sent' || envelope.status === 'viewed';

    // If the envelope was already sent, notify signers that it has been discarded
    if (wasSent && signers.length > 0) {
      for (const signer of signers) {
        try {
          await sendRecallNotification({
            signerEmail: signer.email,
            signerName: signer.name,
            envelopeTitle: envelope.title,
            reason: 'Discarded by admin',
          });
        } catch (emailError) {
          log.error(`Failed to send discard notification to ${signer.email}:`, emailError);
          // Continue — best-effort notification
        }
      }
    }

    // ---- Clean up all KV data for this envelope ----

    // Delete signers and their access tokens
    for (const signer of signers) {
      await kv.del(EsignKeys.PREFIX_SIGNER + signer.id);
      if (signer.access_token) {
        await kv.del(EsignKeys.signerToken(signer.access_token));
      }
    }
    await kv.del(EsignKeys.envelopeSigners(envelopeId));

    // Delete fields
    const rawFieldIds = await kv.get(EsignKeys.envelopeFields(envelopeId));
    if (Array.isArray(rawFieldIds)) {
      for (const item of rawFieldIds) {
        if (typeof item === 'string') {
          await kv.del(EsignKeys.field(item));
        }
      }
    }
    await kv.del(EsignKeys.envelopeFields(envelopeId));

    // Delete audit trail entries
    const rawAuditIds = await kv.get(EsignKeys.envelopeAudit(envelopeId));
    if (Array.isArray(rawAuditIds)) {
      for (const id of rawAuditIds) {
        if (typeof id === 'string') {
          await kv.del(EsignKeys.PREFIX_AUDIT + id);
        }
      }
    }
    await kv.del(EsignKeys.envelopeAudit(envelopeId));

    // Remove from client envelope list
    if (envelope.client_id) {
      const clientListKey = EsignKeys.clientEnvelopes(envelope.client_id);
      const clientEnvelopes = await kv.get(clientListKey);
      if (Array.isArray(clientEnvelopes)) {
        const updated = clientEnvelopes.filter((id: string) => id !== envelopeId);
        await kv.set(clientListKey, updated);
      }
    }

    // Delete envelope record itself
    await kv.del(EsignKeys.envelope(envelopeId));

    // Log audit event (orphaned — envelope already deleted, kept for system-level auditing)
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: user.id,
      action: 'deleted',
      email: user.email || 'admin@system',
      ip,
      userAgent,
      metadata: {
        deletedAt: new Date().toISOString(),
        previousStatus: envelope.status,
        signersNotified: wasSent ? signers.length : 0,
      },
    });

    log.info(`Envelope ${envelopeId} discarded (was ${envelope.status}, ${signers.length} signers)`);

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_discarded',
      summary: `Envelope discarded: ${envelope.title}`,
      severity: 'warning',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { previousStatus: envelope.status, signersNotified: wasSent ? signers.length : 0 },
    }).catch(() => {});

    return c.json({
      success: true,
      deleted: true,
      notifiedSigners: wasSent ? signers.length : 0,
    });
  } catch (error: unknown) {
    log.error('Delete envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete envelope' }, status);
  }
});

/**
 * POST /envelopes/:envelopeId/recall
 * Recall a sent envelope (stops the signing process)
 */
esignRoutes.post('/envelopes/:envelopeId/recall', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');
    const body = await c.req.json();
    const { reason } = body;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow recall of sent/viewed/partially_signed envelopes
    const recallableStatuses = ['sent', 'viewed', 'partially_signed'];
    if (!recallableStatuses.includes(envelope.status)) {
      return c.json({ 
        error: `Cannot recall envelope with status: ${envelope.status}. Only sent, viewed, or partially signed envelopes can be recalled.` 
      }, 400);
    }

    // Update envelope status to recalled
    await updateEnvelopeStatus(envelopeId, 'voided', {
      voided_at: new Date().toISOString(),
      void_reason: reason || 'Recalled by admin',
    });

    // Update all pending signers to declined status
    const signers = await getEnvelopeSigners(envelopeId);
    for (const signer of signers) {
      if (signer.status === 'pending' || signer.status === 'viewed') {
        await updateSignerStatus(signer.id, 'declined', {
          declined_at: new Date().toISOString(),
          decline_reason: 'Envelope recalled by admin',
        });
      }
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: user.id,
      action: 'recalled',
      email: user.email || 'admin@system',
      ip,
      userAgent,
      metadata: { 
        recalledAt: new Date().toISOString(),
        reason: reason || 'No reason provided',
      },
    });

    // Send recall notification emails to all signers
    log.info(`📧 Sending recall notifications to ${signers.length} signers`);
    for (const signer of signers) {
      try {
        await sendRecallNotification({
          signerEmail: signer.email,
          signerName: signer.name,
          envelopeTitle: envelope.title,
          reason,
        });
        log.info('✅ Recall notification sent to:', { email: signer.email });
      } catch (emailError) {
        log.error(`❌ Failed to send recall notification to ${signer.email}:`, emailError);
        // Continue with other signers even if one fails
      }
    }

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_recalled',
      summary: `Envelope recalled: ${envelope.title}`,
      severity: 'warning',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { reason: reason || 'No reason provided', signerCount: signers.length },
    }).catch(() => {});

    return c.json({
      success: true,
      recalled: true,
      envelope: await getEnvelopeDetails(envelopeId),
    });
  } catch (error: unknown) {
    log.error('❌ Recall envelope error:', error);
    const status = error instanceof AuthError ? error.status : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to recall envelope' }, status);
  }
});

/**
 * POST /envelopes/:envelopeId/remind
 * Send reminder to pending signers
 */
esignRoutes.post('/envelopes/:envelopeId/remind', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow reminders for active envelopes
    const remindableStatuses = ['sent', 'viewed', 'partially_signed'];
    if (!remindableStatuses.includes(envelope.status)) {
      return c.json({ 
        error: `Cannot send reminders for envelope with status: ${envelope.status}` 
      }, 400);
    }

    // Get all signers who haven't signed yet
    const signers = await getEnvelopeSigners(envelopeId);
    const pendingSigners = signers.filter(s => 
      s.status === 'pending' || s.status === 'viewed'
    );

    if (pendingSigners.length === 0) {
      return c.json({ error: 'No pending signers to remind' }, 400);
    }

    // Send reminder emails to pending signers
    log.info(`📧 Sending reminders to ${pendingSigners.length} pending signers`);
    const remindersSent: Array<{ signerId: string; email: string; success: boolean }> = [];

    for (const signer of pendingSigners) {
      try {
        const signingUrl = `https://navigatewealth.co/sign?token=${signer.access_token}`;
        
        await sendSigningReminder({
          signerEmail: signer.email,
          signerName: signer.name,
          envelopeTitle: envelope.title,
          signingUrl,
          expiresAt: envelope.expires_at,
        });

        remindersSent.push({ 
          signerId: signer.id, 
          email: signer.email,
          name: signer.name,
        });
        log.info('✅ Reminder sent to:', { email: signer.email });

        // Log audit event for each reminder
        const { ip, userAgent } = getRequestMetadata(c);
        await logAuditEvent({
          envelopeId,
          actorType: 'admin',
          actorId: user.id,
          action: 'reminder_sent',
          email: signer.email,
          ip,
          userAgent,
          metadata: { 
            signerId: signer.id,
            signerName: signer.name,
            sentAt: new Date().toISOString(),
          },
        });
      } catch (emailError) {
        log.error(`❌ Failed to send reminder to ${signer.email}:`, emailError);
        // Continue with other signers even if one fails
      }
    }

    return c.json({
      success: true,
      remindersSent,
      totalReminders: remindersSent.length,
    });
  } catch (error: unknown) {
    log.error('❌ Send reminder error:', error);
    const status = error instanceof AuthError ? error.status : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send reminders' }, status);
  }
});

/**
 * GET /envelopes/:envelopeId/download
 * Download completed envelope with signatures applied
 */
esignRoutes.get('/envelopes/:envelopeId/download', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow download of completed envelopes
    if (envelope.status !== 'completed') {
      return c.json({ 
        error: 'Only completed envelopes can be downloaded' 
      }, 400);
    }

    // Check if we have a pre-generated signed document
    if (envelope.signed_document_path) {
       const signedPdfBuffer = await downloadDocument(envelope.signed_document_path);
       
       if (signedPdfBuffer) {
         return new Response(signedPdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
            },
         });
       }
       // If buffer is null (file missing), fall back to on-the-fly generation below
    }

    // FALLBACK: On-the-fly generation (for legacy envelopes or if artifact missing)

    // Get original document path
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
       return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers to cross-reference
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        envelope.fields || [],
        signers
      );
      
      // Try to merge certificate if available, otherwise just return burned PDF
      let finalPdfBuffer = burnedPdfBuffer;
      
      // Try to generate/fetch cert
      // We don't want to fail the download if cert generation fails here, just return the signed doc
      try {
         const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
         if (certBuffer) {
            finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
         }
      } catch (certError) {
         log.warn('Certificate merge failed during fallback download, returning signed doc only', { error: certError });
      }

      return new Response(finalPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
        },
      });

    } catch (burnInError: unknown) {
      log.error('❌ Burn-in error:', burnInError);
      return c.json({ error: 'Failed to generate signed PDF' }, 500);
    }
  } catch (error: unknown) {
    log.error('❌ Download envelope error:', error);
    const status = error instanceof AuthError ? error.status : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to download envelope' }, status);
  }
});

// ==================== REMINDER CONFIG ROUTES ====================

/**
 * GET /envelopes/:envelopeId/reminder-config
 * Get reminder configuration for an envelope
 */
esignRoutes.get('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const config = await getReminderConfig(envelopeId);
    return c.json({ config });
  } catch (error: unknown) {
    log.error('Get reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get reminder config' }, status);
  }
});

/**
 * PUT /envelopes/:envelopeId/reminder-config
 * Update reminder configuration for an envelope
 */
esignRoutes.put('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const { auto_remind, remind_interval_days, max_reminders, remind_before_expiry_days } = body;

    await setReminderConfig(envelopeId, {
      ...(auto_remind !== undefined && { auto_remind }),
      ...(remind_interval_days !== undefined && { remind_interval_days }),
      ...(max_reminders !== undefined && { max_reminders }),
      ...(remind_before_expiry_days !== undefined && { remind_before_expiry_days }),
    });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'reminder_config_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: body,
    });

    const updated = await getReminderConfig(envelopeId);
    return c.json({ config: updated });
  } catch (error: unknown) {
    log.error('Update reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update reminder config' }, status);
  }
});

/**
 * PATCH /envelopes/:envelopeId/signing-mode
 * Update signing mode (sequential/parallel) for an envelope
 */
esignRoutes.patch('/envelopes/:envelopeId/signing-mode', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const { signing_mode } = body;

    if (!signing_mode || !['sequential', 'parallel'].includes(signing_mode)) {
      return c.json({ error: 'signing_mode must be "sequential" or "parallel"' }, 400);
    }

    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow changing mode on draft or sent envelopes
    if (!['draft', 'sent'].includes(envelope.status)) {
      return c.json({ error: `Cannot change signing mode for envelope with status: ${envelope.status}` }, 400);
    }

    await updateEnvelopeStatus(envelopeId, envelope.status, { signing_mode });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'signing_mode_changed',
      ip,
      userAgent,
      email: user.email,
      metadata: { from: envelope.signing_mode, to: signing_mode },
    });

    return c.json({ success: true, signing_mode });
  } catch (error: unknown) {
    log.error('Update signing mode error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update signing mode' }, status);
  }
});

// ==================== PHASE 3: AUDIT TRAIL EXPORT ====================

/**
 * GET /envelopes/:envelopeId/audit/export
 * Export audit trail as CSV.
 */
esignRoutes.get('/envelopes/:envelopeId/audit/export', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const events = await getAuditTrail(envelopeId);
    if (!events || events.length === 0) {
      return c.json({ error: 'No audit events found' }, 404);
    }

    // Build CSV
    const headers = ['Timestamp', 'Action', 'Actor Type', 'Actor Email', 'IP Address', 'Details'];
    const rows = events
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(String(a.at || a.created_at || 0)).getTime() - new Date(String(b.at || b.created_at || 0)).getTime())
      .map((e: Record<string, unknown>) => {
        const timestamp = String(e.at || e.created_at || '');
        const action = String(e.action || '').replace(/_/g, ' ').toUpperCase();
        const actorType = String(e.actor_type || '');
        const actorEmail = String(e.email || '');
        const ip = String(e.ip || '');
        const details = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : '';
        return `"${timestamp}","${action}","${actorType}","${actorEmail}","${ip}","${details}"`;
      });

    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-trail-${envelopeId.slice(0, 8)}.csv"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    });
  } catch (error: unknown) {
    log.error('Audit export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to export audit trail' }, status);
  }
});

// ==================== PHASE 4: TEMPLATE ROUTES ====================

/**
 * POST /templates
 * Create a new template (blank or from envelope)
 */
esignRoutes.post('/templates', async (c) => {
  try {
    const auth = await getAuthContext(c);
    const body = await c.req.json();

    if (!body.name || !body.name.trim()) {
      return c.json({ error: 'Template name is required' }, 400);
    }

    let template;

    if (body.fromEnvelopeId) {
      // Create from existing envelope
      template = await createTemplateFromEnvelope({
        envelopeId: body.fromEnvelopeId,
        name: body.name,
        description: body.description,
        category: body.category,
        createdBy: auth.userId || auth.user?.email || 'unknown',
      });
    } else {
      // Create blank / from provided data
      template = await createTemplate({
        name: body.name,
        description: body.description,
        category: body.category,
        signingMode: body.signingMode,
        defaultMessage: body.defaultMessage,
        defaultExpiryDays: body.defaultExpiryDays,
        recipients: body.recipients,
        fields: body.fields,
        createdBy: auth.userId || auth.user?.email || 'unknown',
      });
    }

    if (!template) {
      return c.json({ error: 'Failed to create template' }, 500);
    }

    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Create template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create template' }, 500);
  }
});

/**
 * GET /templates
 * List all templates
 */
esignRoutes.get('/templates', async (c) => {
  try {
    await getAuthContext(c);
    const templates = await listTemplates();
    return c.json({ templates });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('List templates error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list templates' }, 500);
  }
});

/**
 * GET /templates/:templateId
 * Get single template
 */
esignRoutes.get('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const template = await getTemplate(templateId);

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Get template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get template' }, 500);
  }
});

/**
 * PUT /templates/:templateId
 * Update template
 */
esignRoutes.put('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const body = await c.req.json();

    const updated = await updateTemplate(templateId, body);
    if (!updated) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Update template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update template' }, 500);
  }
});

/**
 * DELETE /templates/:templateId
 * Delete template
 */
esignRoutes.delete('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const deleted = await deleteTemplate(templateId);

    if (!deleted) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Delete template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete template' }, 500);
  }
});

/**
 * POST /templates/:templateId/use
 * Increment usage counter (called when user starts an envelope from a template)
 */
esignRoutes.post('/templates/:templateId/use', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');

    const template = await getTemplate(templateId);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    await incrementUsageCount(templateId);
    return c.json({ success: true, usageCount: (template.usageCount || 0) + 1 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Use template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to use template' }, 500);
  }
});

export default esignRoutes;
