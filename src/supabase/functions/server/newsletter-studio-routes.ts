/**
 * Newsletter Studio — Route Handlers
 *
 * §4.2 — thin dispatchers: parse/validate input, call the service, return.
 * Admin surface is requireAdmin throughout; the cron tick uses the shared
 * Vault-backed requireCronAuth; the click-through ping and the one-click
 * unsubscribe are deliberately public (recipients are not signed in) and are
 * classified as such in __tests__/route-auth-classification.ts.
 *
 * The routine's hand-over endpoint lives in newsletter-intake-routes.ts so
 * its machine-token gate never touches this admin surface.
 */

import { Hono } from 'npm:hono';
import type { Context, Next } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { requireCronAuth } from './cron-auth.ts';
import { asyncHandler } from './error.middleware.ts';
import { body, query, validateBody, validateOptionalBody, validateQuery } from './validate.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { PermissionsService } from './personnel-permissions-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  attachCampaignPdf,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaignPdfUrl,
  getCampaignRecipients,
  getCampaignStats,
  getCampaignView,
  getDashboardSummary,
  listAudienceLists,
  listCampaigns,
  recordCampaignClick,
  resumeCampaign,
  scheduleCampaign,
  sendCampaignNow,
  unsubscribeByRecipientToken,
  updateCampaign,
} from './newsletter-studio-service.ts';
import {
  processNewsletterCampaigns,
  sendCampaignTestEmails,
} from './newsletter-studio-processor.ts';
import { MAX_NEWSLETTER_PDF_BYTES } from './newsletter-studio-storage.ts';
import {
  CreateNewsletterCampaignSchema,
  NewsletterTrackClickSchema,
  OneClickUnsubscribeQuerySchema,
  ProcessNewsletterCampaignsSchema,
  ScheduleNewsletterCampaignSchema,
  TestSendNewsletterCampaignSchema,
  UpdateNewsletterCampaignSchema,
} from './newsletter-studio-validation.ts';

const app = new Hono();
const log = createModuleLogger('newsletter-studio-routes');

/**
 * Server-side capability gate layered on requireAdmin, mirroring the
 * requireCapability precedent in client-management-personnel-routes.ts —
 * the client-side canDo() check is UX only (Guidelines §6.1) and must be
 * enforced here too (review finding). Super admins always pass; other
 * admins need the capability granted in their stored permission set (an
 * empty capability list means full access within a granted module).
 * Reads the context requireAdmin populated — no extra auth resolution.
 *
 * READS ARE GATED TOO, on 'view'. Campaign reads return recipient email
 * addresses, delivery errors and engagement history — personal data whose
 * exposure the admin ROLE alone must not authorise (second review finding).
 * `hasCapability` grants 'view' whenever the module itself is accessible, so
 * this denies exactly the admins whose permission set withholds the
 * newsletter module — the same set the sidebar already hides it from.
 */
function requireNewsletterCapability(capability: 'view' | 'create' | 'send' | 'delete') {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as { email?: string } | undefined;
    if (user?.email && PermissionsService.isSuperAdmin(user.email)) return next();

    const userId = (c.get('userId') as string) || '';
    if (userId && (await PermissionsService.hasCapability(userId, 'newsletter', capability))) {
      return next();
    }
    return c.json(
      { error: `Forbidden: missing '${capability}' capability on the newsletter module` },
      403,
    );
  };
}

function audit(
  c: { get: (key: string) => unknown },
  action: string,
  summary: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  AdminAuditService.record({
    actorId: (c.get('userId') as string) || 'unknown',
    actorRole: 'admin',
    category: 'communication',
    action,
    summary,
    severity: 'info',
    entityType: 'newsletter_campaign',
    entityId,
    metadata,
  }).catch(() => {});
}

const isUploadedFile = (value: unknown): value is File =>
  value instanceof File ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).name === 'string' &&
    typeof (value as File).size === 'number');

// ── Dashboard ────────────────────────────────────────────────────────────────

app.get(
  '/dashboard',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const data = await getDashboardSummary();
    return c.json({ success: true, data });
  }),
);

// ── Campaigns ────────────────────────────────────────────────────────────────

app.get(
  '/campaigns',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const result = await listCampaigns({
      page: Number(c.req.query('page')) || 1,
      limit: Number(c.req.query('limit')) || 25,
      status: c.req.query('status') || undefined,
      search: c.req.query('search') || undefined,
    });
    return c.json({ success: true, ...result });
  }),
);

