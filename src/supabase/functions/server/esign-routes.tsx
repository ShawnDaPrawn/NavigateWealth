/**
 * E-Signature API Routes (KV Store Version)
 * RESTful API endpoints for e-signature functionality
 */

import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import type { EsignEnvelope, EsignField, EsignSigner } from './esign-types.ts';
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
  rotateSignerToken,
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
  uploadAttachment,
  getAttachmentUrl,
} from './esign-storage.ts';
import { PDFService } from './esign-pdf.service.ts';
import { analyzeUploadedPdf } from './esign-pdf-analysis.ts';
import { applyManifest, validateManifest } from './esign-pdf-transform.ts';
import {
  appendEnvelopeDocument,
  getEnvelopeDocuments,
  materialiseEnvelope,
  remapFieldsForConcatenation,
  removeEnvelopeDocument,
  reorderEnvelopeDocuments,
  setEnvelopeDocuments,
} from './esign-documents.ts';
import { resolvePrefilledFields } from './esign-prefill.ts';
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
import { runReminderSweep } from './esign-reminder-service.ts';
import {
  createTemplate,
  cloneTemplateDocumentsToEnvelope,
  getTemplate,
  listTemplates,
  syncTemplateFromEnvelope,
  updateTemplate,
  deleteTemplate,
  createTemplateFromEnvelope,
  incrementUsageCount,
  getTemplateVersion,
  listTemplateVersions,
} from './esign-template-service.ts';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  cancelCampaign,
  recordCampaignRowResult,
  parseCsv,
  mapCsvToRows,
} from './esign-campaign-service.ts';
import {
  createPacket,
  getPacket,
  listPackets,
  deletePacket,
  startPacketRun,
  getPacketRun,
  listPacketRuns,
  cancelPacketRun,
} from './esign-packet-service.ts';
import { 
  checkRateLimit, 
  clearRateLimit,
  RATE_LIMITS 
} from './rateLimiter.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { withCtx } from './esign-request-context.ts';
import { 
  sendEmail,
  sendSigningInvitation,
  sendSigningReminder,
  sendRecallNotification,
  sendCompletionNotification,
} from './email-service.ts';
import {
  sendInviteSms,
  sendOtpSms,
  sendReminderSms,
  getSmsProviderStatus,
} from './sms-service.ts';
import {
  shouldDeliverSenderEvent,
  queueForDigest,
  getPreferences as getNotifPrefs,
  setPreferences as setNotifPrefs,
  type SenderEvent,
} from './esign-notification-prefs.ts';
import {
  createSubscription as createWebhookSub,
  listSubscriptionsByFirm as listWebhookSubs,
  getSubscription as getWebhookSub,
  updateSubscription as updateWebhookSub,
  rotateSubscriptionSecret as rotateWebhookSubSecret,
  deleteSubscription as deleteWebhookSub,
  listRecentDeliveries as listWebhookDeliveries,
  listDeadLetters as listWebhookDeadLetters,
  replayDelivery as replayWebhookDelivery,
  emitWebhookEvent,
  type WebhookDeliveryStatus,
} from './webhook-service.ts';
import {
  createApiKey,
  listApiKeysByFirm,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  rotateApiKey,
  resolveApiKey,
  redactApiKey,
} from './api-key-service.ts';
import {
  enqueue as enqueueInAppNotification,
  list as listInAppNotifications,
  markRead as markInAppRead,
  markAllRead as markAllInAppRead,
} from './esign-inapp-notifications.ts';
import {
  getActiveConsent,
  getConsentByVersion,
  listConsentVersions,
  publishConsentVersion,
  setActiveConsent,
} from './esign-consent-registry.ts';
import {
  runKbaCheck,
  getKbaStatus,
} from './kba-service.ts';
import { buildEvidencePack } from './esign-evidence-export.ts';
import {
  listRecoveryBin,
  restoreEnvelope,
  hardDeleteEnvelope,
  purgeExpiredDeletedEnvelopes,
  RECOVERY_RETENTION_DAYS,
} from './esign-recovery-bin.ts';
import {
  resolveFirmId as resolveFirmIdShared,
  belongsToFirm,
} from './esign-firm-scope.ts';
import { getEsignMetrics } from './esign-metrics-service.ts';
import { runStuckAlertSweep } from './esign-stuck-alert-service.ts';
import { searchAuditEvents } from './esign-audit-search-service.ts';
import { runSyntheticProbe, getLatestProbe, getProbeHistory } from './esign-synthetic-probe.ts';
import { enqueueCompletion } from './esign-completion-queue.ts';
import {
  getRetentionPolicy,
  setRetentionPolicy,
  deleteRetentionPolicy,
  runRetentionSweep,
} from './esign-retention-service.ts';
// P8.6 — Per-firm signer-page branding (logo, accent colour).
import {
  getFirmBranding,
  setFirmBranding,
  deleteFirmBranding,
  toPublicBranding,
} from './esign-branding-service.ts';
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

/**
 * P2.5 2.8 — derive the audit actor_type for a given signer.
 *
 * Witnesses are first-class actors in the evidence trail. A primary signer's
 * `signed` event and a witness's `witness_attestation` event are both legally
 * meaningful but signify different things — they must be distinguishable in
 * the audit log without a metadata lookup.
 *
 * `kind` is optional on `EsignSigner` for back-compat with KV records written
 * before the field existed; a missing kind falls back to `'signer'`.
 */
function audActor(signer: { kind?: string } | null | undefined): 'signer' | 'witness' {
  return signer?.kind === 'witness' ? 'witness' : 'signer';
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
 * P5.2 — Sender notification preferences.
 * GET  /me/notification-prefs   → current user's prefs
 * PUT  /me/notification-prefs   → { mode, perEvent? }
 */
esignRoutes.get('/me/notification-prefs', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const prefs = await getNotifPrefs(ctx.user.id);
    return c.json({ success: true, preferences: prefs });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

esignRoutes.put('/me/notification-prefs', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const allowedModes = new Set(['every_event', 'completion_only', 'digest', 'off']);
    const mode = typeof body.mode === 'string' && allowedModes.has(body.mode)
      ? body.mode
      : undefined;
    const updated = await setNotifPrefs(ctx.user.id, {
      mode,
      perEvent: typeof body.perEvent === 'object' ? body.perEvent : undefined,
    });
    return c.json({ success: true, preferences: updated });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

/**
 * P5.7 — In-app notifications (bell UI).
 * GET  /me/notifications              → recent items + unread counter
 * POST /me/notifications/:id/read     → mark one as read
 * POST /me/notifications/read-all     → mark everything read
 */
esignRoutes.get('/me/notifications', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const limit = Number(c.req.query('limit') ?? 25);
    const unreadOnly = c.req.query('unreadOnly') === 'true';
    const result = await listInAppNotifications(ctx.user.id, { limit, unreadOnly });
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

esignRoutes.post('/me/notifications/:id/read', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const ok = await markInAppRead(ctx.user.id, id);
    return c.json({ success: ok });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

esignRoutes.post('/me/notifications/read-all', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const updated = await markAllInAppRead(ctx.user.id);
    return c.json({ success: true, updated });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

/**
 * P5.1 — SMS provider health check. Lets admin UI render
 * a badge like "Twilio: configured" or "noop: dev mode".
 */
esignRoutes.get('/diagnostics/sms', async (c) => {
  try {
    await getAuthContext(c);
    return c.json({ success: true, sms: getSmsProviderStatus() });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed' }, status);
  }
});

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
 * P5.3 — POST /maintenance/reminder-sweep
 * Manually trigger the escalating-reminder sweep (admin only, supports
 * dry-run-first pattern). Useful for testing new reminder configs.
 */
esignRoutes.post('/maintenance/reminder-sweep', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const { dryRun = true } = await c.req.json().catch(() => ({ dryRun: true }));

    log.info(`Reminder sweep requested by ${ctx.user.id} (dryRun=${dryRun})`);
    const result = await runReminderSweep(dryRun);

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: dryRun ? 'reminder_sweep_preview' : 'reminder_sweep_applied',
      metadata: {
        scannedCount: result.scannedCount,
        eligibleEnvelopeCount: result.eligibleEnvelopeCount,
        remindersSent: result.remindersSent,
        smsRemindersSent: result.smsRemindersSent,
        errorCount: result.errors.length,
        durationMs: result.durationMs,
      },
    });

    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('Reminder sweep error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Reminder sweep failed' }, status);
  }
});

/**
 * P5.3 — POST /cron/reminder-sweep
 * Scheduled entrypoint for the reminder sweep. Service-role auth only.
 */
esignRoutes.post('/cron/reminder-sweep', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!token || token !== serviceRoleKey) {
      return c.json({ error: 'Unauthorized — CRON endpoint requires service role key' }, 401);
    }

    log.info('CRON reminder sweep triggered');
    const result = await runReminderSweep(false);

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'system',
      action: 'reminder_sweep_cron',
      metadata: {
        scannedCount: result.scannedCount,
        eligibleEnvelopeCount: result.eligibleEnvelopeCount,
        remindersSent: result.remindersSent,
        smsRemindersSent: result.smsRemindersSent,
        errorCount: result.errors.length,
        durationMs: result.durationMs,
      },
    });

    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('CRON reminder sweep error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'CRON reminder sweep failed' }, 500);
  }
});

/**
 * POST /maintenance/bulk-remind
 * Send reminders to pending signers across multiple envelopes (admin only)
 */
