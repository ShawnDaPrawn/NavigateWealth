/**
 * Portal-worker routes for job lifecycle and hand-back: job status
 * transitions, live-view frames, OTP retrieval, the discovery report, and
 * staging extracted rows into the sync engine.
 * Mounted by integrations-portal-worker-routes.ts.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { applyTemplateRowMetadata } from './integrations-spreadsheet.ts';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import {
  summarisePortalJobItems,
  loadPortalJobItems,
  sanitisePortalWarnings,
  latestPortalWarning,
  stagePortalRows,
  portalRowHasBusinessValue,
  portalItemHasStageableBusinessValue,
} from './integrations-sync-engine.ts';
import type {
  PortalJobStatus,
  PortalSyncJob,
  PortalDiscoveryReport,
} from './integrations-portal-types.ts';
import { persistPortalLiveViewUpdate } from './integrations-portal-worker-shared.ts';

const log = createModuleLogger('integrations-portal-worker-routes');

const app = new Hono();

// POST /portal-worker/jobs/:jobId/status
app.post('/portal-worker/jobs/:jobId/status', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const allowedStatuses: PortalJobStatus[] = [
      'queued',
      'running',
      'waiting_for_otp',
      'discovering',
      'discovery_ready',
      'extracting',
      'dry_run_ready',
      'staging',
      'staged',
      'failed',
      'cancelled',
    ];
    const status = allowedStatuses.includes(body?.status)
      ? (body.status as PortalJobStatus)
      : job.status;
    const warnings = sanitisePortalWarnings(body?.warnings ?? body?.warning, job.warnings);
    const updated: PortalSyncJob = {
      ...job,
      status,
      updatedAt: new Date().toISOString(),
      startedAt: job.startedAt || (status !== 'queued' ? new Date().toISOString() : undefined),
      completedAt: ['discovery_ready', 'dry_run_ready', 'staged', 'failed', 'cancelled'].includes(
        status,
      )
        ? new Date().toISOString()
        : undefined,
      currentStep: typeof body?.currentStep === 'string' ? body.currentStep : job.currentStep,
      message: typeof body?.message === 'string' ? body.message.slice(0, 500) : job.message,
      extractedRows:
        typeof body?.extractedRows === 'number' ? body.extractedRows : job.extractedRows,
      error: typeof body?.error === 'string' ? body.error.slice(0, 1000) : job.error,
      warnings,
      warning: latestPortalWarning(warnings),
    };

    await kv.set(`portal-job:${jobId}`, updated);
    return c.json({ success: true, job: updated });
  } catch (e) {
    log.error('Portal worker status error:', e);
    return c.json({ error: `Failed to update portal job: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/live-view
app.post('/portal-worker/jobs/:jobId/live-view', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Portal worker live view parse error:', parseErr);
      return c.json(
        { error: 'Invalid form data. Expected multipart/form-data with a screenshot file.' },
        400,
      );
    }

    const result = await persistPortalLiveViewUpdate(c.req.param('jobId')!, formData);
    if ('error' in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return c.json({ success: true, job: result.job });
  } catch (e) {
    log.error('Portal worker live view upload error:', e);
    return c.json({ error: `Failed to upload portal live view: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-worker/jobs/:jobId/otp
app.get('/portal-worker/jobs/:jobId/otp', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const otpEntry = (await kv.get(`portal-job-otp:${jobId}`)) as {
      otp: string;
      expiresAt: string;
    } | null;
    if (!otpEntry) {
      return c.json({ success: true, otp: null });
    }
    if (new Date(otpEntry.expiresAt).getTime() < Date.now()) {
      await kv.del(`portal-job-otp:${jobId}`);
      return c.json({ success: true, otp: null, expired: true });
    }
    await kv.del(`portal-job-otp:${jobId}`);
    return c.json({ success: true, otp: otpEntry.otp });
  } catch (e) {
    log.error('Portal worker OTP fetch error:', e);
    return c.json({ error: `Failed to fetch OTP: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/discovery-report
app.post('/portal-worker/jobs/:jobId/discovery-report', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const body = await c.req.json();
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const mode = body?.mode === 'dry-run' ? 'dry-run' : 'discover';
    const now = new Date().toISOString();
    const report: PortalDiscoveryReport = {
      id: crypto.randomUUID(),
      jobId,
      providerId: job.providerId,
      categoryId: job.categoryId,
      createdAt: now,
      mode,
      urlHost: String(body?.urlHost || '').slice(0, 200),
      title: typeof body?.title === 'string' ? body.title.slice(0, 200) : undefined,
      summary: {
        inputCount: Number(body?.summary?.inputCount || 0),
        buttonCount: Number(body?.summary?.buttonCount || 0),
        linkCount: Number(body?.summary?.linkCount || 0),
        tableCount: Number(body?.summary?.tableCount || 0),
        candidatePolicyTables: Number(body?.summary?.candidatePolicyTables || 0),
        extractedRowCount:
          typeof body?.summary?.extractedRowCount === 'number'
            ? body.summary.extractedRowCount
            : undefined,
      },
      selectorCandidates: Array.isArray(body?.selectorCandidates)
        ? body.selectorCandidates.slice(0, 200).map((candidate: Record<string, unknown>) => ({
            purpose: ['input', 'button', 'link', 'table', 'policy_row', 'field'].includes(
              String(candidate.purpose),
            )
              ? (candidate.purpose as PortalDiscoveryReport['selectorCandidates'][number]['purpose'])
              : 'field',
            selector: String(candidate.selector || '').slice(0, 500),
            tag: typeof candidate.tag === 'string' ? candidate.tag.slice(0, 40) : undefined,
            type: typeof candidate.type === 'string' ? candidate.type.slice(0, 80) : undefined,
            role: typeof candidate.role === 'string' ? candidate.role.slice(0, 80) : undefined,
            label: typeof candidate.label === 'string' ? candidate.label.slice(0, 120) : undefined,
            confidence: ['low', 'medium', 'high'].includes(String(candidate.confidence))
              ? (candidate.confidence as 'low' | 'medium' | 'high')
              : 'low',
            notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 300) : undefined,
          }))
        : [],
      tableSummaries: Array.isArray(body?.tableSummaries)
        ? body.tableSummaries.slice(0, 50).map((table: Record<string, unknown>) => ({
            selector: String(table.selector || '').slice(0, 500),
            headerTexts: Array.isArray(table.headerTexts)
              ? table.headerTexts.slice(0, 30).map((header) => String(header).slice(0, 120))
              : [],
            rowCount: Number(table.rowCount || 0),
          }))
        : [],
      warnings: Array.isArray(body?.warnings)
        ? body.warnings.slice(0, 50).map((warning: unknown) => String(warning).slice(0, 300))
        : [],
    };

    await kv.set(`portal-discovery-report:${report.id}`, report);
    await kv.set(`portal-discovery-report:latest:${jobId}`, {
      reportId: report.id,
      updatedAt: now,
    });

    const updatedJob: PortalSyncJob = {
      ...job,
      status: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      updatedAt: now,
      completedAt: now,
      currentStep: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      message:
        mode === 'dry-run'
          ? `Dry run completed. ${report.summary.extractedRowCount || 0} rows would be extracted; no policies were updated.`
          : 'Discovery report captured. Review selector candidates before staging provider data.',
      extractedRows: report.summary.extractedRowCount ?? job.extractedRows,
      discoveryReportId: report.id,
    };
    await kv.set(`portal-job:${jobId}`, updatedJob);

    return c.json({ success: true, job: updatedJob, report });
  } catch (e) {
    log.error('Portal worker discovery report error:', e);
    return c.json({ error: `Failed to save discovery report: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/stage-items
app.post('/portal-worker/jobs/:jobId/stage-items', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const items = await loadPortalJobItems(jobId);
    const rawRows = items
      .filter(
        (item) =>
          item.status === 'completed' && item.rawData && Object.keys(item.rawData).length > 0,
      )
      .map((item) => ({
        item,
        row: applyTemplateRowMetadata(item.rawData as Record<string, unknown>, {
          policyId: item.policyId,
          clientId: item.clientId,
          providerId: item.providerId,
          categoryId: item.categoryId,
          normalizedPolicyNumber: item.normalizedPolicyNumber,
        }),
      }))
      .filter(({ item, row }) => portalItemHasStageableBusinessValue(item, row))
      .map(({ row }) => row);

    if (rawRows.length === 0) {
      return c.json(
        {
          error:
            'No completed policy items have extracted stageable values. Allan Gray rows must include a mapped current value.',
        },
        400,
      );
    }

    const { job, stagedRun } = await stagePortalRows(jobId, rawRows);
    const summary = summarisePortalJobItems(items);
    const message =
      summary.failed > 0
        ? `Staged ${rawRows.length} completed policy updates. ${summary.failed} policy${summary.failed === 1 ? '' : 'ies'} need review or retry.`
        : `Staged ${rawRows.length} completed policy updates for review.`;
    const updatedJob: PortalSyncJob = {
      ...job,
      queueSummary: summary,
      message,
    };
    await kv.set(`portal-job:${jobId}`, updatedJob);

    return c.json({ success: true, job: updatedJob, stagedRun, summary });
  } catch (e) {
    log.error('Portal worker item staging error:', e);
    return c.json({ error: `Failed to stage completed policy items: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/stage
app.post('/portal-worker/jobs/:jobId/stage', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const body = await c.req.json();
    const rawRows = Array.isArray(body?.rows)
      ? (body.rows as Record<string, unknown>[]).filter((row) => portalRowHasBusinessValue(row))
      : [];
    if (rawRows.length === 0) {
      return c.json({ error: 'No portal rows contained extracted business values to stage' }, 400);
    }
    const { job, stagedRun } = await stagePortalRows(jobId, rawRows);
    return c.json({ success: true, job, stagedRun });
  } catch (e) {
    log.error('Portal worker staging error:', e);
    return c.json({ error: `Failed to stage portal rows: ${getErrMsg(e)}` }, 500);
  }
});
export default app;