app.post(
  '/campaigns',
  requireAdmin,
  requireNewsletterCapability('create'),
  validateBody(CreateNewsletterCampaignSchema),
  asyncHandler(async (c) => {
    const input = body(c, CreateNewsletterCampaignSchema);
    const adminUserId = (c.get('userId') as string) || 'unknown';
    const campaign = await createCampaign(input, adminUserId);
    audit(c, 'newsletter_campaign_created', 'Newsletter draft created', campaign.id);
    return c.json({ success: true, campaign }, 201);
  }),
);

app.get(
  '/campaigns/:id',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const campaign = await getCampaignView(c.req.param('id')!);
    return c.json({ success: true, campaign });
  }),
);

app.put(
  '/campaigns/:id',
  requireAdmin,
  requireNewsletterCapability('create'),
  validateBody(UpdateNewsletterCampaignSchema),
  asyncHandler(async (c) => {
    const patch = body(c, UpdateNewsletterCampaignSchema);
    const campaign = await updateCampaign(c.req.param('id')!, patch);
    audit(c, 'newsletter_campaign_updated', 'Newsletter draft updated', campaign.id);
    return c.json({ success: true, campaign });
  }),
);

app.delete(
  '/campaigns/:id',
  requireAdmin,
  requireNewsletterCapability('delete'),
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    await deleteCampaign(id);
    audit(c, 'newsletter_campaign_deleted', 'Newsletter deleted', id);
    return c.json({ success: true });
  }),
);

// ── The PDF ──────────────────────────────────────────────────────────────────

/** Upload or replace the newsletter PDF (multipart `file`). */
app.post(
  '/campaigns/:id/pdf',
  requireAdmin,
  requireNewsletterCapability('create'),
  asyncHandler(async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!isUploadedFile(file)) {
      return c.json({ error: 'Attach the newsletter PDF as the "file" field.' }, 400);
    }
    if (file.size > MAX_NEWSLETTER_PDF_BYTES) {
      return c.json(
        {
          error: `The PDF is too large; the limit is ${MAX_NEWSLETTER_PDF_BYTES / (1024 * 1024)} MB.`,
        },
        400,
      );
    }
    const campaign = await attachCampaignPdf(c.req.param('id')!, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name || 'newsletter.pdf',
    });
    audit(c, 'newsletter_campaign_pdf_uploaded', 'Newsletter PDF uploaded', campaign.id, {
      sizeBytes: campaign.pdf?.sizeBytes,
    });
    return c.json({ success: true, campaign });
  }),
);

/** Short-lived signed URL for the admin's own preview of the PDF. */
app.get(
  '/campaigns/:id/pdf',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const pdf = await getCampaignPdfUrl(c.req.param('id')!);
    return c.json({ success: true, ...pdf });
  }),
);

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.post(
  '/campaigns/:id/test',
  requireAdmin,
  requireNewsletterCapability('send'),
  validateBody(TestSendNewsletterCampaignSchema),
  asyncHandler(async (c) => {
    const { emails } = body(c, TestSendNewsletterCampaignSchema);
    const results = await sendCampaignTestEmails(c.req.param('id')!, emails);
    audit(c, 'newsletter_campaign_test_sent', 'Newsletter test send', c.req.param('id')!, {
      recipients: emails.length,
      failures: results.filter((r) => !r.ok).length,
    });
    return c.json({ success: true, results });
  }),
);

app.post(
  '/campaigns/:id/schedule',
  requireAdmin,
  requireNewsletterCapability('send'),
  validateBody(ScheduleNewsletterCampaignSchema),
  asyncHandler(async (c) => {
    const { scheduledAt } = body(c, ScheduleNewsletterCampaignSchema);
    const campaign = await scheduleCampaign(c.req.param('id')!, scheduledAt);
    audit(c, 'newsletter_campaign_scheduled', 'Newsletter scheduled', campaign.id, {
      scheduledAt,
    });
    return c.json({ success: true, campaign });
  }),
);

app.post(
  '/campaigns/:id/send-now',
  requireAdmin,
  requireNewsletterCapability('send'),
  asyncHandler(async (c) => {
    const campaign = await sendCampaignNow(c.req.param('id')!);
    audit(c, 'newsletter_campaign_send_queued', 'Newsletter queued for delivery', campaign.id, {
      recipientCount: campaign.recipientCount,
    });
    // Kick a first delivery pass immediately so small sends complete without
    // waiting for cron. Best-effort — cron remains the authoritative driver.
    processNewsletterCampaigns({ mode: 'manual' }).catch((error) => {
      log.warn('Inline processor kick failed (cron will pick up)', { error: String(error) });
    });
    return c.json({ success: true, campaign });
  }),
);