esignRoutes.post('/maintenance/bulk-remind', rateLimit('SENDER_BULK'), async (c) => {
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
esignRoutes.post('/maintenance/bulk-void', rateLimit('SENDER_BULK'), async (c) => {
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
      item && typeof item === 'object' && !Array.isArray(item) && item.id && item.status &&
      // P6.8 — soft-deleted envelopes don't take part in verify-hash
      // lookups. The document still exists in storage but is logically
      // gone from the user's perspective.
      !item.deleted_at
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

    // P6.9 — enforce firm scope on every read of the aggregate
    // envelope list. `belongsToFirm` treats records without a
    // `firm_id` (or with `firm_id === 'standalone'`) as accessible
    // to everyone, which keeps the single-firm install working.
    const scoped = (envelopes as Array<Record<string, unknown>>).filter((e) =>
      belongsToFirm(ctx.user, { firm_id: (e.firm_id as string | undefined) ?? null }),
    );

    return c.json({ envelopes: scoped });
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
esignRoutes.post('/envelopes/upload', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
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
    const {
      clientId,
      adviceCaseId,
      requestId,
      productId,
      title,
      message,
      expiryDays,
      // P4.1 / P4.2 — when uploading from the express wizard the
      // template id + version are forwarded so the envelope record
      // pins the exact snapshot it was materialised from.
      templateId,
      templateVersion,
      // P4.7 / P4.8 — bulk-send and packet provenance (ignored when
      // not present; populated by the campaign worker / packet runner).
      campaignId,
      packetRunId,
      packetStepIndex,
    } = context;

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

    // Generate IDs. New e-sign records must live in the authenticated
    // sender's firm scope or the dashboard history list will immediately
    // filter them back out as "not mine".
    const documentId = crypto.randomUUID();
    const firmId = resolveFirmId(user);

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
      templateId,
      templateVersion,
      campaignId,
      packetRunId,
      packetStepIndex,
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

    // ── Phase 3.1 + 3.2 — surface field-placement suggestions ──
    // Best-effort: never block upload on analysis failure. The studio shows
    // these as opt-in suggestions ("From PDF form" / "Smart anchor") that
    // the sender can accept individually or via "Accept all".
    let fieldCandidates: Awaited<ReturnType<typeof analyzeUploadedPdf>>['candidates'] = [];
    try {
      const analysis = await analyzeUploadedPdf(finalFileBuffer);
      fieldCandidates = analysis.candidates;
      log.info(
        `Upload analysis: ${fieldCandidates.length} candidate(s) in ${analysis.durationMs}ms (ok=${analysis.ok})`,
      );
    } catch (analysisErr) {
      log.warn('PDF analysis threw (non-fatal):', analysisErr);
    }

    return c.json({
      envelope: {
        ...envelope,
        document: {
          ...envelope.document,
          url: documentUrl,
        },
      },
      // Frontend studio reads `field_candidates` and offers "Accept" /
      // "Accept all" / "Dismiss" actions per candidate. Empty list = no
      // suggestions; the studio still works as before.
      field_candidates: fieldCandidates,
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

    // P6.9 — firm scope. Return 404 rather than 403 on mismatch so
    // cross-firm probing can't distinguish "not mine" from "doesn't
    // exist".
    if (!belongsToFirm(ctx.user, { firm_id: (envelope.firm_id as string | undefined) ?? null })) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // P6.8 — soft-deleted envelopes are invisible to normal detail
    // reads. Recovery-bin UI uses the dedicated `/recovery-bin` route.
    if ((envelope as { deleted_at?: string }).deleted_at) {
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
 * PATCH /envelopes/:envelopeId/draft-settings
 *
 * Allow the sender to edit envelope-level metadata (title, message, expiry,
 * signing mode) on a *draft* envelope from inside the prepare studio. We
 * deliberately do NOT allow editing these fields once the envelope is sent
 * because the audit trail and signer notifications already reference them —
 * mutating after-the-fact would create a confusing trail.
 *
 * All fields are optional in the body; only provided keys are written. This
 * keeps the surface flexible for the studio's settings popover and any
 * future quick-edit UIs.
 */
esignRoutes.patch('/envelopes/:envelopeId/draft-settings', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Can only update settings on draft envelopes' }, 400);
    }

    const updates: Record<string, unknown> = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    if (typeof body.title === 'string') {
      const trimmed = body.title.trim();
      if (trimmed.length < 3 || trimmed.length > 200) {
        return c.json({ error: 'Title must be between 3 and 200 characters' }, 400);
      }
      if (trimmed !== envelope.title) {
        changed.title = { from: envelope.title, to: trimmed };
        updates.title = trimmed;
      }
    }

    if (typeof body.message === 'string' || body.message === null) {
      const next = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : null;
      if (next !== (envelope.message ?? null)) {
        changed.message = { from: envelope.message ?? null, to: next };
        updates.message = next;
      }
    }

    // Accept either an absolute ISO `expires_at` or a relative `expiryDays`
    // (number of days from "now"). The studio uses the relative form.
    let nextExpiresAt: string | null | undefined;
    if (typeof body.expires_at === 'string') {
      const dt = new Date(body.expires_at);
      if (Number.isNaN(dt.getTime())) {
        return c.json({ error: 'Invalid expires_at' }, 400);
      }
      nextExpiresAt = dt.toISOString();
    } else if (body.expires_at === null) {
      nextExpiresAt = null;
    } else if (typeof body.expiryDays === 'number' && Number.isFinite(body.expiryDays)) {
      const days = Math.max(1, Math.min(365, Math.floor(body.expiryDays)));
      nextExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    if (nextExpiresAt !== undefined && nextExpiresAt !== (envelope.expires_at ?? null)) {
      changed.expires_at = { from: envelope.expires_at ?? null, to: nextExpiresAt };
      updates.expires_at = nextExpiresAt;
    }

    if (typeof body.signing_mode === 'string' && ['sequential', 'parallel'].includes(body.signing_mode)) {
      if (body.signing_mode !== envelope.signing_mode) {
        changed.signing_mode = { from: envelope.signing_mode ?? 'sequential', to: body.signing_mode };
        updates.signing_mode = body.signing_mode;
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ success: true, changed: {}, envelope });
    }

    const updated = {
      ...envelope,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await kv.set(EsignKeys.envelope(envelopeId), updated);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'draft_settings_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: { changed },
    });

    return c.json({ success: true, changed, envelope: updated });
  } catch (error: unknown) {
    log.error('Update draft settings error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update draft settings' }, status);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.3 — Page transformation manifest routes
// ─────────────────────────────────────────────────────────────────────────────
//
// The studio lets the sender reorder, delete, and rotate pages of the
// uploaded PDF *before* sending. We never mutate the original — that would
// break the audit chain — so we persist a manifest describing the desired
// output. Materialisation happens at send-time (see /invites handler) but
// can also be triggered ad-hoc for preview via /materialize-preview.
//
// GET    /envelopes/:envelopeId/manifest          — fetch current manifest
// PUT    /envelopes/:envelopeId/manifest          — save / replace manifest
// DELETE /envelopes/:envelopeId/manifest          — clear manifest (revert to original)
// POST   /envelopes/:envelopeId/materialize-preview — produce a transient preview PDF

esignRoutes.get('/envelopes/:envelopeId/manifest', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const manifest = await kv.get(EsignKeys.envelopeManifest(envelopeId));
    return c.json({ manifest: manifest ?? null });
  } catch (err) {
    log.error('Get manifest error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json({ error: err instanceof Error ? err.message : 'Failed to load manifest' }, status);
  }
});

esignRoutes.put(
  '/envelopes/:envelopeId/manifest',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId');
      const envelope = await kv.get(EsignKeys.envelope(envelopeId));
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
      if (envelope.status !== 'draft') {
        return c.json({ error: 'Page edits only allowed while envelope is a draft' }, 409);
      }

      const body = await c.req.json();
      const manifest = body?.manifest;

      // Look up the source page count so we can validate without opening
      // the PDF (cheap pre-flight; full validation runs on materialise).
      const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
      const sourcePageCount: number = document?.page_count ?? 0;
      if (sourcePageCount <= 0) {
        return c.json({ error: 'Source document missing or has no pages' }, 409);
      }

      const validationErr = validateManifest(manifest, sourcePageCount);
      if (validationErr) return c.json({ error: validationErr }, 400);

      await kv.set(EsignKeys.envelopeManifest(envelopeId), manifest);

      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'page_manifest_updated',
        email: ctx.user.email,
        ip,
        userAgent,
        metadata: { pageCount: manifest.pages.length, sourcePageCount },
      });

      return c.json({ success: true, manifest });
    } catch (err) {
      log.error('Save manifest error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return c.json({ error: err instanceof Error ? err.message : 'Failed to save manifest' }, status);
    }
  },
);

esignRoutes.delete('/envelopes/:envelopeId/manifest', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    await kv.del(EsignKeys.envelopeManifest(envelopeId));
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'page_manifest_cleared',
      email: ctx.user.email,
      ip,
      userAgent,
      metadata: {},
    });
    return c.json({ success: true });
  } catch (err) {
    log.error('Clear manifest error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json({ error: err instanceof Error ? err.message : 'Failed to clear manifest' }, status);
  }
});

/**
 * POST /envelopes/:envelopeId/materialize-preview
 *
 * Apply the current manifest (or one supplied in the request body) to the
 * source PDF and return a short-lived signed URL to the materialised
 * output. Used by the studio to preview reordered/rotated pages without
 * persisting the result. The preview file is uploaded to the storage
 * bucket under a `previews/` prefix with a 15-minute TTL.
 *
 * Rate-limited under SENDER_MUTATE because rendering 1k-page PDFs is
 * server-CPU heavy.
 */
esignRoutes.post(
  '/envelopes/:envelopeId/materialize-preview',
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId');
      const envelope = await kv.get(EsignKeys.envelope(envelopeId));
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

      const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
      if (!document) return c.json({ error: 'Source document missing' }, 404);

      // Allow callers to override the saved manifest with one in the body —
      // this lets the studio preview unsaved edits.
      const body = await c.req.json().catch(() => ({}));
      const manifest =
        body?.manifest ?? (await kv.get(EsignKeys.envelopeManifest(envelopeId)));
      if (!manifest) return c.json({ error: 'No manifest to materialise' }, 400);

      const validationErr = validateManifest(manifest, document.page_count);
      if (validationErr) return c.json({ error: validationErr }, 400);

      // Pull the source PDF from storage.
      const sourceBuffer = await downloadDocument(document.storage_path);
      if (!sourceBuffer) return c.json({ error: 'Failed to download source PDF' }, 500);

      const result = await applyManifest(sourceBuffer, manifest);
      const previewPath = `previews/${envelopeId}/${Date.now()}.pdf`;
      const { error: uploadErr } = await uploadDocument(
        envelope.firm_id,
        envelopeId,
        result.pdfBuffer,
        previewPath,
        'application/pdf',
      );
      if (uploadErr) return c.json({ error: uploadErr }, 500);

      const url = await getDocumentUrl(previewPath);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'page_manifest_previewed',
        email: ctx.user.email,
        metadata: { pageCount: result.pageCount },
      });
      return c.json({ url, pageCount: result.pageCount, pageMap: result.pageMap });
    } catch (err) {
      log.error('Materialize preview error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return c.json(
        { error: err instanceof Error ? err.message : 'Failed to materialise preview' },
        status,
      );
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// P3.4 — Multi-document envelope routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /envelopes/:envelopeId/documents
 *
 * Returns the ordered list of documents in an envelope. The studio's
 * tab-bar uses this to render the document switcher; the response
 * synthesises a single-doc list for legacy envelopes so consumers
 * never have to special-case "old data".
 */
esignRoutes.get('/envelopes/:envelopeId/documents', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as
      | EsignEnvelope
      | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    const documents = await getEnvelopeDocuments(envelope);
    // Hydrate each ref with a presigned URL so the studio can render
    // any of the documents without an extra round-trip.
    const hydrated = await Promise.all(
      documents.map(async (d) => ({
        ...d,
        url: await getDocumentUrl(d.storage_path),
      })),
    );
    return c.json({ documents: hydrated });
  } catch (err) {
    log.error('List envelope documents error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to list documents' },
      status,
    );
  }
});

/**
 * POST /envelopes/:envelopeId/documents
 *
 * Append a new document to an existing envelope. Mirrors the upload
 * route's validation and storage pipeline but skips envelope creation.
 */
esignRoutes.post(
  '/envelopes/:envelopeId/documents',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId');
      const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as
        | EsignEnvelope
        | null;
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
      if (envelope.status !== 'draft') {
        return c.json(
          { error: 'Documents can only be added to envelopes in draft status' },
          409,
        );
      }
      await ensureStorageBuckets();
      const body = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
      const file = body['file'];
      if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateDocument(buffer, file.name);
      if (!validation.valid) return c.json({ error: validation.error }, 400);

      const documentId = crypto.randomUUID();
      const hash = await calculateHash(buffer);
      const pageCount = extractPageCount(buffer);
      const { path, error: uploadErr } = await uploadDocument(
        envelope.firm_id,
        documentId,
        buffer,
        file.name,
        'application/pdf',
      );
      if (uploadErr || !path) return c.json({ error: uploadErr ?? 'Upload failed' }, 500);

      await createDocument({
        id: documentId,
        firm_id: envelope.firm_id,
        storage_path: path,
        original_filename: file.name,
        page_count: pageCount,
        hash,
        created_at: new Date().toISOString(),
      });

      const displayName =
        typeof body['display_name'] === 'string' && (body['display_name'] as string).trim()
          ? (body['display_name'] as string).trim()
          : file.name.replace(/\.pdf$/i, '');

      const documents = await appendEnvelopeDocument(
        envelopeId,
        {
          document_id: documentId,
          display_name: displayName,
          original_filename: file.name,
          page_count: pageCount,
          storage_path: path,
        },
        ctx.user.id,
      );

      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'document_added',
        ip,
        userAgent,
        email: ctx.user.email,
        metadata: { documentId, filename: file.name, pageCount, hash },
      });

      const hydrated = await Promise.all(
        documents.map(async (d) => ({ ...d, url: await getDocumentUrl(d.storage_path) })),
      );
      return c.json({ documents: hydrated, added: { document_id: documentId, page_count: pageCount } });
    } catch (err) {
      log.error('Add envelope document error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return c.json(
        { error: err instanceof Error ? err.message : 'Failed to add document' },
        status,
      );
    }
  },
);

/**
 * DELETE /envelopes/:envelopeId/documents/:documentId
 *
 * Remove a document from a draft envelope. Refuses to remove the last
 * document (every envelope must have at least one).
 */
esignRoutes.delete('/envelopes/:envelopeId/documents/:documentId', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const documentId = c.req.param('documentId');
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as
      | EsignEnvelope
      | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.status !== 'draft') {
      return c.json(
        { error: 'Documents can only be removed from envelopes in draft status' },
        409,
      );
    }
    const documents = await removeEnvelopeDocument(envelopeId, documentId);
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'document_removed',
      ip,
      userAgent,
      email: ctx.user.email,
      metadata: { documentId },
    });
    return c.json({ documents });
  } catch (err) {
    log.error('Remove envelope document error:', err);
    const status = err instanceof AuthError
      ? err.statusCode
      : err instanceof Error && /last document/i.test(err.message)
        ? 409
        : 500;
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to remove document' },
      status,
    );
  }
});

/**
 * PUT /envelopes/:envelopeId/documents/order
 *
 * Reorder an envelope's documents. Body: `{ order: string[] }` where
 * each entry is a document_id. Unknown ids are ignored; missing ids
 * are appended to the end so a stale client cannot accidentally drop
 * documents.
 */
esignRoutes.put('/envelopes/:envelopeId/documents/order', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as
      | EsignEnvelope
      | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.status !== 'draft') {
      return c.json(
        { error: 'Document order can only be changed on draft envelopes' },
        409,
      );
    }
    const body = await c.req.json().catch(() => ({}));
    const orderedIds: unknown = body?.order;
    if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== 'string')) {
      return c.json({ error: 'order must be an array of document_id strings' }, 400);
    }
    const documents = await reorderEnvelopeDocuments(envelopeId, orderedIds as string[]);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'documents_reordered',
      email: ctx.user.email,
      metadata: { order: documents.map((d) => d.document_id) },
    });
    return c.json({ documents });
  } catch (err) {
    log.error('Reorder envelope documents error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to reorder documents' },
      status,
    );
  }
});

/**
 * POST /envelopes/:envelopeId/invites
 * Send signing invitations to signers
 */
