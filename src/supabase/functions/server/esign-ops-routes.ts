/**
 * esign ops/sweeps routes — admin maintenance + scheduled sweeps (Phase 5).
 * =========================================================================
 *
 * Extracted verbatim from esign-routes.tsx: the SMS diagnostics badge, the
 * admin-triggered maintenance sweeps (expiry / reminder, dry-run-first) and
 * bulk operations (bulk-remind / bulk-void), plus the system /cron/* variants
 * authenticated by the Supabase service-role key. Mounted back into the esign
 * app via `esignRoutes.route('/', opsRoutes)` so the exact paths are kept.
 *
 * Depends only on shared esign services (no local esign-routes helpers), so it
 * moves without a circular import. Behaviour-preserving; the route contract
 * suite (auth-enforcement + the cron service-key model + the diagnostics/sms
 * envelope) is the guard since tsc does not type-check edge code.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { getSmsProviderStatus } from './sms-service.ts';
import { sendSigningReminder } from './email-service.ts';
import { runExpirySweep } from './esign-expiry-service.ts';
import { requireCronAuth } from './cron-auth.ts';
import { runReminderSweep } from './esign-reminder-service.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  updateEnvelopeStatus,
  logAuditEvent,
} from './esign-services.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const log = createModuleLogger('esign-ops-routes');

const opsRoutes = new Hono();

// P5.1 — SMS provider health check (Twilio configured / noop dev mode badge).
opsRoutes.get('/diagnostics/sms', async (c) => {
  try {
    await getAuthContext(c);
    return c.json({ success: true, sms: getSmsProviderStatus() });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /maintenance/expiry-sweep
 * Run envelope expiry sweep (admin only, dry-run-first pattern §14.1)
 */
opsRoutes.post('/maintenance/expiry-sweep', async (c) => {
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Expiry sweep failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /cron/expiry-sweep
 * Scheduled CRON endpoint — runs the expiry sweep in live mode.
 * Auth: requireCronAuth (cron-auth.ts). The scheduled job sends the
 * Vault-backed shared token in the x-nw-cron-auth header; a service-role or
 * super-admin bearer still works for manual runs.
 *
 * Until 2026-08-25 this compared the bearer to SUPABASE_SERVICE_ROLE_KEY
 * inline, and had been answering 401 to its own cron job — envelopes were never
 * being expired. See docs/runbooks/scheduled-jobs.md.
 *
 * Manual run:
 *   curl -X POST \
 *     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
 *     https://<project>.supabase.co/functions/v1/make-server-91ed8379/esign/cron/expiry-sweep
 *
 * Runs live (dryRun=false) and logs audit events as actorType='system'.
 */
opsRoutes.post('/cron/expiry-sweep', requireCronAuth, async (c) => {
  try {
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

    log.info(
      `CRON expiry sweep complete: expired=${result.expiredCount}, errors=${result.errors.length}`,
    );
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('CRON expiry sweep error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'CRON expiry sweep failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * P5.3 — POST /maintenance/reminder-sweep
 * Manually trigger the escalating-reminder sweep (admin only, supports
 * dry-run-first pattern). Useful for testing new reminder configs.
 */
opsRoutes.post('/maintenance/reminder-sweep', async (c) => {
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Reminder sweep failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * P5.3 — POST /cron/reminder-sweep
 * Scheduled entrypoint for the reminder sweep. Service-role auth only.
 */
opsRoutes.post('/cron/reminder-sweep', async (c) => {
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
    return c.json(
      { error: error instanceof Error ? error.message : 'CRON reminder sweep failed' },
      500,
    );
  }
});

/**
 * POST /maintenance/bulk-remind
 * Send reminders to pending signers across multiple envelopes (admin only)
 */
opsRoutes.post('/maintenance/bulk-remind', rateLimit('SENDER_BULK'), async (c) => {
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
          results.push({
            envelopeId,
            title: 'Unknown',
            pendingSigners: [],
            remindersSent: 0,
            error: 'Envelope not found',
          });
          continue;
        }
        if (!['sent', 'viewed', 'partially_signed'].includes(envelope.status)) {
          results.push({
            envelopeId,
            title: envelope.title,
            pendingSigners: [],
            remindersSent: 0,
            error: `Status '${envelope.status}' is not remindable`,
          });
          continue;
        }

        const signers = await getEnvelopeSigners(envelopeId);
        const pendingSigners = signers.filter((s: { status: string }) =>
          ['pending', 'sent', 'viewed', 'otp_verified'].includes(s.status),
        );

        if (pendingSigners.length === 0) {
          results.push({
            envelopeId,
            title: envelope.title,
            pendingSigners: [],
            remindersSent: 0,
            error: 'No pending signers',
          });
          continue;
        }

        const pending = pendingSigners.map((s: { name: string; email: string }) => ({
          name: s.name,
          email: s.email,
        }));

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

        results.push({
          envelopeId,
          title: envelope.title,
          pendingSigners: pending,
          remindersSent: dryRun ? 0 : pendingSigners.length,
        });
      } catch (err) {
        results.push({
          envelopeId,
          title: 'Unknown',
          pendingSigners: [],
          remindersSent: 0,
          error: getErrMsg(err),
        });
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Bulk remind failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /maintenance/bulk-void
 * Void multiple envelopes at once (admin only, dry-run-first pattern)
 */
opsRoutes.post('/maintenance/bulk-void', rateLimit('SENDER_BULK'), async (c) => {
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
          results.push({
            envelopeId,
            title: 'Unknown',
            previousStatus: '',
            voided: false,
            error: 'Envelope not found',
          });
          continue;
        }
        if (!voidableStatuses.includes(envelope.status)) {
          results.push({
            envelopeId,
            title: envelope.title,
            previousStatus: envelope.status,
            voided: false,
            error: `Status '${envelope.status}' cannot be voided`,
          });
          continue;
        }

        if (!dryRun) {
          await updateEnvelopeStatus(envelopeId, 'voided', {
            voided_at: new Date().toISOString(),
            void_reason: reason,
          });
          await logAuditEvent({
            envelopeId,
            actorType: 'sender_user',
            actorId: ctx.user.id,
            action: 'envelope_voided_bulk',
            metadata: { reason, previousStatus: envelope.status },
          });
        }

        results.push({
          envelopeId,
          title: envelope.title,
          previousStatus: envelope.status,
          voided: !dryRun,
        });
      } catch (err) {
        results.push({
          envelopeId,
          title: 'Unknown',
          previousStatus: '',
          voided: false,
          error: getErrMsg(err),
        });
      }
    }

    // Admin audit trail for live runs (non-blocking — §12.2)
    if (!dryRun) {
      AdminAuditService.record({
        actorId: ctx.user.id,
        actorRole: 'admin',
        category: 'bulk_operation',
        action: 'esign_bulk_void',
        summary: `Bulk void: ${results.filter((r) => r.voided).length} of ${envelopeIds.length} envelopes voided`,
        severity: 'critical',
        entityType: 'envelope',
        metadata: {
          reason,
          envelopeCount: envelopeIds.length,
          voidedCount: results.filter((r) => r.voided).length,
        },
      }).catch(() => {});
    }

    return c.json({
      success: true,
      dryRun,
      envelopeCount: envelopeIds.length,
      voidedCount: dryRun
        ? results.filter((r) => !r.error).length
        : results.filter((r) => r.voided).length,
      results,
    });
  } catch (error: unknown) {
    log.error('Bulk void error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Bulk void failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

export default opsRoutes;