/** Retry a newsletter the processor stopped on a sender/provider fault. */
app.post(
  '/campaigns/:id/resume',
  requireAdmin,
  requireNewsletterCapability('send'),
  asyncHandler(async (c) => {
    const campaign = await resumeCampaign(c.req.param('id')!);
    audit(c, 'newsletter_campaign_resumed', 'Newsletter delivery retried', campaign.id);
    processNewsletterCampaigns({ mode: 'manual' }).catch((error) => {
      log.warn('Inline processor kick failed (cron will pick up)', { error: String(error) });
    });
    return c.json({ success: true, campaign });
  }),
);

app.post(
  '/campaigns/:id/cancel',
  requireAdmin,
  requireNewsletterCapability('send'),
  asyncHandler(async (c) => {
    const campaign = await cancelCampaign(c.req.param('id')!);
    audit(c, 'newsletter_campaign_cancelled', 'Newsletter cancelled', campaign.id);
    return c.json({ success: true, campaign });
  }),
);

app.get(
  '/campaigns/:id/recipients',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const result = await getCampaignRecipients(c.req.param('id')!, {
      page: Number(c.req.query('page')) || 1,
      limit: Number(c.req.query('limit')) || 50,
      status: c.req.query('status') || undefined,
    });
    return c.json({ success: true, ...result });
  }),
);

app.get(
  '/campaigns/:id/stats',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const stats = await getCampaignStats(c.req.param('id')!);
    return c.json({ success: true, stats });
  }),
);

// ── Lists (audiences) ────────────────────────────────────────────────────────

app.get(
  '/lists',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const lists = await listAudienceLists();
    return c.json({ success: true, lists });
  }),
);

// ── Processor ────────────────────────────────────────────────────────────────

/** Manual/accelerator tick from the admin UI. */
app.post(
  '/process',
  requireAdmin,
  requireNewsletterCapability('send'),
  validateOptionalBody(ProcessNewsletterCampaignsSchema),
  asyncHandler(async (c) => {
    const options = body(c, ProcessNewsletterCampaignsSchema);
    const result = await processNewsletterCampaigns({ ...options, mode: 'manual' });
    return c.json({ success: true, result });
  }),
);

/**
 * Authoritative pg_cron tick — see supabase/cron/newsletter-studio-jobs.sql.
 * Also sweeps the SQL intake table for routine hand-overs.
 */
app.post(
  '/cron/process',
  requireCronAuth,
  validateOptionalBody(ProcessNewsletterCampaignsSchema),
  asyncHandler(async (c) => {
    const options = body(c, ProcessNewsletterCampaignsSchema);
    const result = await processNewsletterCampaigns({ ...options, mode: 'cron' });
    return c.json({ success: true, result });
  }),
);

// ── Public click-through ─────────────────────────────────────────────────────

/**
 * Records a recipient's read and returns a short-lived signed URL for the
 * campaign's own stored PDF. Public by design: email recipients hold no
 * session. The only destination is the campaign's PDF object — never caller
 * input, so this can never act as an open redirect; unknown ids return 404
 * with no detail.
 */
app.post(
  '/track/click',
  validateBody(NewsletterTrackClickSchema),
  asyncHandler(async (c) => {
    const { campaignId, token, linkId } = body(c, NewsletterTrackClickSchema);
    const outcome = await recordCampaignClick(campaignId, token, linkId);
    if (!outcome) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true, url: outcome.url });
  }),
);

/**
 * RFC 8058 one-click unsubscribe target — the URL carried in every campaign's
 * List-Unsubscribe header. Mailbox providers POST here on the recipient's
 * behalf with a form-encoded body and no session, so identification rides in
 * query params and no body is read. Public by design (classified); the
 * opaque per-recipient token is the capability; unknown ids 404 with no
 * detail. The human-facing footer link stays on the SPA unsubscribe page.
 */
app.post(
  '/unsubscribe-oneclick',
  validateQuery(OneClickUnsubscribeQuerySchema),
  asyncHandler(async (c) => {
    const { c: campaignId, t: token } = query(c, OneClickUnsubscribeQuerySchema);
    const outcome = await unsubscribeByRecipientToken(campaignId, token);
    if (!outcome) return c.json({ error: 'Not found' }, 404);
    log.info('One-click unsubscribe processed', { campaignId });
    return c.json({ success: true });
  }),
);

export default app;