esignRoutes.post('/envelopes/:envelopeId/invites', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
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
        // P2.5 2.8 — pass through kind ('signer' | 'witness' | 'cc') so the
        // audit trail tags witness attestations distinctly. Defaults to
        // 'signer' inside addSignersToEnvelope when undefined.
        kind: (s as { kind?: 'signer' | 'witness' | 'cc' }).kind,
        requiresOtp: s.requiresOtp !== false,
        accessCode: s.accessCode,
        clientId: s.clientId,
        // P5.1 — propagate SMS opt-in; only honoured on the server when a
        // phone number is also present (see addSignersToEnvelope).
        smsOptIn: (s as { smsOptIn?: boolean }).smsOptIn === true,
      }))
    );

    if (signerError) {
      return c.json({ error: signerError }, 500);
    }

    // ── P3.3 + P3.4 — Materialise envelope at send-time ──
    // Two paths converge here:
    //   • Multi-document envelopes (P3.4): concatenate every document
    //     in order, applying any per-document page manifest along the
    //     way. Field (document_id, page) tuples are remapped onto the
    //     concatenated page index.
    //   • Single-document envelopes: honour the legacy envelope-level
    //     manifest exactly as before so existing drafts keep working.
    //
    // Both branches replace the document the signer sees with a
    // materialised PDF; the originals stay on disk for the audit trail.
    let materialisedFields: FieldRecord[] = Array.isArray(fields) ? fields : [];
    const fullEnvelopeRecord = (await kv.get(EsignKeys.envelope(envelopeId))) as
      | EsignEnvelope
      | null;
    const envelopeDocs = fullEnvelopeRecord
      ? await getEnvelopeDocuments(fullEnvelopeRecord)
      : [];
    if (envelopeDocs.length > 1) {
      try {
        const result = await materialiseEnvelope(envelopeId);
        const { remapped, dropped } = remapFieldsForConcatenation(
          materialisedFields as EsignField[],
          result.pageMap,
          envelope.document_id,
        );
        materialisedFields = remapped as FieldRecord[];
        await logAuditEvent({
          envelopeId,
          actorType: 'system',
          action: 'envelope_materialised',
          metadata: {
            documentCount: envelopeDocs.length,
            totalPageCount: result.totalPageCount,
            droppedFields: dropped.length,
            perDocumentPageCounts: result.perDocumentPageCounts,
          },
        });
      } catch (matErr) {
        log.warn(
          `Multi-doc materialisation failed (sending primary only): ${matErr instanceof Error ? matErr.message : String(matErr)}`,
        );
      }
    } else {
      try {
      const manifest = await kv.get(EsignKeys.envelopeManifest(envelopeId));
      if (manifest && envelope?.document?.storage_path) {
        const sourceBuffer = await downloadDocument(envelope.document.storage_path);
        if (sourceBuffer) {
          const result = await applyManifest(sourceBuffer, manifest);
          // Upload the materialised PDF under a deterministic path so we
          // can look it up at certificate-generation time.
          const materialisedPath = `materialised/${envelope.document_id}/signing.pdf`;
          await uploadDocument(
            envelope.firm_id ?? 'standalone',
            envelope.document_id,
            result.pdfBuffer,
            materialisedPath,
            'application/pdf',
          );
          // Update document record: storage_path now points at the
          // materialised file; original_storage_path keeps the original
          // pointer for audit. page_count reflects the new doc.
          const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
          if (document) {
            await kv.set(EsignKeys.PREFIX_DOCUMENT + envelope.document_id, {
              ...document,
              original_storage_path: document.original_storage_path ?? document.storage_path,
              storage_path: materialisedPath,
              page_count: result.pageCount,
              hash: await calculateHash(result.pdfBuffer),
              materialised_at: new Date().toISOString(),
            });
          }
          // Remap supplied fields to the new page numbering. Drop fields
          // whose source page was deleted — they have no destination.
          if (materialisedFields.length > 0) {
            materialisedFields = materialisedFields
              .map((f) => {
                const oldPage = (f as { page?: number }).page;
                if (!oldPage) return f;
                const newPage = result.pageMap[oldPage];
                if (newPage == null) return null;
                return { ...f, page: newPage };
              })
              .filter((f): f is FieldRecord => f !== null);
          }
          await logAuditEvent({
            envelopeId,
            actorType: 'system',
            action: 'page_manifest_materialised',
            metadata: {
              originalPageCount: envelope.document.page_count,
              materialisedPageCount: result.pageCount,
              droppedFields: (Array.isArray(fields) ? fields.length : 0) - materialisedFields.length,
            },
          });
        }
      }
      } catch (matErr) {
        // Manifest application failure must not block sending — fall back
        // to the original document. The sender's intent (re-ordered pages)
        // is lost but the envelope is still sendable.
        log.warn(`Manifest materialisation failed (sending original): ${matErr instanceof Error ? matErr.message : String(matErr)}`);
      }
    }

    // Add fields if provided
    if (materialisedFields.length > 0) {
      // First, clear any existing fields (e.g. from draft saves) to avoid duplicates
      // and ensure we have clean fields with correct signer IDs
      await kv.del(EsignKeys.envelopeFields(envelopeId));
      
      // Map signer indices to actual signer IDs
      const fieldsWithSignerIds = materialisedFields.map((field: FieldRecord) => ({
        ...field,
        signerId: signerIds[field.signerIndex as number] || signerIds[0],
      }));

      await addFieldsToEnvelope(envelopeId, fieldsWithSignerIds);

      // ── P3.6 — Resolve CRM prefill bindings ──
      // For each signer, find their fields and stamp resolved values from
      // the CRM (`client.*` tokens) and envelope context (`envelope.*`).
      // Best-effort: missing bindings yield empty values which the signer
      // can fill in by hand. We deliberately do this AFTER persistence so
      // the resolved values are visible on the existing reads path.
      try {
        const allSigners = await getEnvelopeSigners(envelopeId);
        const allFields: EsignField[] = (await kv.get(EsignKeys.envelopeFields(envelopeId))) ?? [];
        let totalResolved = 0;
        for (const s of allSigners) {
          const ownFields = allFields.filter((f) => f.signer_id === s.id);
          if (ownFields.length === 0) continue;
          const resolved = await resolvePrefilledFields(ownFields, {
            signer: s as EsignSigner,
            envelope: {
              advice_case_id: envelope.advice_case_id,
              product_id: envelope.product_id,
              request_id: envelope.request_id,
            },
          });
          totalResolved += resolved;
        }
        if (totalResolved > 0) {
          // Persist back the mutated fields list (resolvePrefilledFields
          // mutates in place, but we need the storage to reflect the new
          // values).
          await kv.set(EsignKeys.envelopeFields(envelopeId), allFields);
          await logAuditEvent({
            envelopeId,
            actorType: 'system',
            action: 'prefill_resolved',
            metadata: { resolvedFieldCount: totalResolved },
          });
        }
      } catch (prefillErr) {
        // Non-blocking — see esign-prefill.ts contract notes.
        log.warn(`Prefill resolution failed: ${prefillErr instanceof Error ? prefillErr.message : String(prefillErr)}`);
      }
    }

    // P6.4 — pin the ECTA consent version in effect at send-time, if one
    // wasn't already stamped at create-time. This keeps the evidence
    // trail stable even if a legal revision to the consent text is
    // published while the envelope is in flight.
    const pinnedConsent = (envelope.consent_version as string | undefined)
      ?? (await getActiveConsent()).id;

    // Update envelope status and persist signing mode + consent pin
    await updateEnvelopeStatus(envelopeId, 'sent', {
      sent_at: new Date().toISOString(),
      signing_mode: effectiveMode,
      consent_version: pinnedConsent,
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
      const signingUrl = `https://www.navigatewealth.co/sign?token=${targetSigner.access_token}`;

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

      // P5.1 — parallel SMS delivery (opt-in only; best-effort, never
      // blocks email). We don't fail the invite if SMS bounces — email
      // is still the legally defensible channel.
      if (targetSigner.sms_opt_in && targetSigner.phone) {
        try {
          const smsResult = await sendInviteSms({
            to: targetSigner.phone,
            signerName: targetSigner.name,
            envelopeTitle: envelope.title,
            signingUrl: signingUrl,
          });
          if (smsResult.delivered) {
            await logAuditEvent({
              envelopeId,
              actorType: 'system',
              action: 'invite_sms_sent',
              email: targetSigner.email,
              phone: targetSigner.phone,
              ip,
              userAgent,
              metadata: {
                signerId: targetSigner.id,
                provider: smsResult.provider,
                messageId: smsResult.messageId,
              },
            });
          }
        } catch (smsErr) {
          log.warn(`SMS invite failed for signer ${targetSigner.id}: ${getErrMsg(smsErr)}`);
        }
      }
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

    // P6.9 — a client can legitimately span firms on a multi-tenant
    // install, but the caller should only ever see envelopes that
    // belong to their firm (or standalone envelopes).
    const scoped = (envelopes as Array<Record<string, unknown>>).filter((e) =>
      belongsToFirm(ctx.user, { firm_id: (e.firm_id as string | undefined) ?? null }),
    );

    return c.json({ envelopes: scoped });
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
esignRoutes.post('/envelopes/:envelopeId/signers/:signerId/otp/send', rateLimit('OTP_SEND'), async (c) => {
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
      metadata: { signerId, channel: 'email' },
    });

    // P5.1 — parallel OTP delivery via SMS (opt-in + phone required).
    // Email remains the primary channel so the audit trail always shows
    // an `otp_sent` event even when SMS is offline.
    let smsChannel: { delivered: boolean; provider: string } | null = null;
    if (signer.sms_opt_in && signer.phone) {
      try {
        const envelope = await getEnvelopeDetails(envelopeId);
        const smsResult = await sendOtpSms({
          to: signer.phone,
          otp,
          envelopeTitle: envelope?.title,
        });
        smsChannel = { delivered: smsResult.delivered, provider: smsResult.provider };
        if (smsResult.delivered) {
          await logAuditEvent({
            envelopeId,
            actorType: 'system',
            action: 'otp_sent',
            email: signer.email,
            phone: signer.phone,
            ip,
            userAgent,
            metadata: {
              signerId,
              channel: 'sms',
              provider: smsResult.provider,
              messageId: smsResult.messageId,
            },
          });
        }
      } catch (smsErr) {
        log.warn(`SMS OTP failed for signer ${signerId}: ${getErrMsg(smsErr)}`);
      }
    }

    return c.json({
      success: true,
      channels: { email: true, sms: smsChannel?.delivered ?? false },
    });
  } catch (error: unknown) {
    log.error('❌ Send OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send OTP' }, 500);
  }
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/verify
 * Verify OTP and access code
 */
