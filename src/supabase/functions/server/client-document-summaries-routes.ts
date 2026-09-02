/**
 * Client Document Summary Routes
 *
 * The AI document timeline on the client's Documents tab.
 *
 *   GET    /client-document-summaries/:clientId              — timeline + batches
 *   POST   /client-document-summaries/:clientId/generate     — summarise one batch
 *   PATCH  /client-document-summaries/:clientId/:summaryId   — edit (super admin)
 *   DELETE /client-document-summaries/:clientId/:summaryId   — remove (super admin)
 *   POST   /client-document-summaries/maintenance/weekly-scan — the scheduled job
 *
 * AUTH SHAPE
 * ----------
 * Guards are per-route rather than a router-wide `use('*')`, because the
 * maintenance route authenticates as a cron job and everything else
 * authenticates as a person. A wildcard would have to let one of them through
 * unguarded.
 *
 * Reads and generation are open to anyone who may already see the client's
 * documents (`requireClientAccess` — the client themselves, a platform admin,
 * or the assigned adviser). EDITING IS SUPER ADMIN ONLY: the summary is the
 * record of what was done for the client, so who may rewrite it is a narrower
 * question than who may read it.
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireSuperAdmin } from './auth-mw.ts';
import { requireClientAccess, isPlatformAdminRole } from './client-access.ts';
import { requireCronAuth } from './cron-auth.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  GenerateSummarySchema,
  UpdateSummarySchema,
  WeeklyScanSchema,
} from './client-document-summaries-validation.ts';
import {
  deleteSummary,
  generateSummaryForGroup,
  listGroupsWithSummaries,
  runWeeklySummaryScan,
  updateSummary,
} from './client-document-summaries-service.ts';

const app = new Hono();
const log = createModuleLogger('client-doc-summaries-routes');

/** True when the caller's resolved role is a super admin. */
function isSuperAdminRole(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'super-admin';
}

app.get('/', (c) => c.json({ service: 'client-document-summaries', status: 'active' }));

// ---------------------------------------------------------------------------
// Scheduled scan — registered before the /:clientId routes (§14.2)
// ---------------------------------------------------------------------------

/**
 * POST /client-document-summaries/maintenance/weekly-scan
 *
 * Summarises every document batch uploaded in the lookback window that has no
 * summary yet. Intended for a Saturday pg_cron job sending `dryRun: false`.
 * See docs/runbooks/scheduled-jobs.md.
 */
app.post(
  '/maintenance/weekly-scan',
  requireCronAuth,
  asyncHandler(async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = WeeklyScanSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('Weekly summary scan requested', parsed.data);
    const report = await runWeeklySummaryScan({ ...parsed.data, actorId: 'scheduled' });
    return c.json({ success: true, report });
  }),
);

// ---------------------------------------------------------------------------
// Client-scoped reads + generation
// ---------------------------------------------------------------------------

/**
 * GET /client-document-summaries/:clientId
 *
 * Returns the stored timeline plus the client's document batches, so the tab
 * can show which batches are still unsummarised without a second round-trip.
 * `canEdit` is the server's answer to "may this caller rewrite a summary" —
 * the UI must not decide that for itself.
 */
app.get(
  '/:clientId',
  requireAuth,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId')!;
    const denied = await requireClientAccess(c, clientId);
    if (denied) return denied;

    const role = c.get('userRole');
    const { groups, summaries } = await listGroupsWithSummaries(clientId);

    return c.json({
      success: true,
      summaries,
      batches: groups.map((group) => ({
        key: group.key,
        scope: group.scope,
        packId: group.packId,
        title: group.title,
        documentDate: group.documentDate,
        documentCount: group.documents.length,
        hasSummary: summaries.some((summary) => summary.id === group.key),
      })),
      canEdit: isSuperAdminRole(role),
      canGenerate: isPlatformAdminRole(role) || role === 'adviser',
    });
  }),
);

/**
 * POST /client-document-summaries/:clientId/generate
 *
 * Summarise one batch on demand. Returns the existing summary untouched when
 * one is already stored and `force` was not set.
 */
app.post(
  '/:clientId/generate',
  requireAuth,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId')!;
    const denied = await requireClientAccess(c, clientId);
    if (denied) return denied;

    const role = c.get('userRole');
    // A client may read their own timeline but may not spend the practice's
    // AI budget generating entries on it.
    if (!isPlatformAdminRole(role) && role !== 'adviser') {
      return c.json(
        { success: false, error: 'Forbidden: staff access required', code: 'FORBIDDEN_STAFF' },
        403,
      );
    }

    const raw = await c.req.json().catch(() => ({}));
    const parsed = GenerateSummarySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    // Re-generating over an edited summary discards a human's wording, so only
    // a super admin may force it.
    if (parsed.data.force && !isSuperAdminRole(role)) {
      return c.json(
        {
          success: false,
          error: 'Forbidden: only a super admin may regenerate an existing summary',
          code: 'FORBIDDEN_SUPER_ADMIN',
        },
        403,
      );
    }

    const { summary, created } = await generateSummaryForGroup({
      clientId,
      packId: parsed.data.packId,
      documentId: parsed.data.documentId,
      force: parsed.data.force,
      source: 'manual',
      actorId: c.get('userId') || 'unknown',
    });

    return c.json({ success: true, summary, created });
  }),
);

// ---------------------------------------------------------------------------
// Super-admin edits
// ---------------------------------------------------------------------------

/**
 * PATCH /client-document-summaries/:clientId/:summaryId
 *
 * Super admin only. The model's original wording is preserved on the record
 * the first time it is overwritten.
 */
app.patch(
  '/:clientId/:summaryId',
  requireSuperAdmin,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId')!;
    const summaryId = c.req.param('summaryId')!;

    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdateSummarySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const actorId = c.get('userId') || 'unknown';
    const updated = await updateSummary(clientId, summaryId, parsed.data, actorId);
    if (!updated) {
      return c.json({ success: false, error: 'Summary not found' }, 404);
    }

    await AdminAuditService.record({
      actorId,
      actorRole: c.get('userRole') || 'super_admin',
      category: 'client_lifecycle',
      action: 'document_summary_edited',
      summary: 'Super admin edited an AI document summary',
      entityType: 'document_summary',
      entityId: summaryId,
      metadata: { clientId, fields: Object.keys(parsed.data) },
    });

    return c.json({ success: true, summary: updated });
  }),
);

/**
 * DELETE /client-document-summaries/:clientId/:summaryId
 *
 * Super admin only. The next scan will re-create the entry from the documents,
 * which is the point — deleting is how you discard a bad summary.
 */
app.delete(
  '/:clientId/:summaryId',
  requireSuperAdmin,
  asyncHandler(async (c) => {
    const clientId = c.req.param('clientId')!;
    const summaryId = c.req.param('summaryId')!;

    const removed = await deleteSummary(clientId, summaryId);
    if (!removed) {
      return c.json({ success: false, error: 'Summary not found' }, 404);
    }

    await AdminAuditService.record({
      actorId: c.get('userId') || 'unknown',
      actorRole: c.get('userRole') || 'super_admin',
      category: 'client_lifecycle',
      action: 'document_summary_deleted',
      summary: 'Super admin deleted an AI document summary',
      entityType: 'document_summary',
      entityId: summaryId,
      metadata: { clientId },
    });

    return c.json({ success: true });
  }),
);

export default app;
