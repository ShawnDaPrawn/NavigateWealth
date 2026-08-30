/**
 * Newsletter Studio — Route Handlers
 *
 * §4.2 — thin dispatchers: parse/validate input, call the service, return.
 * Admin surface is requireAdmin throughout; the cron tick uses the shared
 * Vault-backed requireCronAuth; the click-through ping is deliberately
 * public (recipients are not signed in) and is classified as such in
 * __tests__/route-auth-classification.ts.
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
  cancelCampaign,
  createCampaign,
  createTemplate,
  deleteCampaign,
  deleteTemplate,
  duplicateCampaign,
  getCampaignRecipients,
  getCampaignStats,
  getCampaignView,
  getDashboardSummary,
  listAudienceLists,
  listCampaigns,
  listTemplates,
  pauseCampaign,
  recordCampaignClick,
  resumeCampaign,
  scheduleCampaign,
  sendCampaignNow,
  unsubscribeByRecipientToken,
  updateCampaign,
  updateTemplate,
} from './newsletter-studio-service.ts';
import {
  processNewsletterCampaigns,
  sendCampaignTestEmails,
} from './newsletter-studio-processor.ts';
import {
  CreateNewsletterCampaignSchema,
  NewsletterTemplateSchema,
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
    audit(c, 'newsletter_campaign_created', 'Newsletter campaign created', campaign.id);
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
    audit(c, 'newsletter_campaign_updated', 'Newsletter campaign updated', campaign.id);
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
    audit(c, 'newsletter_campaign_deleted', 'Newsletter campaign deleted', id);
    return c.json({ success: true });
  }),
);

app.post(
  '/campaigns/:id/duplicate',
  requireAdmin,
  requireNewsletterCapability('create'),
  asyncHandler(async (c) => {
    const adminUserId = (c.get('userId') as string) || 'unknown';
    const campaign = await duplicateCampaign(c.req.param('id')!, adminUserId);
    audit(c, 'newsletter_campaign_duplicated', 'Newsletter campaign duplicated', campaign.id);
    return c.json({ success: true, campaign }, 201);
  }),
);

app.post(
  '/campaigns/:id/test',
  requireAdmin,
  requireNewsletterCapability('send'),
  validateBody(TestSendNewsletterCampaignSchema),
  asyncHandler(async (c) => {
    const { emails } = body(c, TestSendNewsletterCampaignSchema);
    const results = await sendCampaignTestEmails(c.req.param('id')!, emails);
    audit(c, 'newsletter_campaign_test_sent', 'Newsletter campaign test send', c.req.param('id')!, {
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
    audit(c, 'newsletter_campaign_scheduled', 'Newsletter campaign scheduled', campaign.id, {
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
    audit(
      c,
      'newsletter_campaign_send_queued',
      'Newsletter campaign queued for delivery',
      campaign.id,
      {
        recipientCount: campaign.recipientCount,
      },
    );
    // Kick a first delivery pass immediately so small sends complete without
    // waiting for cron. Best-effort — cron remains the authoritative driver.
    processNewsletterCampaigns({ mode: 'manual' }).catch((error) => {
      log.warn('Inline processor kick failed (cron will pick up)', { error: String(error) });
    });
    return c.json({ success: true, campaign });
  }),
);

app.post(
  '/campaigns/:id/pause',
  requireAdmin,
  requireNewsletterCapability('send'),
  asyncHandler(async (c) => {
    const campaign = await pauseCampaign(c.req.param('id')!);
    audit(c, 'newsletter_campaign_paused', 'Newsletter campaign paused', campaign.id);
    return c.json({ success: true, campaign });
  }),
);

app.post(
  '/campaigns/:id/resume',
  requireAdmin,
  requireNewsletterCapability('send'),
  asyncHandler(async (c) => {
    const campaign = await resumeCampaign(c.req.param('id')!);
    audit(c, 'newsletter_campaign_resumed', 'Newsletter campaign resumed', campaign.id);
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
    audit(c, 'newsletter_campaign_cancelled', 'Newsletter campaign cancelled', campaign.id);
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

// ── Templates ────────────────────────────────────────────────────────────────

app.get(
  '/templates',
  requireAdmin,
  requireNewsletterCapability('view'),
  asyncHandler(async (c) => {
    const templates = await listTemplates();
    return c.json({ success: true, templates });
  }),
);

app.post(
  '/templates',
  requireAdmin,
  requireNewsletterCapability('create'),
  validateBody(NewsletterTemplateSchema),
  asyncHandler(async (c) => {
    const input = body(c, NewsletterTemplateSchema);
    const adminUserId = (c.get('userId') as string) || 'unknown';
    const template = await createTemplate(input, adminUserId);
    audit(c, 'newsletter_template_created', 'Newsletter template created', template.id);
    return c.json({ success: true, template }, 201);
  }),
);

app.put(
  '/templates/:id',
  requireAdmin,
  requireNewsletterCapability('create'),
  validateBody(NewsletterTemplateSchema),
  asyncHandler(async (c) => {
    const input = body(c, NewsletterTemplateSchema);
    const template = await updateTemplate(c.req.param('id')!, input);
    audit(c, 'newsletter_template_updated', 'Newsletter template updated', template.id);
    return c.json({ success: true, template });
  }),
);

app.delete(
  '/templates/:id',
  requireAdmin,
  requireNewsletterCapability('delete'),
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    await deleteTemplate(id);
    audit(c, 'newsletter_template_deleted', 'Newsletter template deleted', id);
    return c.json({ success: true });
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

/** Authoritative pg_cron tick — see supabase/cron/newsletter-studio-jobs.sql. */
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
 * Records a recipient's click and returns the stored destination. Public by
 * design: email recipients hold no session. The destination is server-stored
 * at queue time, so this can never act as an open redirect; unknown ids
 * return 404 with no detail.
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