esignRoutes.post('/envelopes/:envelopeId/signers/:signerId/verify', rateLimit('OTP_VERIFY'), async (c) => {
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
      actorType: audActor(signer),
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
esignRoutes.post('/envelopes/:envelopeId/sign', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
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
      actorType: audActor(signer),
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
      // P7.5 — enqueue the expensive completion workflow (burn-in +
      // certificate + seal + upload) for the background drainer. The
      // signer request returns in < 1s even for large PDFs; the UI
      // observes a `completing` envelope until the drainer finishes.
      await enqueueCompletion(envelopeId);

      await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'envelope_completion_queued',
        ip,
        userAgent,
        metadata: { allSignersCompleted: true, queued: true },
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
            const signingUrl = `https://www.navigatewealth.co/sign?token=${nextSigner.access_token}`;

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
      actorType: audActor(signer),
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

    // P6.4 — resolve the consent text the signer should see. Envelopes
    // created after P6 have `consent_version` pinned at send-time; for
    // anything legacy we fall back to the currently active version.
    const consent = await getConsentByVersion(envelope.consent_version as string | undefined);

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
        // P6.4 / P6.5 / P6.6 — surface the evidence-grade envelope
        // settings the signer must acknowledge.
        consent: { id: consent.id, text: consent.text },
        signing_reason_required: !!envelope.signing_reason_required,
        signing_reason_prompt: envelope.signing_reason_prompt ?? null,
        kba_required: !!envelope.kba_required,
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        status: signer.status,
        requires_otp: signer.requires_otp,
        otp_verified: signer.otp_verified,
        kba_status: signer.kba?.status ?? null,
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
esignRoutes.post('/signer/validate', rateLimit('SIGNER_ACCESS'), async (c) => {
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

    // ── Look up the signer's saved signature profile (Phase 1 — signature reuse).
    // Keyed by lowercased email so a returning signer sees their adopted
    // signature pre-loaded across envelopes, no matter which firm sent it.
    let savedSignature: string | null = null;
    let savedInitials: string | null = null;
    try {
      const profileKey = `esign:signer-profile:${(signer.email || '').toLowerCase().trim()}`;
      const profile = await kv.get(profileKey) as { signature?: string; initials?: string } | null;
      if (profile && typeof profile === 'object') {
        savedSignature = typeof profile.signature === 'string' ? profile.signature : null;
        savedInitials = typeof profile.initials === 'string' ? profile.initials : null;
      }
    } catch (profileErr) {
      log.warn('Failed to load signer profile (non-critical):', profileErr);
    }

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

    // P8.6 — Pull firm branding (logo + accent colour) so the signer
    // page can theme without an extra round-trip. Best-effort: any
    // failure leaves branding null and the signer falls back to the
    // built-in defaults baked into the React client.
    let branding: ReturnType<typeof toPublicBranding> = null;
    try {
      const firmId = (envelope as { firm_id?: string }).firm_id;
      if (firmId) {
        const record = await getFirmBranding(firmId);
        branding = toPublicBranding(record);
      }
    } catch (brandErr) {
      log.warn('Failed to load firm branding for signer (non-critical):', brandErr);
    }

    // P8.7 — Surface the signer's preferred language so the UI can
    // hydrate translations on first paint without a separate fetch.
    // Defaults to English when not set.
    const signerLanguage = ((signer as { language?: string }).language || 'en')
      .toLowerCase()
      .slice(0, 5);

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
      signer_language: signerLanguage,
      otp_required: signer.requires_otp,
      otp_verified: signer.otp_verified,
      access_code_required: !!signer.access_code,
      is_turn: isTurn,
      all_signers: signersSummary,
      fields: signerFields,
      saved_signature: savedSignature,
      saved_initials: savedInitials,
      branding,
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
esignRoutes.post('/signer/verify-otp', rateLimit('OTP_VERIFY'), async (c) => {
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
      actorType: audActor(signer),
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
esignRoutes.post('/signer/resend-otp', rateLimit('OTP_SEND'), async (c) => {
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
      metadata: { signerId: signer.id, channel: 'email' },
    });

    // P5.1 — mirror OTP via SMS for opted-in signers.
    let smsDelivered = false;
    if (signer.sms_opt_in && signer.phone) {
      try {
        const smsResult = await sendOtpSms({
          to: signer.phone,
          otp,
          envelopeTitle,
        });
        smsDelivered = smsResult.delivered;
        if (smsResult.delivered) {
          await logAuditEvent({
            envelopeId: signer.envelope_id,
            actorType: 'system',
            action: 'otp_resent',
            email: signer.email,
            phone: signer.phone,
            ip,
            userAgent,
            metadata: {
              signerId: signer.id,
              channel: 'sms',
              provider: smsResult.provider,
              messageId: smsResult.messageId,
            },
          });
        }
      } catch (smsErr) {
        log.warn(`SMS OTP resend failed for signer ${signer.id}: ${getErrMsg(smsErr)}`);
      }
    }

    return c.json({ 
      success: true, 
      message: 'OTP sent successfully',
      channels: { email: true, sms: smsDelivered },
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
esignRoutes.post('/signer/submit', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.json();
    const {
      access_token,
      signature_data,
      field_values,
      // P6.3/6.4/6.5 — evidence payload captured client-side and stamped
      // onto the signer record for the completion certificate.
      consent_version,
      consent_accepted_at,
      signing_reason,
      signature_telemetry,
    } = body;

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

    // P6.6 — if the envelope requires KBA, the check must have been
    // completed before submit. We surface a soft error so the client
    // can route the signer through the KBA step.
    try {
      const envelopeForKba = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForKba?.kba_required && signer.kba?.status !== 'passed') {
        return c.json({ error: 'Identity verification (KBA) is required before signing' }, 403);
      }
    } catch (kbaErr) {
      log.warn('KBA gate check failed; allowing submit:', kbaErr);
    }

    // Update field values
    if (field_values && Array.isArray(field_values)) {
      for (const fv of field_values) {
        if (fv.field_id && fv.value !== undefined) {
          await updateFieldValue(fv.field_id, fv.value);
        }
      }
    }

    // Update signer status + P6 evidence stamps
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signer.id, 'signed', {
      signed_at: new Date().toISOString(),
      signature_data,
      ip_address: ip,
      user_agent: userAgent,
      consent_version: typeof consent_version === 'string' ? consent_version : undefined,
      consent_accepted_at: typeof consent_accepted_at === 'string' ? consent_accepted_at : new Date().toISOString(),
      signing_reason: typeof signing_reason === 'string' ? signing_reason.trim() || undefined : undefined,
      signature_telemetry: signature_telemetry && typeof signature_telemetry === 'object' ? signature_telemetry : undefined,
    });

    // P5.6 — single-use semantics: once a signer has successfully submitted,
    // rotate their access token so the original invite link cannot be
    // replayed to re-open the signing UI. The fresh token is indexed but
    // not communicated anywhere, effectively burning the URL.
    try { await rotateSignerToken(signer.id, 'post_submit'); } catch { /* best-effort */ }

    // Log audit event
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
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
      // P7.5 — enqueue the expensive completion workflow (burn-in +
      // certificate + seal + upload) for the background drainer. The
      // signer request returns immediately; the UI observes a
      // `completing` envelope until the drainer finishes.
      await enqueueCompletion(signer.envelope_id);

      await logAuditEvent({
        envelopeId: signer.envelope_id,
        actorType: 'system',
        action: 'envelope_completion_queued',
        ip,
        userAgent,
        metadata: { allSignersCompleted: true, queued: true },
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
            const signingUrl = `https://www.navigatewealth.co/sign?token=${nextSigner.access_token}`;

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

      // Notify sender (admin) of per-signer progress — respects P5.2
      // per-user notification prefs. If mode is `completion_only` or `off`
      // we skip the email entirely; if `digest` we enqueue it for the
      // nightly tick rather than blasting every signer event to inbox.
      try {
        if (envelopeForProgress?.created_by_user_id) {
          const { data: senderUser } = await getSupabase().auth.admin.getUserById(envelopeForProgress.created_by_user_id);
          const senderEmail = senderUser?.user?.email;

          if (senderEmail) {
            const decision = await shouldDeliverSenderEvent(
              envelopeForProgress.created_by_user_id,
              'signer.signed' as SenderEvent,
            );
            const progressSubject = `Progress: ${signer.name} signed "${envelopeForProgress.title}" (${signedCount}/${totalSigners})`;
            const progressText = `${signer.name} has signed "${envelopeForProgress.title}". Progress: ${signedCount} of ${totalSigners} signers completed.`;
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

            if (decision.deliver) {
              await sendEmail({
                to: senderEmail,
                subject: progressSubject,
                html: progressHtml,
                text: progressText,
              });
            } else if (decision.digest) {
              await queueForDigest({
                userId: envelopeForProgress.created_by_user_id,
                event: 'signer.signed',
                envelopeId: envelopeForProgress.id,
                envelopeTitle: envelopeForProgress.title,
                subject: progressSubject,
                body: progressText,
              });
            }

            // P5.7 — bell-UI copy. Always emitted regardless of email
            // preferences so senders retain an in-product log of activity.
            void enqueueInAppNotification({
              userId: envelopeForProgress.created_by_user_id,
              type: 'signer.signed',
              title: `${signer.name} signed`,
              body: `${signer.name} signed "${envelopeForProgress.title}" (${signedCount}/${totalSigners}).`,
              envelopeId: envelopeForProgress.id,
              signerId: signer.id,
              metadata: { signed_count: signedCount, total_signers: totalSigners },
            });
          }
        }
      } catch (progressEmailErr) {
        log.error('Failed to send progress notification to sender:', progressEmailErr);
        // Non-critical
      }

      // P5.4 — fan-out to firm webhooks. Fire-and-forget.
      if (envelopeForProgress) {
        void emitWebhookEvent({
          firmId: envelopeForProgress.firm_id || 'standalone',
          eventType: 'signer.signed',
          envelopeId: envelopeForProgress.id,
          payload: {
            signer: { id: signer.id, name: signer.name, email: signer.email, order: signer.order },
            envelope: { id: envelopeForProgress.id, title: envelopeForProgress.title, status: envelopeForProgress.status },
            progress: { signed_count: signedCount, total_signers: totalSigners, complete: isComplete },
          },
        });
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
esignRoutes.post('/signer/reject', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
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
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'declined',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, signerName: signer.name, reason },
    });

    log.info(`Signer ${signer.email} declined envelope ${signer.envelope_id}`);

    // Notify sender (admin) about the decline — respects P5.2 prefs.
    // Decline is a terminal event: even `completion_only` senders see it.
    // `off` still suppresses.
    try {
      const envelopeForNotify = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForNotify?.created_by_user_id) {
        const { data: senderUser } = await getSupabase().auth.admin.getUserById(envelopeForNotify.created_by_user_id);
        const senderEmail = senderUser?.user?.email;

        if (senderEmail) {
          const declineDecision = await shouldDeliverSenderEvent(
            envelopeForNotify.created_by_user_id,
            'signer.declined' as SenderEvent,
          );
          const declineSubject = `Declined: ${signer.name} declined to sign "${envelopeForNotify.title}"`;
          const declineText = `${signer.name} (${signer.email}) has declined to sign "${envelopeForNotify.title}". ${reason ? `Reason: ${reason}` : 'No reason provided.'}`;
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

          if (declineDecision.deliver) {
            await sendEmail({
              to: senderEmail,
              subject: declineSubject,
              html: declineHtml,
              text: declineText,
            });
            log.info(`Decline notification sent to sender ${senderEmail}`);
          } else if (declineDecision.digest) {
            await queueForDigest({
              userId: envelopeForNotify.created_by_user_id,
              event: 'signer.declined',
              envelopeId: envelopeForNotify.id,
              envelopeTitle: envelopeForNotify.title,
              subject: declineSubject,
              body: declineText,
            });
            log.info(`Decline queued for digest for ${senderEmail}`);
          } else {
            log.info(`Decline suppressed for sender ${senderEmail} (mode=${declineDecision.mode})`);
          }

          // P5.7 — bell-UI copy (always enqueue; bell stays truthful
          // regardless of email delivery preferences).
          void enqueueInAppNotification({
            userId: envelopeForNotify.created_by_user_id,
            type: 'envelope.declined',
            title: `${signer.name} declined`,
            body: `${signer.name} declined to sign "${envelopeForNotify.title}".${reason ? ` Reason: ${reason}` : ''}`,
            envelopeId: envelopeForNotify.id,
            signerId: signer.id,
            metadata: { reason: reason ?? null },
          });
        }
      }
    } catch (notifyErr) {
      log.error('Failed to send decline notification to sender:', notifyErr);
      // Non-critical: decline still succeeded
    }

    // P5.4 — webhook fan-out for decline.
    try {
      const envelopeForHook = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForHook) {
        void emitWebhookEvent({
          firmId: envelopeForHook.firm_id || 'standalone',
          eventType: 'signer.declined',
          envelopeId: envelopeForHook.id,
          payload: {
            signer: { id: signer.id, name: signer.name, email: signer.email },
            envelope: { id: envelopeForHook.id, title: envelopeForHook.title, status: 'declined' },
            reason: reason || null,
          },
        });
      }
    } catch (hookErr) {
      log.error('Failed to emit decline webhook:', hookErr);
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
 * POST /signer/saved-signature
 * Persist the signer's adopted signature/initials so it can be reused on
 * future envelopes addressed to the same email. Public endpoint — must
 * present a valid signing token, which scopes the operation to the email
 * the token was issued for. Either field is optional; only the provided
 * one(s) are written.
 */
esignRoutes.post('/signer/saved-signature', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    const signature = typeof body.signature === 'string' ? body.signature : null;
    const initials = typeof body.initials === 'string' ? body.initials : null;

    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }
    if (!signature && !initials) {
      return c.json({ error: 'signature or initials required' }, 400);
    }

    const { ip } = getRequestMetadata(c);
    const rateLimit = await checkRateLimit(ip, 'esign_saved_signature_save', {
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const email = (signer.email || '').toLowerCase().trim();
    if (!email) {
      return c.json({ error: 'Signer email missing' }, 400);
    }

    // Reject obviously oversized payloads (data URLs > ~512KB) to avoid KV bloat.
    const tooLarge = (s: string | null) => !!s && s.length > 600_000;
    if (tooLarge(signature) || tooLarge(initials)) {
      return c.json({ error: 'Signature image is too large. Please use a smaller image.' }, 413);
    }

    const profileKey = `esign:signer-profile:${email}`;
    const existing = (await kv.get(profileKey)) as { signature?: string; initials?: string } | null;
    const next = {
      signature: signature ?? existing?.signature ?? null,
      initials: initials ?? existing?.initials ?? null,
      updated_at: new Date().toISOString(),
    };
    await kv.set(profileKey, next);

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Save signer signature error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to save signature' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Envelope attachment listing (admin / sender)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /envelopes/:envelopeId/attachments
 *
 * Authenticated read of every attachment uploaded by every signer for an
 * envelope. Returns presigned URLs valid for 1h so the sender's UI can
 * download / preview without proxying through the worker.
 */
esignRoutes.get('/envelopes/:envelopeId/attachments', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const records = ((await kv.get(EsignKeys.envelopeAttachments(envelopeId))) as Array<Record<string, unknown>>) ?? [];
    const enriched = await Promise.all(
      records.map(async (r) => ({
        ...r,
        url: await getAttachmentUrl(String(r.storage_path ?? '')),
      })),
    );
    return c.json({ attachments: enriched });
  } catch (err) {
    log.error('List attachments error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json({ error: err instanceof Error ? err.message : 'Failed to list attachments' }, status);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Signer attachment upload (public, token-scoped)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /signer/attachment
 *
 * Public endpoint a signer hits when filling an `attachment`-type field.
 * Authenticated by `access_token` only — same trust model as
 * `/signer/submit`.
 *
 * Request: multipart/form-data with:
 *   access_token (string)
 *   field_id     (string) — the attachment field this upload satisfies
 *   file         (File)   — the actual upload (PDF / image, ≤25MB)
 *
 * Response: { attachmentId, path, filename, size, mimeType, fieldId }
 *
 * Side effects:
 *   - File is stored in the ATTACHMENTS bucket under
 *     `${envelopeId}/${attachmentId}-${filename}`.
 *   - An attachment record is appended to the envelope's attachments
 *     index (KV) so the certificate renderer can list everything later.
 *   - The field's `value` is set to `attachment:${attachmentId}` so the
 *     completeness check on submit treats the field as filled.
 *   - Audit event `attachment_uploaded` is logged.
 */
esignRoutes.post('/signer/attachment', rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    const accessToken = typeof body['access_token'] === 'string' ? (body['access_token'] as string) : '';
    const fieldId = typeof body['field_id'] === 'string' ? (body['field_id'] as string) : '';
    const file = body['file'];

    if (!accessToken) return c.json({ error: 'access_token required' }, 400);
    if (!fieldId) return c.json({ error: 'field_id required' }, 400);
    if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

    const signer = await getSignerByToken(accessToken);
    if (!signer) return c.json({ error: 'Invalid or expired access token' }, 404);
    if (signer.status === 'signed') return c.json({ error: 'Already signed' }, 409);

    // Confirm the field exists and is the attachment type assigned to this signer.
    const fields = ((await kv.get(EsignKeys.envelopeFields(signer.envelope_id))) as EsignField[]) ?? [];
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return c.json({ error: 'Field not found' }, 404);
    if (field.type !== 'attachment') return c.json({ error: 'Field is not an attachment field' }, 400);
    if (field.signer_id !== signer.id && field.signer_id !== signer.email) {
      return c.json({ error: 'Field is not assigned to this signer' }, 403);
    }

    await ensureStorageBuckets();

    const attachmentId = crypto.randomUUID();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { path, error: uploadErr } = await uploadAttachment(
      signer.envelope_id,
      attachmentId,
      file.name,
      buffer,
      file.type,
    );
    if (uploadErr || !path) return c.json({ error: uploadErr ?? 'Upload failed' }, 400);

    // Record attachment in the per-envelope index so the certificate
    // renderer can iterate over them.
    const indexKey = EsignKeys.envelopeAttachments(signer.envelope_id);
    const existing = ((await kv.get(indexKey)) as Array<Record<string, unknown>>) ?? [];
    const record = {
      id: attachmentId,
      envelope_id: signer.envelope_id,
      field_id: fieldId,
      signer_id: signer.id,
      signer_email: signer.email,
      filename: file.name,
      mime_type: file.type,
      size_bytes: buffer.length,
      storage_path: path,
      hash: await calculateHash(buffer),
      uploaded_at: new Date().toISOString(),
    };
    await kv.set(indexKey, [...existing, record]);

    // Stamp the field value so completeness checks pass.
    await updateFieldValue(fieldId, `attachment:${attachmentId}`);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'attachment_uploaded',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        fieldId,
        attachmentId,
        filename: record.filename,
        size: record.size_bytes,
        mimeType: record.mime_type,
      },
    });

    return c.json({
      success: true,
      attachmentId,
      path,
      filename: record.filename,
      size: record.size_bytes,
      mimeType: record.mime_type,
      fieldId,
    });
  } catch (err: unknown) {
    log.error('Attachment upload error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Attachment upload failed' }, 500);
  }
});

/**
 * POST /signer/pause
 * Record an audit-trail entry that the signer paused signing and intends
 * to return later. Does not change envelope or signer status — the link
 * remains valid until envelope expiry. Public endpoint, token-scoped.
 */
esignRoutes.post('/signer/pause', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const { ip, userAgent } = getRequestMetadata(c);
    const completedCount = Number.isFinite(body.completed_count as number) ? body.completed_count as number : undefined;
    const requiredCount = Number.isFinite(body.required_count as number) ? body.required_count as number : undefined;

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'paused',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        signerId: signer.id,
        signerName: signer.name,
        completedCount,
        requiredCount,
      },
    });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Signer pause error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to record pause' }, 500);
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

    // P6.8 — Soft-delete semantics.
    //
    // For draft/sent/viewed envelopes with no signatures yet, we now
    // soft-delete (stamp `deleted_at`) instead of hard-deleting. Admins
    // can list and restore envelopes via the recovery bin for 90 days;
    // the scheduler permanently purges anything older than that
    // retention window.
    //
    // Completed / partially_signed / voided envelopes are never
    // deletable via this route — use `void` or the recovery bin's
    // purge operation for those.
    if (envelope.deleted_at) {
      return c.json({ success: true, deleted: true, already: true });
    }

    const signers = await getEnvelopeSigners(envelopeId);
    const anyoneSigned = signers.some((s: SignerRecord) => s.status === 'signed');

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

    // P6.9 — firm scope check before any mutating action.
    const callerFirm = resolveFirmId(user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
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

      // P5.6 — rotate tokens on any pending signer so the old signing
      // links are inert even if the envelope is later restored and
      // resent (new tokens would be issued on resend).
      for (const s of signers) {
        try { await rotateSignerToken(s.id, 'soft_deleted'); } catch { /* best-effort */ }
      }
    }

    // ---- Soft-delete: stamp deleted_at on the envelope record ----
    const reason = c.req.query('reason') || 'Discarded by admin';
    const envRaw = await kv.get(EsignKeys.envelope(envelopeId));
    if (envRaw) {
      await kv.set(EsignKeys.envelope(envelopeId), {
        ...envRaw,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        delete_reason: reason,
        updated_at: new Date().toISOString(),
      });
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: user.id,
      action: 'soft_deleted',
      email: user.email || 'admin@system',
      ip,
      userAgent,
      metadata: {
        deletedAt: new Date().toISOString(),
        previousStatus: envelope.status,
        signersNotified: wasSent ? signers.length : 0,
        reason,
      },
    });

    log.info(`Envelope ${envelopeId} soft-deleted (was ${envelope.status}, ${signers.length} signers)`);

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_soft_deleted',
      summary: `Envelope moved to recovery bin: ${envelope.title}`,
      severity: 'warning',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { previousStatus: envelope.status, signersNotified: wasSent ? signers.length : 0 },
    }).catch(() => {});

    return c.json({
      success: true,
      deleted: true,
      soft_deleted: true,
      recovery_window_days: 90,
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
esignRoutes.post('/envelopes/:envelopeId/recall', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
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

    // Update all pending signers to declined status and rotate their
    // access tokens so stale signing URLs become inert. (P5.6)
    const signers = await getEnvelopeSigners(envelopeId);
    for (const signer of signers) {
      if (signer.status === 'pending' || signer.status === 'viewed') {
        await updateSignerStatus(signer.id, 'declined', {
          declined_at: new Date().toISOString(),
          decline_reason: 'Envelope recalled by admin',
        });
      }
      try { await rotateSignerToken(signer.id, 'envelope_recalled'); } catch { /* best-effort */ }
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

    // P5.4 — webhook fan-out for recall.
    void emitWebhookEvent({
      firmId: envelope.firm_id || 'standalone',
      eventType: 'envelope.recalled',
      envelopeId,
      payload: {
        envelope: { id: envelope.id, title: envelope.title, status: 'voided' },
        reason: reason || null,
        signer_count: signers.length,
      },
    });

    // P5.7 — bell-UI copy for the actor (typically the sender).
    if (envelope.created_by_user_id) {
      void enqueueInAppNotification({
        userId: envelope.created_by_user_id,
        type: 'envelope.recalled',
        title: 'Envelope recalled',
        body: `You recalled "${envelope.title}".${reason ? ` Reason: ${reason}` : ''}`,
        envelopeId,
        metadata: { reason: reason || null },
      });
    }

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
esignRoutes.post('/envelopes/:envelopeId/remind', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
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
        // P5.6 — rotate the signer's token on every manual reminder so any
        // leaked or cached previous link is invalidated.
        const rotated = await rotateSignerToken(signer.id, 'manual_reminder');
        const tokenForLink = rotated?.access_token ?? signer.access_token;
        const signingUrl = `https://www.navigatewealth.co/sign?token=${tokenForLink}`;

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

/**
 * GET /envelopes/:envelopeId/evidence-pack
 * P6.7 — download a ZIP bundling the signed PDF, certificate, audit
 * trail, manifest, consent copy, and every attachment. Admin-only.
 */
esignRoutes.get('/envelopes/:envelopeId/evidence-pack', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // P6.9 — firm scoping. The current admin user must belong to the
    // same firm as the envelope (or the envelope must be 'standalone').
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const pack = await buildEvidencePack(envelopeId);
    if (!pack) return c.json({ error: 'Envelope not found' }, 404);

    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: ctx.user.id,
      action: 'evidence_pack_exported',
      email: ctx.user.email || 'admin@system',
      metadata: { bytes: pack.zip.length, filename: pack.filename },
    });

    return new Response(pack.zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pack.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    log.error('Evidence pack export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to build evidence pack' }, status);
  }
});

// ==================== STUCK-ENVELOPE ALERTS (P7.2) ====================

/**
 * POST /maintenance/stuck-alert-sweep — manual sweep trigger. Admins
 * can force a scan instead of waiting for the scheduler. Returns the
 * sweep summary.
 */
esignRoutes.post('/maintenance/stuck-alert-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runStuckAlertSweep();
    return c.json(result);
  } catch (error: unknown) {
    log.error('Manual stuck-alert sweep failed:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Stuck sweep failed' }, status);
  }
});

