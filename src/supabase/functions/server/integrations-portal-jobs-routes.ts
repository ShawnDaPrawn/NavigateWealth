import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAuth } from './auth-mw.ts';
import {
  normaliseRunMode,
  dispatchPortalGitHubAction,
  uploadPortalLiveView,
} from './integrations-portal-runtime.ts';
import {
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
} from './integrations-portal-flow-config.ts';
import {
  normalisePortalCredentialProfileId,
  loadPortalCredentialRecord,
} from './integrations-portal-credentials.ts';
import {
  getPortalAutomationCategoryError,
  portalArtifactsMatchCategory,
} from './integrations-portal-guards.ts';
import {
  getPortalJobScopeError,
  getPortalFlow,
  sanitisePortalFlow,
} from './integrations-portal-flow.ts';
import {
  summarisePortalJobItems,
  buildPortalPolicyQueue,
  loadPortalJobItems,
  sanitisePortalWarnings,
  latestPortalWarning,
  persistPortalJobItems,
  stagePortalRows,
} from './integrations-sync-engine.ts';
import { getSchemaForCategory } from './integrations-field-utils.ts';
import type { KvProvider } from './integrations-types.ts';
import type {
  PortalJobStatus,
  PortalAutomationHost,
  PortalSyncJob,
  PortalJobHistoryEntry,
  PortalDiscoveryReport,
} from './integrations-portal-types.ts';
import type { IntegrationSyncRun } from './integrations-core-types.ts';

const log = createModuleLogger('integrations-portal-jobs-routes');

const app = new Hono();

async function persistPortalLiveViewUpdate(jobId: string, formData: Record<string, string | File>) {
  const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
  if (!job) {
    return { error: 'Portal job not found', status: 404 as const };
  }

  const file = formData.file;
  if (!file || !(file instanceof File)) {
    return { error: 'No screenshot file provided', status: 400 as const };
  }

  const liveView = await uploadPortalLiveView(job, file, {
    pageUrl: formData.pageUrl,
    pageTitle: formData.pageTitle,
    note: formData.note,
  });

  const updatedJob: PortalSyncJob = {
    ...job,
    liveView,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`portal-job:${jobId}`, updatedJob);
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, {
    jobId: job.id,
    updatedAt: updatedJob.updatedAt,
  });
  return { job: updatedJob };
}