/**
 * POST /cron/stuck-alert-sweep — external cron trigger (CRON_SECRET
 * gated). Mirrors /maintenance/stuck-alert-sweep but without a user
 * session requirement.
 */
esignRoutes.post('/cron/stuck-alert-sweep', async (c) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = c.req.header('x-cron-secret');
  if (!cronSecret || provided !== cronSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const result = await runStuckAlertSweep();
  return c.json(result);
});

// ==================== GLOBAL AUDIT SEARCH (P7.3) ====================

/**
 * GET /audit/search — firm-scoped audit log search. Supports filters:
 *   • signer_email  — exact match
 *   • action        — substring match (case-insensitive)
 *   • from, to      — ISO-8601 timestamps
 *   • envelope_id   — narrow to one envelope
 *   • limit         — default 100, max 500
 */
esignRoutes.get('/audit/search', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const qs = c.req.query();
    const result = await searchAuditEvents({
      firmId,
      signerEmail: qs.signer_email,
      action: qs.action,
      from: qs.from,
      to: qs.to,
      envelopeId: qs.envelope_id,
      limit: qs.limit ? Math.min(500, parseInt(qs.limit, 10) || 100) : 100,
    });
    return c.json(result);
  } catch (error: unknown) {
    log.error('Audit search failed:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Audit search failed' }, status);
  }
});

// ==================== SYNTHETIC PROBE (P7.4) ====================

/**
 * GET /diagnostics/synthetic — returns the latest probe result +
 * rolling history. Lightweight; hits KV only.
 */
esignRoutes.get('/diagnostics/synthetic', async (c) => {
  try {
    await getAuthContext(c);
    const [latest, history] = await Promise.all([
      getLatestProbe(),
      getProbeHistory(),
    ]);
    return c.json({ latest, history });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to read probe state' }, status);
  }
});

/**
 * POST /diagnostics/synthetic/run — force a probe right now and
 * return the result. Useful when we need to confirm we are healthy
 * before shipping.
 */
esignRoutes.post('/diagnostics/synthetic/run', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runSyntheticProbe();
    return c.json(result);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Probe failed' }, status);
  }
});

/** External cron — avoids needing a sender session. */
esignRoutes.post('/cron/synthetic-probe', async (c) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = c.req.header('x-cron-secret');
  if (!cronSecret || provided !== cronSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const result = await runSyntheticProbe();
  return c.json(result);
});

// ==================== RETENTION POLICY (P7.7) ====================

/** GET /retention — firm-scoped retention policy (empty → no purging). */
esignRoutes.get('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const policy = await getRetentionPolicy(firmId);
    return c.json({ policy });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Retention read failed' }, status);
  }
});

/** PUT /retention — set or update the policy. */
esignRoutes.put('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const body = await c.req.json<{
      completed_retention_days?: number | null;
      terminated_retention_days?: number | null;
      draft_retention_days?: number | null;
      delete_artifacts?: boolean;
    }>();
    const saved = await setRetentionPolicy(firmId, body);
    return c.json({ policy: saved });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Retention write failed' }, status);
  }
});

/** DELETE /retention — revert to default (no purging). */
esignRoutes.delete('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteRetentionPolicy(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Retention delete failed' }, status);
  }
});

/** POST /maintenance/retention-sweep — force a sweep. */
esignRoutes.post('/maintenance/retention-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runRetentionSweep();
    return c.json(result);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Retention sweep failed' }, status);
  }
});

// ==================== FIRM BRANDING (P8.6) ====================

/**
 * GET /branding — read the caller firm's signer-page branding bundle.
 * Returns `{ branding: null }` when nothing has been configured so the
 * signer UI keeps its built-in defaults. Firm-scoped via `resolveFirmId`.
 */
esignRoutes.get('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const record = await getFirmBranding(firmId);
    return c.json({ branding: record });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Branding read failed' }, status);
  }
});

/**
 * PUT /branding — set or update the firm branding bundle. Inputs are
 * validated server-side: hex colours must match `#RRGGBB`, logo URLs
 * must be HTTPS, support email must be a valid address. Anything that
 * fails validation surfaces as a 400 with the exact reason.
 */
esignRoutes.put('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const body = await c.req.json<{
      display_name?: string | null;
      logo_url?: string | null;
      accent_hex?: string | null;
      support_email?: string | null;
    }>();
    const saved = await setFirmBranding(firmId, body);
    return c.json({ branding: saved });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, error.statusCode);
    }
    const message = error instanceof Error ? error.message : 'Branding write failed';
    // Validation errors surface as 400; everything else is treated as 500.
    const status = /must be|required/i.test(message) ? 400 : 500;
    return c.json({ error: message }, status);
  }
});

/** DELETE /branding — clear the firm branding so signer pages revert to defaults. */
esignRoutes.delete('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteFirmBranding(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Branding delete failed' }, status);
  }
});

// ==================== METRICS DASHBOARD (P7.1) ====================

/**
 * GET /metrics — aggregate metrics for the caller's firm.
 *
 * Returns envelope status counts, signing funnel, time-to-sign, the
 * top stuck envelopes, and a 30-day throughput series. Firm-scoped via
 * `resolveFirmId`. The aggregation is intentionally computed on the
 * fly — small-to-medium firms (thousands of envelopes) complete in
 * well under 300ms and avoid a stale cache surface.
 */
esignRoutes.get('/metrics', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const metrics = await getEsignMetrics(firmId);
    return c.json(metrics);
  } catch (error: unknown) {
    log.error('Metrics aggregation error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to compute metrics' }, status);
  }
});

// ==================== RECOVERY BIN ROUTES (P6.8) ====================

/** GET /recovery-bin — list soft-deleted envelopes (firm-scoped). */
esignRoutes.get('/recovery-bin', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const bin = await listRecoveryBin(firmId);
    return c.json({
      envelopes: bin,
      retention_days: RECOVERY_RETENTION_DAYS,
    });
  } catch (error: unknown) {
    log.error('Recovery bin list error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list recovery bin' }, status);
  }
});

/** POST /recovery-bin/:envelopeId/restore — clear the soft-delete stamp. */
esignRoutes.post('/recovery-bin/:envelopeId/restore', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const restored = await restoreEnvelope(envelopeId, ctx.user.id);
    if (!restored) return c.json({ error: 'Envelope is not in the recovery bin' }, 400);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: ctx.user.id,
      action: 'restored',
      email: ctx.user.email || 'admin@system',
      ip,
      userAgent,
      metadata: { restoredAt: new Date().toISOString() },
    });

    AdminAuditService.record({
      actorId: ctx.user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_restored',
      summary: `Envelope restored: ${restored.title}`,
      severity: 'info',
      entityType: 'envelope',
      entityId: envelopeId,
    }).catch(() => {});

    return c.json({ success: true, envelope: restored });
  } catch (error: unknown) {
    log.error('Restore envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to restore envelope' }, status);
  }
});

/** DELETE /recovery-bin/:envelopeId — permanently purge a single envelope. */
esignRoutes.delete('/recovery-bin/:envelopeId', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ success: true, purged: true, already: true });

    if (!envelope.deleted_at) {
      return c.json({ error: 'Envelope is not in the recovery bin' }, 400);
    }

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await hardDeleteEnvelope(envelopeId);

    AdminAuditService.record({
      actorId: ctx.user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_purged',
      summary: `Envelope permanently deleted: ${envelope.title}`,
      severity: 'critical',
      entityType: 'envelope',
      entityId: envelopeId,
    }).catch(() => {});

    return c.json({ success: true, purged: true });
  } catch (error: unknown) {
    log.error('Purge envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to purge envelope' }, status);
  }
});

/** POST /maintenance/recovery-sweep — run the retention sweeper on demand. */
esignRoutes.post('/maintenance/recovery-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await purgeExpiredDeletedEnvelopes();
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('Recovery sweep error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to run recovery sweep' }, status);
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
    const {
      auto_remind,
      schedule,
      remind_interval_days,
      max_reminders,
      remind_before_expiry_days,
      escalation_offsets_days,
    } = body;

    await setReminderConfig(envelopeId, {
      ...(auto_remind !== undefined && { auto_remind }),
      ...(schedule !== undefined && schedule !== null && { schedule }),
      ...(remind_interval_days !== undefined && { remind_interval_days }),
      ...(max_reminders !== undefined && { max_reminders }),
      ...(remind_before_expiry_days !== undefined && { remind_before_expiry_days }),
      ...(Array.isArray(escalation_offsets_days) && { escalation_offsets_days }),
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
esignRoutes.post('/templates', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
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
 * POST /templates/:templateId/from-envelope
 * Rebuild a template from a configured draft envelope so documents, fields,
 * signing mode, and recipient slots can be updated in one save.
 */
esignRoutes.post('/templates/:templateId/from-envelope', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const envelopeId = String(body.envelopeId ?? '').trim();
    if (!envelopeId) {
      return c.json({ error: 'envelopeId is required' }, 400);
    }

    const updated = await syncTemplateFromEnvelope({
      templateId,
      envelopeId,
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
    });

    if (!updated) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Sync template from envelope error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to sync template' }, 500);
  }
});

/**
 * POST /templates/:templateId/materialise-draft
 * Clone the template's saved source documents into a fresh draft envelope
 * so the admin can edit recipients, fields, or send without re-uploading.
 */
esignRoutes.post('/templates/:templateId/materialise-draft', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const templateId = c.req.param('templateId');
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    const template = await getTemplate(templateId);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }
    if (!Array.isArray(template.documents) || template.documents.length === 0) {
      return c.json({ error: 'This template does not have a saved source document yet.' }, 400);
    }

    await ensureStorageBuckets();

    const firmId = resolveFirmId(user);
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : template.name;
    const message = typeof body.message === 'string'
      ? body.message
      : template.defaultMessage;
    const expiryDays = typeof body.expiryDays === 'number' && Number.isFinite(body.expiryDays)
      ? Math.max(1, Math.round(body.expiryDays))
      : (template.defaultExpiryDays || 30);
    const clientId = typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : 'standalone';

    const cloned = await cloneTemplateDocumentsToEnvelope({
      template,
      firmId,
      addedByUserId: user.id,
    });

    const { envelopeId, error: envError } = await createEnvelope({
      firmId,
      clientId,
      title,
      documentId: cloned.primaryDocumentId,
      createdByUserId: user.id,
      signers: [],
      message,
      expiryDays,
      signingMode: template.signingMode,
      templateId: template.id,
      templateVersion: template.version,
      campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
      packetRunId: typeof body.packetRunId === 'string' ? body.packetRunId : undefined,
      packetStepIndex: typeof body.packetStepIndex === 'number' ? body.packetStepIndex : undefined,
    });
    if (envError || !envelopeId) {
      return c.json({ error: envError || 'Failed to create envelope from template' }, 500);
    }

    if (cloned.documents.length > 1) {
      await setEnvelopeDocuments(envelopeId, cloned.documents);
    }

    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) {
      return c.json({ error: 'Draft envelope could not be loaded' }, 500);
    }

    const documentUrl = cloned.documents[0]?.storage_path
      ? await getDocumentUrl(cloned.documents[0].storage_path)
      : null;

    return c.json({
      envelope: {
        ...envelope,
        document: envelope.document
          ? {
              ...envelope.document,
              url: documentUrl,
            }
          : envelope.document,
      },
      documentMap: cloned.documentMap,
      documents: cloned.documents,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Materialise template draft error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to start from template' }, 500);
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
 * Increment usage counter (called when user starts an envelope from a template).
 * P4.2 — Returns the pinned `version` so the caller can stamp it on the
 * envelope at create-time. The express wizard threads this through the
 * upload context so the envelope record records exactly which template
 * snapshot it was materialised from.
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
    return c.json({
      success: true,
      usageCount: (template.usageCount || 0) + 1,
      version: template.version ?? 1,
      template,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Use template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to use template' }, 500);
  }
});

/**
 * GET /templates/:templateId/versions
 * P4.2 — list available historical versions of a template.
 */
esignRoutes.get('/templates/:templateId/versions', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const versions = await listTemplateVersions(templateId);
    return c.json({ versions });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('List template versions error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list versions' }, 500);
  }
});

/**
 * GET /templates/:templateId/versions/:version
 * P4.2 — fetch a specific historical version of a template (returns
 * the live record when version matches the live one).
 */
esignRoutes.get('/templates/:templateId/versions/:version', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const versionParam = c.req.param('version');
    const version = Number.parseInt(versionParam, 10);
    if (!Number.isFinite(version) || version < 1) {
      return c.json({ error: 'Invalid version' }, 400);
    }
    const template = await getTemplateVersion(templateId, version);
    if (!template) {
      return c.json({ error: 'Template version not found' }, 404);
    }
    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Get template version error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to load version' }, 500);
  }
});

// ===========================================================================
// P4.7 — Bulk-send campaigns
// ===========================================================================
// Campaigns persist a sender's "fan out one template to N recipients"
// intent. Envelope materialisation + invite-send is driven by the
// frontend so the campaign layer is a thin orchestrator: it stores the
// row plan, accepts per-row outcome reports, and supports a kill-switch.
// ===========================================================================

/**
 * POST /campaigns
 * Body: { templateId, templateVersion?, title, message?, expiryDays?, csvText, rows? }
 * Either `csvText` (parsed server-side against the template's recipient
 * shape) or `rows` (already shaped by the client) is required.
 */
esignRoutes.post('/campaigns', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const body = await c.req.json();
    const {
      templateId,
      templateVersion,
      title,
      message,
      expiryDays,
      csvText,
      rows: rawRows,
    } = body as {
      templateId?: string;
      templateVersion?: number;
      title?: string;
      message?: string;
      expiryDays?: number;
      csvText?: string;
      rows?: unknown;
    };

    if (!templateId) return c.json({ error: 'templateId is required' }, 400);
    if (!title?.trim()) return c.json({ error: 'title is required' }, 400);

    const template = await getTemplate(templateId);
    if (!template) return c.json({ error: 'Template not found' }, 404);

    let rows: Awaited<ReturnType<typeof mapCsvToRows>>['rows'] = [];
    let warnings: string[] = [];
    if (typeof csvText === 'string' && csvText.trim().length > 0) {
      const parsed = parseCsv(csvText);
      const mapped = mapCsvToRows(parsed.headers, parsed.rows, template);
      rows = mapped.rows;
      warnings = mapped.warnings;
    } else if (Array.isArray(rawRows)) {
      rows = rawRows as typeof rows;
    } else {
      return c.json({ error: 'Provide csvText or rows[]' }, 400);
    }

    if (rows.length === 0) return c.json({ error: 'No rows parsed from CSV' }, 400);

    const firmId = (ctx as { firmId?: string }).firmId ?? 'standalone';
    const result = await createCampaign({
      firmId,
      templateId,
      templateVersion,
      title: title.trim(),
      message,
      expiryDays,
      createdBy: user.id,
      rows,
    });
    if (result.error || !result.campaign) {
      return c.json({ error: result.error || 'Failed to create campaign' }, 400);
    }
    return c.json({ campaign: result.campaign, warnings });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Create campaign error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create campaign' }, 500);
  }
});

esignRoutes.get('/campaigns', async (c) => {
  try {
    await getAuthContext(c);
    const campaigns = await listCampaigns();
    return c.json({ campaigns });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List campaigns error:', error);
    return c.json({ error: 'Failed to list campaigns' }, 500);
  }
});

esignRoutes.get('/campaigns/:id', async (c) => {
  try {
    await getAuthContext(c);
    const campaign = await getCampaign(c.req.param('id'));
    if (!campaign) return c.json({ error: 'Campaign not found' }, 404);
    return c.json({ campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get campaign error:', error);
    return c.json({ error: 'Failed to load campaign' }, 500);
  }
});

esignRoutes.post('/campaigns/:id/results/:rowId', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const id = c.req.param('id');
    const rowId = c.req.param('rowId');
    const body = await c.req.json();
    const status = body.status as 'sent' | 'failed' | 'cancelled' | 'queued';
    if (!['sent', 'failed', 'cancelled', 'queued'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    const result = await recordCampaignRowResult(id, rowId, {
      envelopeId: typeof body.envelopeId === 'string' ? body.envelopeId : undefined,
      status,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
    });
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ campaign: result.campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Record campaign row result error:', error);
    return c.json({ error: 'Failed to update row result' }, 500);
  }
});

esignRoutes.post('/campaigns/:id/cancel', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await cancelCampaign(c.req.param('id'));
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ campaign: result.campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Cancel campaign error:', error);
    return c.json({ error: 'Failed to cancel campaign' }, 500);
  }
});