// POST /portal-jobs
app.post('/portal-jobs', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const providerId = String(body?.providerId || '');
    const categoryId = String(body?.categoryId || '');

    if (!providerId || !categoryId) {
      return c.json({ error: 'Missing providerId or categoryId' }, 400);
    }

    const automationCategoryError = getPortalAutomationCategoryError(categoryId);
    if (automationCategoryError) {
      return c.json({ error: automationCategoryError }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId);
    const credentialProfileId = normalisePortalCredentialProfileId(
      String(body?.credentialProfileId || flow.credentialProfiles[0]?.id || ''),
    );
    if (
      !credentialProfileId ||
      !flow.credentialProfiles.some((profile) => profile.id === credentialProfileId)
    ) {
      return c.json({ error: 'Invalid credential profile' }, 400);
    }
    const credentialRecord = await loadPortalCredentialRecord(providerId, credentialProfileId);
    if (!credentialRecord?.username || !credentialRecord?.password) {
      return c.json(
        { error: 'Save the provider portal username and password before creating a portal job' },
        400,
      );
    }

    const runMode = normaliseRunMode(body?.runMode);
    const requestedPolicySchedule = normalisePolicyScheduleConfig(
      body?.policySchedule,
      flow.policySchedule,
    );
    const requestedDocumentArtifacts = normaliseDocumentArtifactConfigs(
      body?.documentArtifacts,
      flow.documentArtifacts || [],
    );

    const now = new Date().toISOString();
    const job: PortalSyncJob = {
      id: crypto.randomUUID(),
      providerId,
      providerName: provider.name || 'Unknown Provider',
      categoryId,
      status: 'queued',
      runMode,
      automationHost: 'github_actions',
      flowId: flow.id,
      credentialProfileId,
      policySchedule: requestedPolicySchedule,
      documentArtifacts: requestedDocumentArtifacts,
      createdAt: now,
      updatedAt: now,
      currentStep: 'queued',
      message: 'Portal sync job queued. Starting GitHub Actions worker.',
    };

    const schema = await getSchemaForCategory(categoryId);
    const items = await buildPortalPolicyQueue(job, schema.fields || []);
    if (items.length === 0) {
      return c.json(
        {
          error: `No active ${provider.name || 'provider'} policies with policy numbers were found for this category. Add the policies in client profiles before starting portal automation.`,
        },
        400,
      );
    }

    job.queueSummary = summarisePortalJobItems(items);
    job.message = `Found ${items.length} active policy${items.length === 1 ? '' : 'ies'} to update. Starting GitHub Actions worker.`;

    await kv.set(`portal-job:${job.id}`, job);
    await kv.set(`portal-job-items:${job.id}`, items);
    await kv.set(`portal-job:latest:${providerId}:${categoryId}`, {
      jobId: job.id,
      updatedAt: now,
    });

    const dispatchPatch = await dispatchPortalGitHubAction(job).catch((error) => ({
      automationHost: 'manual' as PortalAutomationHost,
      actionsDispatchError: getErrMsg(error).slice(0, 500),
      message: `Portal job queued, but GitHub Actions did not start: ${getErrMsg(error)}`.slice(
        0,
        500,
      ),
    }));
    const finalJob: PortalSyncJob = {
      ...job,
      ...dispatchPatch,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`portal-job:${job.id}`, finalJob);

    return c.json({ success: true, job: finalJob, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error('Portal job create error:', e);
    return c.json({ error: `Failed to create portal job: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/latest
app.get('/portal-jobs/latest', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');
    const categoryId = c.req.query('categoryId');

    if (!providerId || !categoryId) {
      return c.json({ error: 'Missing providerId or categoryId' }, 400);
    }

    const latest = (await kv.get(`portal-job:latest:${providerId}:${categoryId}`)) as {
      jobId: string;
    } | null;
    if (!latest?.jobId) {
      return c.json({ success: true, job: null });
    }

    const job = (await kv.get(`portal-job:${latest.jobId}`)) as PortalSyncJob | null;
    if (!job || getPortalJobScopeError(job, providerId, categoryId)) {
      await kv.del(`portal-job:latest:${providerId}:${categoryId}`);
      return c.json({ success: true, job: null });
    }
    const stagedRun = job.stagedRunId
      ? ((await kv.get(`sync-run:${job.stagedRunId}`)) as IntegrationSyncRun | null)
      : null;
    const items = stagedRun ? [] : await loadPortalJobItems(job.id);
    if (!portalArtifactsMatchCategory(categoryId, { stagedRun, items })) {
      await kv.del(`portal-job:latest:${providerId}:${categoryId}`);
      return c.json({ success: true, job: null });
    }
    return c.json({ success: true, job });
  } catch (e) {
    log.error('Latest portal job fetch error:', e);
    return c.json({ error: 'Failed to fetch latest portal job' }, 500);
  }
});

// GET /portal-jobs/history
// Registered before /portal-jobs/:jobId so "history" is not captured as a job ID.
app.get('/portal-jobs/history', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');
    const categoryId = c.req.query('categoryId');

    if (!providerId || !categoryId) {
      return c.json({ error: 'Missing providerId or categoryId' }, 400);
    }

    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 50);

    // Prefix scan also returns portal-job:latest:* pointer records
    // ({ jobId, updatedAt }); the shape filter below drops those.
    const records = (await kv.getByPrefix('portal-job:')) as Array<Record<string, unknown> | null>;
    const jobs = records
      .filter(
        (record): record is Record<string, unknown> =>
          !!record &&
          typeof record === 'object' &&
          typeof record.id === 'string' &&
          typeof record.status === 'string' &&
          record.providerId === providerId &&
          record.categoryId === categoryId,
      )
      .map((record) => record as unknown as PortalSyncJob)
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, limit)
      .map(
        (job): PortalJobHistoryEntry => ({
          id: job.id,
          status: job.status,
          runMode: job.runMode,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
          currentStep: job.currentStep,
          message: job.message,
          error: job.error,
          warning: latestPortalWarning(job.warnings) || job.warning,
          queueSummary: job.queueSummary,
          stagedRunId: job.stagedRunId,
          discoveryReportId: job.discoveryReportId,
          actionsRunUrl: job.actionsRunUrl,
          actionsDispatchError: job.actionsDispatchError,
        }),
      );

    return c.json({ success: true, jobs });
  } catch (e) {
    log.error('Portal job history fetch error:', e);
    return c.json({ error: 'Failed to fetch portal job history' }, 500);
  }
});

// GET /portal-jobs/:jobId
app.get('/portal-jobs/:jobId', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const scopeError = getPortalJobScopeError(
      job,
      c.req.query('providerId'),
      c.req.query('categoryId'),
    );
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    return c.json({ success: true, job });
  } catch (e) {
    log.error('Portal job fetch error:', e);
    return c.json({ error: 'Failed to fetch portal job' }, 500);
  }
});

// GET /portal-jobs/:jobId/items
app.get('/portal-jobs/:jobId/items', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const scopeError = getPortalJobScopeError(
      job,
      c.req.query('providerId'),
      c.req.query('categoryId'),
    );
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const items = await loadPortalJobItems(jobId);
    return c.json({ success: true, items, summary: summarisePortalJobItems(items) });
  } catch (e) {
    log.error('Portal job items fetch error:', e);
    return c.json({ error: 'Failed to fetch portal job policy queue' }, 500);
  }
});

// POST /portal-jobs/:jobId/items/:itemId/retry
app.post('/portal-jobs/:jobId/items/:itemId/retry', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const itemId = c.req.param('itemId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const body = await c.req.json().catch(() => ({}));
    const scopeError = getPortalJobScopeError(job, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: 'Portal job policy item not found' }, 404);
    }

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...items[itemIndex],
      status: 'queued',
      currentStep: 'queued',
      message: 'Queued for retry.',
      error: undefined,
      warning: undefined,
      warnings: [],
      workerId: undefined,
      startedAt: undefined,
      completedAt: undefined,
      updatedAt: now,
    };

    const updatedJob = await persistPortalJobItems(job, items, {
      status: ['staged', 'failed', 'cancelled'].includes(job.status) ? 'queued' : job.status,
      currentStep: 'retry_queued',
      message: `Queued ${items[itemIndex].clientName} / ${items[itemIndex].policyNumber} for retry.`,
    });

    return c.json({
      success: true,
      item: items[itemIndex],
      job: updatedJob,
      items,
      summary: updatedJob.queueSummary,
    });
  } catch (e) {
    log.error('Portal job item retry error:', e);
    return c.json({ error: `Failed to retry policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/status
app.post('/portal-jobs/:jobId/status', requireAuth, async (c) => {
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
    log.error('Portal job status update error:', e);
    return c.json({ error: `Failed to update portal job: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/live-view
app.post('/portal-jobs/:jobId/live-view', requireAuth, async (c) => {
  try {
    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Portal live view parse error:', parseErr);
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
    log.error('Portal live view upload error:', e);
    return c.json({ error: `Failed to upload portal live view: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/discovery-report
app.post('/portal-jobs/:jobId/discovery-report', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = await c.req.json();
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
    log.error('Portal discovery report save error:', e);
    return c.json({ error: `Failed to save discovery report: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/:jobId/discovery-report
app.get('/portal-jobs/:jobId/discovery-report', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const scopeError = getPortalJobScopeError(
      job,
      c.req.query('providerId'),
      c.req.query('categoryId'),
    );
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const latest = (await kv.get(`portal-discovery-report:latest:${jobId}`)) as {
      reportId: string;
    } | null;
    if (!latest?.reportId) {
      return c.json({ success: true, report: null });
    }

    const report = (await kv.get(
      `portal-discovery-report:${latest.reportId}`,
    )) as PortalDiscoveryReport | null;
    return c.json({ success: true, report });
  } catch (e) {
    log.error('Portal discovery report fetch error:', e);
    return c.json({ error: 'Failed to fetch discovery report' }, 500);
  }
});

// POST /portal-jobs/:jobId/otp
app.post('/portal-jobs/:jobId/otp', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = await c.req.json();
    const scopeError = getPortalJobScopeError(job, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    const otp = String(body?.otp || '').trim();
    if (!/^[0-9A-Za-z]{4,12}$/.test(otp)) {
      return c.json({ error: 'OTP must be 4 to 12 letters or numbers' }, 400);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await kv.set(`portal-job-otp:${jobId}`, {
      otp,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    const updated: PortalSyncJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      message: 'OTP supplied. Worker can continue.',
    };
    await kv.set(`portal-job:${jobId}`, updated);

    return c.json({ success: true, job: updated });
  } catch (e) {
    log.error('Portal job OTP submit error:', e);
    return c.json({ error: `Failed to submit OTP: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/:jobId/otp
app.get('/portal-jobs/:jobId/otp', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

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
    log.error('Portal job OTP fetch error:', e);
    return c.json({ error: `Failed to fetch OTP: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/stage
app.post('/portal-jobs/:jobId/stage', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = await c.req.json();
    const rawRows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : [];
    if (rawRows.length === 0) {
      return c.json({ error: 'No extracted rows supplied' }, 400);
    }

    const { job: updatedJob, stagedRun } = await stagePortalRows(jobId, rawRows);
    return c.json({ success: true, job: updatedJob, stagedRun });
  } catch (e) {
    log.error('Portal job staging error:', e);
    return c.json({ error: `Failed to stage portal rows: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