// ===========================================================================
// P4.8 — Packets (sequenced templates) + packet runs
// ===========================================================================

/**
 * POST /documents/upload
 * Lightweight "just store this PDF" endpoint that returns a documentId
 * without spawning a draft envelope. Used by packet runs which need to
 * upload one document per step ahead of time so the server-side
 * advancement loop can spawn step-N envelopes without further user
 * interaction.
 */
esignRoutes.post('/documents/upload', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ error: 'file required' }, 400);

    const buffer = new Uint8Array(await file.arrayBuffer());
    const validation = validateDocument(buffer, file.name);
    if (!validation.valid) return c.json({ error: validation.error }, 400);

    const hash = await calculateHash(buffer);
    const pageCount = extractPageCount(buffer);
    const documentId = crypto.randomUUID();
    const firmId = resolveFirmId(ctx.user);

    const { path, error: uploadError } = await uploadDocument(
      firmId,
      documentId,
      buffer,
      file.name,
      'application/pdf',
    );
    if (uploadError || !path) return c.json({ error: uploadError || 'Upload failed' }, 500);

    await createDocument({
      id: documentId,
      firm_id: firmId,
      storage_path: path,
      original_filename: file.name,
      page_count: pageCount,
      hash,
      created_at: new Date().toISOString(),
    });

    log.info(`Document ${documentId} uploaded by ${ctx.user.email} (${pageCount} pages)`);
    return c.json({ documentId, pageCount, hash });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Standalone document upload error:', error);
    return c.json({ error: 'Failed to upload document' }, 500);
  }
});

/**
 * POST /packets
 * Author a new packet (ordered list of templates).
 */
esignRoutes.post('/packets', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json();
    const { name, description, steps } = body || {};
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return c.json({ error: 'name and at least one step are required' }, 400);
    }
    const result = await createPacket({
      firmId: resolveFirmId(ctx.user),
      name,
      description,
      steps: steps.map((s: { templateId: string; templateVersion?: number; label?: string }) => ({
        templateId: s.templateId,
        templateVersion: s.templateVersion,
        label: s.label,
      })),
      createdByUserId: ctx.user.id,
    });
    if (result.error) return c.json({ error: result.error }, 400);
    return c.json({ packet: result.packet });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Create packet error:', error);
    return c.json({ error: 'Failed to create packet' }, 500);
  }
});

esignRoutes.get('/packets', async (c) => {
  try {
    await getAuthContext(c);
    const packets = await listPackets();
    return c.json({ packets });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List packets error:', error);
    return c.json({ error: 'Failed to list packets' }, 500);
  }
});

esignRoutes.get('/packets/:id', async (c) => {
  try {
    await getAuthContext(c);
    const packet = await getPacket(c.req.param('id'));
    if (!packet) return c.json({ error: 'Packet not found' }, 404);
    return c.json({ packet });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get packet error:', error);
    return c.json({ error: 'Failed to get packet' }, 500);
  }
});

esignRoutes.delete('/packets/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await deletePacket(c.req.param('id'));
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Delete packet error:', error);
    return c.json({ error: 'Failed to delete packet' }, 500);
  }
});

/**
 * POST /packet-runs
 * Start a new packet run. Body: { packetId, recipients[], documentIdsByStep[],
 * clientId?, expiryDays?, message? }
 *
 * Caller is expected to upload one document per step beforehand via the
 * standard `/envelopes/upload` endpoint (which returns a documentId), so
 * server-side advancement can re-use those document ids for steps 2..N
 * without any further user interaction.
 */
esignRoutes.post('/packet-runs', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json();
    const { packetId, recipients, documentIdsByStep, clientId, expiryDays, message } = body || {};
    if (!packetId) return c.json({ error: 'packetId required' }, 400);
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return c.json({ error: 'At least one recipient required' }, 400);
    }
    if (!Array.isArray(documentIdsByStep) || documentIdsByStep.length === 0) {
      return c.json({ error: 'documentIdsByStep required (one per step)' }, 400);
    }

    const result = await startPacketRun({
      packetId,
      firmId: resolveFirmId(ctx.user),
      clientId: clientId || 'standalone',
      recipients,
      documentIdsByStep,
      createdByUserId: ctx.user.id,
      senderEmail: ctx.user.email,
      expiryDays,
      message,
    });

    if (result.error && !result.run) return c.json({ error: result.error }, 400);
    return c.json({
      run: result.run,
      firstEnvelopeId: result.firstEnvelopeId,
      warning: result.error,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Start packet run error:', error);
    return c.json({ error: 'Failed to start packet run' }, 500);
  }
});

esignRoutes.get('/packet-runs', async (c) => {
  try {
    await getAuthContext(c);
    const runs = await listPacketRuns();
    return c.json({ runs });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List packet runs error:', error);
    return c.json({ error: 'Failed to list packet runs' }, 500);
  }
});

esignRoutes.get('/packet-runs/:id', async (c) => {
  try {
    await getAuthContext(c);
    const run = await getPacketRun(c.req.param('id'));
    if (!run) return c.json({ error: 'Packet run not found' }, 404);
    return c.json({ run });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get packet run error:', error);
    return c.json({ error: 'Failed to get packet run' }, 500);
  }
});

esignRoutes.post('/packet-runs/:id/cancel', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await cancelPacketRun(c.req.param('id'));
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ run: result.run });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Cancel packet run error:', error);
    return c.json({ error: 'Failed to cancel packet run' }, 500);
  }
});

// ============================================================================
// P5.4 — WEBHOOK SUBSCRIPTIONS & DELIVERIES
// ============================================================================
//
// Firm-scoped HTTP callbacks. Producers call `emitWebhookEvent` from inside
// the e-sign workflow. The outbox is drained by `esign-scheduler.ts`.
// All routes require an authenticated sender user. The owning firm id is
// derived from `ctx.user.user_metadata.firm_id` with a fallback to the
// user id so a single-firm install still works.

// P6.9 — canonical firm-scope helper now lives in `esign-firm-scope.ts`.
// We keep a thin local alias so existing call sites compile unchanged.
function resolveFirmId(user: { id: string; user_metadata?: Record<string, unknown> }): string {
  return resolveFirmIdShared(user);
}

const KNOWN_WEBHOOK_EVENTS: SenderEvent[] = [
  'signer.signed',
  'signer.declined',
  'envelope.completed',
  'envelope.expired',
  'signer.viewed',
  'envelope.recalled',
];

/** POST /webhooks — create a subscription. */
esignRoutes.post('/webhooks', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const { url, events, description } = body as {
      url?: string;
      events?: string[];
      description?: string;
    };

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return c.json({ error: 'A valid https URL is required' }, 400);
    }
    if (!Array.isArray(events) || events.length === 0) {
      return c.json({ error: 'At least one event subscription is required' }, 400);
    }
    const filtered = events.filter((e): e is SenderEvent =>
      typeof e === 'string' && (KNOWN_WEBHOOK_EVENTS as string[]).includes(e),
    );
    if (filtered.length === 0) {
      return c.json({ error: 'No recognised events' }, 400);
    }

    const firmId = resolveFirmId(ctx.user);
    const sub = await createWebhookSub({
      firmId,
      userId: ctx.user.id,
      url,
      events: filtered,
      description: typeof description === 'string' ? description.slice(0, 300) : undefined,
    });

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_created',
      metadata: { id: sub.id, url: sub.url, events: sub.events },
    });

    return c.json({ subscription: sub });
  } catch (error: unknown) {
    log.error('Create webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create subscription' }, status);
  }
});

/** GET /webhooks — list subscriptions for the current firm. */
esignRoutes.get('/webhooks', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const subs = await listWebhookSubs(firmId);
    return c.json({ subscriptions: subs });
  } catch (error: unknown) {
    log.error('List webhooks error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list subscriptions' }, status);
  }
});

/** PATCH /webhooks/:id — update url / events / active / description. */
esignRoutes.patch('/webhooks/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const patch: Partial<{ url: string; events: SenderEvent[]; active: boolean; description: string }> = {};
    if (typeof body.url === 'string' && /^https?:\/\//i.test(body.url)) patch.url = body.url;
    if (Array.isArray(body.events)) {
      patch.events = body.events.filter((e: unknown): e is SenderEvent =>
        typeof e === 'string' && (KNOWN_WEBHOOK_EVENTS as string[]).includes(e),
      );
    }
    if (typeof body.active === 'boolean') patch.active = body.active;
    if (typeof body.description === 'string') patch.description = body.description.slice(0, 300);

    const updated = await updateWebhookSub(id, patch);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_updated',
      metadata: { id, patch },
    });
    return c.json({ subscription: updated });
  } catch (error: unknown) {
    log.error('Update webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update subscription' }, status);
  }
});

/** POST /webhooks/:id/rotate-secret — issue a new signing secret. */
esignRoutes.post('/webhooks/:id/rotate-secret', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const rotated = await rotateWebhookSubSecret(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_secret_rotated',
      metadata: { id },
    });
    return c.json({ subscription: rotated });
  } catch (error: unknown) {
    log.error('Rotate webhook secret error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to rotate secret' }, status);
  }
});

/** DELETE /webhooks/:id — remove a subscription. */
esignRoutes.delete('/webhooks/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await deleteWebhookSub(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_deleted',
      metadata: { id, url: existing.url },
    });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Delete webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete subscription' }, status);
  }
});

/**
 * GET /webhooks/deliveries?status=&limit=
 * Recent deliveries for the current firm, newest first.
 */
esignRoutes.get('/webhooks/deliveries', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const status = c.req.query('status') as WebhookDeliveryStatus | undefined;
    const limit = Number(c.req.query('limit') ?? 100) || 100;
    const deliveries = await listWebhookDeliveries({ status, limit, firmId });
    return c.json({ deliveries });
  } catch (error: unknown) {
    log.error('List webhook deliveries error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list deliveries' }, status);
  }
});

/** GET /webhooks/dead-letters — everything that gave up. */
esignRoutes.get('/webhooks/dead-letters', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const deliveries = await listWebhookDeadLetters(firmId);
    return c.json({ deliveries });
  } catch (error: unknown) {
    log.error('List webhook dead-letters error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list dead-letters' }, status);
  }
});

/** POST /webhooks/deliveries/:id/replay — re-enqueue a failed/dead delivery. */
esignRoutes.post('/webhooks/deliveries/:id/replay', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const delivery = await replayWebhookDelivery(id);
    if (!delivery) return c.json({ error: 'Delivery not found' }, 404);
    if (delivery.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await logAuditEvent({
      envelopeId: delivery.envelope_id ?? 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_delivery_replayed',
      metadata: { id, subscription_id: delivery.subscription_id, event_type: delivery.event_type },
    });
    return c.json({ delivery });
  } catch (error: unknown) {
    log.error('Replay webhook delivery error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to replay delivery' }, status);
  }
});

// `emitWebhookEvent` is imported above and invoked from the e-sign
// workflow alongside existing email dispatch. No direct route entry
// needed here — the outbox tick drives delivery.
void emitWebhookEvent;

// ============================================================================
// P5.5 — API KEY MANAGEMENT (admin-facing)
// ============================================================================
//
// Per-firm keys with dual-active rotation. Plaintext `token` only returned
// once on create and rotate. The UI is expected to hoard it from that
// response; subsequent listings show only the prefix + masked tail.

/** POST /api-keys — mint a new key. */
esignRoutes.post('/api-keys', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'A name is required' }, 400);
    const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => typeof s === 'string') : undefined;
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : undefined;
    const firmId = resolveFirmId(ctx.user);

    const { key, token } = await createApiKey({ firmId, userId: ctx.user.id, name, scopes, expiresAt });
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_created',
      metadata: { id: key.id, name: key.name, prefix: key.prefix },
    });

    return c.json({ key: redactApiKey(key), token });
  } catch (error: unknown) {
    log.error('Create API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create API key' }, status);
  }
});

/** GET /api-keys — list keys for the current firm (redacted). */
esignRoutes.get('/api-keys', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const keys = await listApiKeysByFirm(firmId);
    return c.json({ keys: keys.map(redactApiKey) });
  } catch (error: unknown) {
    log.error('List API keys error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to list API keys' }, status);
  }
});

/** PATCH /api-keys/:id — update name / active / scopes / expires_at. */
esignRoutes.patch('/api-keys/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const patch: Partial<{ name: string; active: boolean; scopes: string[]; expires_at?: string }> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.active === 'boolean') patch.active = body.active;
    if (Array.isArray(body.scopes)) patch.scopes = body.scopes.filter((s: unknown) => typeof s === 'string') as string[];
    if (typeof body.expiresAt === 'string' || body.expiresAt === null) patch.expires_at = body.expiresAt ?? undefined;

    const updated = await updateApiKey(id, patch);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_updated',
      metadata: { id, patch },
    });
    return c.json({ key: updated ? redactApiKey(updated) : null });
  } catch (error: unknown) {
    log.error('Update API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update API key' }, status);
  }
});

/** POST /api-keys/:id/rotate — issue a sibling key (dual-active). */
esignRoutes.post('/api-keys/:id/rotate', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const rotated = await rotateApiKey(id);
    if (!rotated) return c.json({ error: 'Failed to rotate' }, 500);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_rotated',
      metadata: { source_id: id, new_id: rotated.key.id },
    });
    return c.json({ key: redactApiKey(rotated.key), token: rotated.token });
  } catch (error: unknown) {
    log.error('Rotate API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to rotate API key' }, status);
  }
});

/** DELETE /api-keys/:id — permanent revoke. */
esignRoutes.delete('/api-keys/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await deleteApiKey(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_deleted',
      metadata: { id, name: existing.name },
    });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Delete API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete API key' }, status);
  }
});

// ============================================================================
// P5.5 — PUBLIC REST API (`/v1/*`)
// ============================================================================
//
// Authenticated via `Authorization: Bearer navsig_<prefix>_<secret>`.
// Scoped to the firm that owns the key. Rate-limited via the shared
// `rateLimit` helper keyed off the key prefix so one noisy integration
// doesn't starve another.

async function requireApiKey(c: Context): Promise<
  | { ok: true; firmId: string; keyId: string }
  | { ok: false; response: Response }
> {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return { ok: false, response: c.json({ error: 'Missing API key' }, 401) };
  }
  const key = await resolveApiKey(token);
  if (!key) {
    return { ok: false, response: c.json({ error: 'Invalid or revoked API key' }, 401) };
  }
  return { ok: true, firmId: key.firm_id, keyId: key.id };
}

/** GET /v1/envelopes — list envelopes in the caller's firm. */
esignRoutes.get('/v1/envelopes', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const all = await getAllEnvelopes();
    const scoped = (all as Array<Record<string, unknown>>).filter((e) => e.firm_id === auth.firmId);
    const status = c.req.query('status');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const filtered = status ? scoped.filter((e) => e.status === status) : scoped;
    return c.json({
      envelopes: filtered.slice(0, limit).map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        created_at: e.created_at,
        updated_at: e.updated_at,
        sent_at: e.sent_at,
        completed_at: e.completed_at,
        expires_at: e.expires_at,
      })),
      count: Math.min(filtered.length, limit),
    });
  } catch (error: unknown) {
    log.error('v1 list envelopes error:', error);
    return c.json({ error: 'Failed to list envelopes' }, 500);
  }
});

/** GET /v1/envelopes/:id — single envelope with signers & fields. */
esignRoutes.get('/v1/envelopes/:id', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id');
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    return c.json({ envelope });
  } catch (error: unknown) {
    log.error('v1 get envelope error:', error);
    return c.json({ error: 'Failed to load envelope' }, 500);
  }
});

/** GET /v1/envelopes/:id/audit — audit trail. */
esignRoutes.get('/v1/envelopes/:id/audit', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id');
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    const events = await getAuditTrail(id);
    return c.json({ events });
  } catch (error: unknown) {
    log.error('v1 audit trail error:', error);
    return c.json({ error: 'Failed to load audit trail' }, 500);
  }
});

/** GET /v1/envelopes/:id/signed-pdf — binary download of the signed PDF. */
esignRoutes.get('/v1/envelopes/:id/signed-pdf', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id');
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    if (envelope.status !== 'completed') {
      return c.json({ error: 'Signed PDF available only for completed envelopes' }, 409);
    }
    const path = envelope.signed_document_path;
    if (!path) return c.json({ error: 'Signed document not yet materialised' }, 404);
    const buf = await downloadDocument(path);
    if (!buf) return c.json({ error: 'Signed document missing in storage' }, 404);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="envelope_${id}_signed.pdf"`,
      },
    });
  } catch (error: unknown) {
    log.error('v1 download signed pdf error:', error);
    return c.json({ error: 'Failed to download signed PDF' }, 500);
  }
});

/** GET /v1/templates — list templates for this firm. */
esignRoutes.get('/v1/templates', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const templates = await listTemplates();
    const scoped = (templates as Array<Record<string, unknown>>).filter(
      (t) => !t.firm_id || t.firm_id === auth.firmId,
    );
    return c.json({ templates: scoped });
  } catch (error: unknown) {
    log.error('v1 list templates error:', error);
    return c.json({ error: 'Failed to list templates' }, 500);
  }
});

/** GET /v1/templates/:id — template detail. */
esignRoutes.get('/v1/templates/:id', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id');
    const template = await getTemplate(id);
    if (!template) return c.json({ error: 'Template not found' }, 404);
    const tFirm = (template as unknown as Record<string, unknown>).firm_id as string | undefined;
    if (tFirm && tFirm !== auth.firmId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ template });
  } catch (error: unknown) {
    log.error('v1 get template error:', error);
    return c.json({ error: 'Failed to load template' }, 500);
  }
});

/**
 * POST /v1/envelopes/from-template — materialise a draft envelope from a
 * saved template. Callers provide a base64-encoded PDF and the recipient
 * slots that fill the template's recipient list (by index). The response
 * returns the new envelope id ready for a follow-up `send` invocation from
 * the admin UI, or may be auto-sent if `send: true` is supplied.
 *
 * Body:
 *   {
 *     templateId: string,
 *     documentBase64: string,       // raw PDF bytes, base64
 *     filename?: string,
 *     title?: string,
 *     clientId?: string,
 *     message?: string,
 *     expiryDays?: number,
 *     recipients: Array<{ name: string; email: string; phone?: string; smsOptIn?: boolean }>
 *   }
 */
esignRoutes.post('/v1/envelopes/from-template', rateLimit('SENDER_MUTATE'), async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const templateId = String(body.templateId ?? '').trim();
    const documentBase64 = String(body.documentBase64 ?? '').trim();
    const recipients = Array.isArray(body.recipients) ? body.recipients as Array<Record<string, unknown>> : [];

    if (!templateId) return c.json({ error: 'templateId required' }, 400);
    if (!documentBase64) return c.json({ error: 'documentBase64 required' }, 400);
    if (recipients.length === 0) return c.json({ error: 'At least one recipient is required' }, 400);

    const template = await getTemplate(templateId);
    if (!template) return c.json({ error: 'Template not found' }, 404);
    const tFirm = (template as unknown as Record<string, unknown>).firm_id as string | undefined;
    if (tFirm && tFirm !== auth.firmId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (template.recipients.length > 0 && recipients.length < template.recipients.length) {
      return c.json({
        error: `Template requires ${template.recipients.length} recipient(s); received ${recipients.length}.`,
      }, 400);
    }

    let buffer: Uint8Array;
    try {
      const bin = atob(documentBase64.replace(/^data:.*;base64,/, ''));
      buffer = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
    } catch {
      return c.json({ error: 'documentBase64 is not valid base64' }, 400);
    }

    const filename = String(body.filename ?? `${template.name || 'template'}.pdf`);
    const validation = validateDocument(buffer, filename);
    if (!validation.valid) return c.json({ error: validation.error }, 400);

    const hash = await calculateHash(buffer);
    const pageCount = extractPageCount(buffer);
    const documentId = crypto.randomUUID();

    const { path, error: uploadError } = await uploadDocument(
      auth.firmId,
      documentId,
      buffer,
      filename,
      'application/pdf',
    );
    if (uploadError || !path) {
      return c.json({ error: uploadError || 'Upload failed' }, 500);
    }

    await createDocument({
      id: documentId,
      firm_id: auth.firmId,
      storage_path: path,
      original_filename: filename,
      page_count: pageCount,
      hash,
      created_at: new Date().toISOString(),
    });

    const title = String(body.title ?? template.name ?? 'Envelope from template');
    const clientId = String(body.clientId ?? 'standalone');
    const message = typeof body.message === 'string' ? body.message : template.defaultMessage;
    const expiryDays = typeof body.expiryDays === 'number' ? body.expiryDays : template.defaultExpiryDays;

    const { envelopeId, error: envError } = await createEnvelope({
      firmId: auth.firmId,
      clientId,
      title,
      documentId,
      createdByUserId: `api:${auth.keyId}`,
      signers: [],
      message,
      expiryDays,
      signingMode: template.signingMode,
      templateId: template.id,
      templateVersion: template.version,
    });

    if (envError || !envelopeId) {
      return c.json({ error: envError || 'Failed to create envelope' }, 500);
    }

    const signerInputs = recipients.map((r, i) => {
      const slot = template.recipients[i];
      const name = String(r.name ?? slot?.name ?? '').trim();
      const email = String(r.email ?? slot?.email ?? '').trim();
      return {
        name,
        email,
        phone: typeof r.phone === 'string' ? r.phone : undefined,
        role: slot?.role,
        requiresOtp: slot?.otpRequired === true,
        smsOptIn: r.smsOptIn === true,
      };
    });

    const missing = signerInputs.find((s) => !s.name || !s.email);
    if (missing) {
      return c.json({ error: 'Every recipient must include name + email' }, 400);
    }

    const { signerIds, error: signerError } = await addSignersToEnvelope(envelopeId, signerInputs);
    if (signerError) {
      return c.json({ error: signerError }, 500);
    }

    if (template.fields.length > 0) {
      const fields = template.fields
        .map((f) => {
          const signerId = signerIds[f.recipientIndex];
          if (!signerId) return null;
          return {
            signerId,
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (fields.length > 0) {
        await addFieldsToEnvelope(envelopeId, fields);
      }
    }

    await incrementUsageCount(template.id);

    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: `api:${auth.keyId}`,
      action: 'envelope_created_from_template_api',
      metadata: {
        template_id: template.id,
        template_version: template.version,
        recipient_count: signerInputs.length,
      },
    });

    return c.json({
      envelope_id: envelopeId,
      status: 'draft',
      document_id: documentId,
      signer_ids: signerIds,
      template_id: template.id,
      template_version: template.version,
    }, 201);
  } catch (error: unknown) {
    log.error('v1 create from template error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create envelope' }, 500);
  }
});

// ==================== P6.4 — CONSENT REGISTRY ====================

/**
 * GET /consent/active — public; signer UI uses this for legacy envelopes
 * that predate `consent_version` pinning. Returns `{ id, text }` only.
 */
esignRoutes.get('/consent/active', async (c) => {
  try {
    const rec = await getActiveConsent();
    return c.json({ id: rec.id, text: rec.text });
  } catch (error: unknown) {
    return c.json({ error: getErrMsg(error) }, 500);
  }
});

/** GET /consent/versions — admin: list every published version. */
esignRoutes.get('/consent/versions', async (c) => {
  try {
    await getAuthContext(c);
    const versions = await listConsentVersions();
    const activeId = (await getActiveConsent()).id;
    return c.json({ active_id: activeId, versions });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: getErrMsg(error) }, status);
  }
});

/** POST /consent/versions — publish & activate a new consent version. */
esignRoutes.post('/consent/versions', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const id = String(body.id ?? '').trim();
    const text = String(body.text ?? '').trim();
    const summary = typeof body.summary === 'string' ? body.summary : undefined;
    if (!id || !text) return c.json({ error: 'id and text are required' }, 400);
    const record = await publishConsentVersion({ id, text, summary, publishedBy: ctx.user.id });
    return c.json({ success: true, version: record }, 201);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 400;
    return c.json({ error: getErrMsg(error) }, status);
  }
});

/** POST /consent/versions/:id/activate — flip the active pointer. */
esignRoutes.post('/consent/versions/:id/activate', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const id = c.req.param('id');
    const record = await setActiveConsent(id);
    return c.json({ success: true, version: record });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 400;
    return c.json({ error: getErrMsg(error) }, status);
  }
});

// ==================== P6.6 — KBA GATE ====================

/** GET /diagnostics/kba — admin: show which provider is wired. */
esignRoutes.get('/diagnostics/kba', async (c) => {
  try {
    await getAuthContext(c);
    return c.json({ success: true, ...getKbaStatus() });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: getErrMsg(error) }, status);
  }
});

/**
 * POST /signer/kba — public; run (or re-run) a KBA check for the signer
 * associated with the supplied access token. Returns the result and
 * stamps it onto the signer record.
 */
esignRoutes.post('/signer/kba', rateLimit('SIGNER_ACCESS'), async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const token = String(body.access_token ?? '').trim();
    if (!token) return c.json({ error: 'access_token required' }, 400);
    const signer = await getSignerByToken(token);
    if (!signer) return c.json({ error: 'Invalid access token' }, 404);
    const envelope = await getEnvelopeDetails(signer.envelope_id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const idNumber = typeof body.id_number === 'string' ? body.id_number : undefined;

    const result = await runKbaCheck({
      signerId: signer.id,
      envelopeId: signer.envelope_id,
      fullName: signer.name,
      email: signer.email,
      phone: signer.phone,
      idNumber,
    });

    await updateSignerStatus(signer.id, signer.status, {
      kba: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
        verified_at: result.verifiedAt ?? new Date().toISOString(),
      },
    });

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'kba_check',
      email: signer.email,
      metadata: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
      },
    });

    return c.json({
      success: result.status === 'passed' || result.status === 'skipped',
      provider: result.provider,
      status: result.status,
      action_url: result.actionUrl ?? null,
      details: result.details ?? null,
    });
  } catch (error: unknown) {
    log.error('Signer KBA error:', error);
    return c.json({ error: getErrMsg(error) }, 500);
  }
});

export default esignRoutes;
