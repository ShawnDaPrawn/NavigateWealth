/**
 * Portal-worker routes for work items: claiming pending items, reporting
 * per-item status (with shadow-extraction comparison), and attaching the
 * fetched policy / estate documents.
 * Mounted by integrations-portal-worker-routes.ts.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import {
  normaliseDocumentArtifactStatuses,
  PORTAL_ESTATE_DOCUMENT_TYPES,
} from './integrations-portal-flow-config.ts';
import {
  summarisePortalJobItems,
  loadPortalJobItems,
  sanitisePortalWarnings,
  latestPortalWarning,
  persistPortalJobItems,
} from './integrations-sync-engine.ts';
import {
  uploadEstateDocumentForClient,
  replacePolicyDocumentForPolicy,
} from './integrations-document-storage.ts';
import type { PolicyDocument } from './integrations-types.ts';
import type { PortalJobItemStatus, PortalSyncJob } from './integrations-portal-types.ts';
import { sanitiseShadowExtraction } from './integrations-portal-worker-shared.ts';

const log = createModuleLogger('integrations-portal-worker-routes');

const app = new Hono();

// POST /portal-worker/jobs/:jobId/items/claim
app.post('/portal-worker/jobs/:jobId/items/claim', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const body = await c.req.json().catch(() => ({}));
    const workerId = String(body?.workerId || 'portal-worker').slice(0, 120);
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const staleBefore = Date.now() - 10 * 60 * 1000;
    const itemIndex = items.findIndex(
      (item) =>
        item.status === 'queued' ||
        (item.status === 'in_progress' && new Date(item.updatedAt).getTime() < staleBefore),
    );

    if (itemIndex === -1) {
      return c.json({ success: true, item: null, summary: summarisePortalJobItems(items) });
    }

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...items[itemIndex],
      status: 'in_progress',
      workerId,
      currentStep: 'searching_policy',
      message: `Searching provider portal for policy ${items[itemIndex].policyNumber}.`,
      startedAt: items[itemIndex].startedAt || now,
      updatedAt: now,
    };

    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      workerId,
      startedAt: job.startedAt || now,
      currentStep: 'searching_policy',
      currentItemId: items[itemIndex].id,
      currentClientName: items[itemIndex].clientName,
      currentPolicyNumber: items[itemIndex].policyNumber,
      message: `Working on ${items[itemIndex].clientName} / ${items[itemIndex].policyNumber}.`,
    });

    return c.json({
      success: true,
      item: items[itemIndex],
      job: updatedJob,
      summary: updatedJob.queueSummary,
    });
  } catch (e) {
    log.error('Portal worker item claim error:', e);
    return c.json({ error: `Failed to claim policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/status
app.post('/portal-worker/jobs/:jobId/items/:itemId/status', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const itemId = c.req.param('itemId')!;
    const body = await c.req.json().catch(() => ({}));
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: 'Portal job policy item not found' }, 404);
    }

    const allowedStatuses: PortalJobItemStatus[] = [
      'queued',
      'in_progress',
      'completed',
      'failed',
      'skipped',
    ];
    const status = allowedStatuses.includes(body?.status)
      ? (body.status as PortalJobItemStatus)
      : items[itemIndex].status;
    const now = new Date().toISOString();
    const warnings = sanitisePortalWarnings(
      body?.warnings ?? body?.warning,
      items[itemIndex].warnings,
    );
    items[itemIndex] = {
      ...items[itemIndex],
      status,
      currentStep:
        typeof body?.currentStep === 'string'
          ? body.currentStep.slice(0, 120)
          : items[itemIndex].currentStep,
      message:
        typeof body?.message === 'string' ? body.message.slice(0, 500) : items[itemIndex].message,
      error:
        typeof body?.error === 'string'
          ? body.error.slice(0, 1000)
          : status === 'failed'
            ? items[itemIndex].error
            : undefined,
      warnings,
      warning: latestPortalWarning(warnings),
      rawData:
        body?.rawData && typeof body.rawData === 'object'
          ? (body.rawData as Record<string, unknown>)
          : items[itemIndex].rawData,
      extractedData:
        body?.extractedData && typeof body.extractedData === 'object'
          ? (body.extractedData as Record<string, unknown>)
          : items[itemIndex].extractedData,
      matchConfidence: ['high', 'medium', 'low'].includes(String(body?.matchConfidence))
        ? body.matchConfidence
        : items[itemIndex].matchConfidence,
      shadowExtraction:
        sanitiseShadowExtraction(body?.shadowExtraction) ?? items[itemIndex].shadowExtraction,
      documentAttached:
        typeof body?.documentAttached === 'boolean'
          ? body.documentAttached
          : items[itemIndex].documentAttached,
      documentFileName:
        typeof body?.documentFileName === 'string'
          ? body.documentFileName.slice(0, 240)
          : items[itemIndex].documentFileName,
      documentUpdatedAt:
        typeof body?.documentUpdatedAt === 'string'
          ? body.documentUpdatedAt
          : items[itemIndex].documentUpdatedAt,
      artifactStatuses: normaliseDocumentArtifactStatuses(
        body?.artifactStatuses,
        items[itemIndex].artifactStatuses,
      ),
      completedAt: ['completed', 'failed', 'skipped'].includes(status)
        ? now
        : items[itemIndex].completedAt,
      updatedAt: now,
    };

    const summary = summarisePortalJobItems(items);
    const allFinished = summary.total > 0 && summary.queued === 0 && summary.inProgress === 0;
    const updatedJob = await persistPortalJobItems(job, items, {
      status: allFinished ? 'staging' : 'extracting',
      currentStep: allFinished ? 'ready_to_stage' : items[itemIndex].currentStep,
      currentItemId: allFinished ? undefined : items[itemIndex].id,
      currentClientName: allFinished ? undefined : items[itemIndex].clientName,
      currentPolicyNumber: allFinished ? undefined : items[itemIndex].policyNumber,
      message: allFinished
        ? `Policy queue finished. ${summary.completed} completed, ${summary.failed} failed.`
        : items[itemIndex].message,
    });

    return c.json({
      success: true,
      item: items[itemIndex],
      job: updatedJob,
      summary: updatedJob.queueSummary,
    });
  } catch (e) {
    log.error('Portal worker item status error:', e);
    return c.json({ error: `Failed to update policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/policy-document
app.post('/portal-worker/jobs/:jobId/items/:itemId/policy-document', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const itemId = c.req.param('itemId')!;
    const workerId = c.req.header('X-Portal-Worker-Id') || 'portal-worker';
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: 'Portal job policy item not found' }, 404);
    }

    const item = items[itemIndex];
    if (item.jobId !== jobId || item.providerId !== job.providerId) {
      return c.json({ error: 'Policy item does not belong to this job' }, 400);
    }

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Failed to parse portal policy document form data:', parseErr);
      return c.json(
        { error: 'Invalid form data. Expected multipart/form-data with a PDF file.' },
        400,
      );
    }

    const file = formData.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No PDF file provided' }, 400);
    }

    const requestedType = String(formData.documentType || 'policy_schedule');
    const documentType = [
      'policy_schedule',
      'amendment',
      'statement',
      'benefit_summary',
      'other',
    ].includes(requestedType)
      ? (requestedType as PolicyDocument['documentType'])
      : 'policy_schedule';

    const document = await replacePolicyDocumentForPolicy({
      clientId: item.clientId,
      policyId: item.policyId,
      file,
      documentType,
      uploadedBy: `portal-worker:${workerId.slice(0, 80)}`,
      stableStorageKey: true,
      fileName: typeof formData.fileName === 'string' ? formData.fileName.slice(0, 240) : file.name,
    });

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...item,
      documentAttached: true,
      documentFileName: document.fileName,
      documentUpdatedAt: document.uploadDate,
      artifactStatuses: normaliseDocumentArtifactStatuses([
        ...(item.artifactStatuses || []).filter((status) => status.id !== 'policy_schedule'),
        {
          id: 'policy_schedule',
          label: 'Policy schedule',
          status: 'attached',
          fileName: document.fileName,
          documentId: document.storageKey,
          updatedAt: document.uploadDate,
        },
      ]),
      message: 'Policy schedule PDF replaced.',
      updatedAt: now,
    };
    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      currentStep: 'policy_document_attached',
      currentItemId: item.id,
      currentClientName: item.clientName,
      currentPolicyNumber: item.policyNumber,
      message: `Policy schedule PDF attached for ${item.clientName} / ${item.policyNumber}.`,
    });

    return c.json({ success: true, document, item: items[itemIndex], job: updatedJob });
  } catch (e) {
    log.error('Portal worker policy document upload error:', e);
    return c.json({ error: `Failed to attach policy document: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/estate-document
app.post('/portal-worker/jobs/:jobId/items/:itemId/estate-document', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const itemId = c.req.param('itemId')!;
    const workerId = c.req.header('X-Portal-Worker-Id') || 'portal-worker';
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: 'Portal job policy item not found' }, 404);
    }

    const item = items[itemIndex];
    if (item.jobId !== jobId || item.providerId !== job.providerId) {
      return c.json({ error: 'Policy item does not belong to this job' }, 400);
    }

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Failed to parse portal estate document form data:', parseErr);
      return c.json(
        { error: 'Invalid form data. Expected multipart/form-data with a PDF file.' },
        400,
      );
    }

    const file = formData.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const requestedType = String(formData.documentType || 'other');
    const documentType = PORTAL_ESTATE_DOCUMENT_TYPES.includes(
      requestedType as (typeof PORTAL_ESTATE_DOCUMENT_TYPES)[number],
    )
      ? (requestedType as
          | 'last_will_scanned'
          | 'living_will_scanned'
          | 'trust_deed'
          | 'power_of_attorney'
          | 'codicil'
          | 'letter_of_executorship'
          | 'other')
      : 'other';
    const artifactId =
      String(formData.artifactId || 'estate_document')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80) || 'estate_document';
    const artifactLabel =
      String(formData.artifactLabel || 'Estate document')
        .trim()
        .slice(0, 120) || 'Estate document';
    const title =
      String(formData.title || artifactLabel || file.name)
        .trim()
        .slice(0, 200) || artifactLabel;
    const notes = typeof formData.notes === 'string' ? formData.notes.slice(0, 1000) : '';
    const signingDate =
      typeof formData.signingDate === 'string' ? formData.signingDate.slice(0, 40) : '';

    const document = await uploadEstateDocumentForClient({
      clientId: item.clientId,
      file,
      documentType,
      uploadedBy: `portal-worker:${workerId.slice(0, 80)}`,
      fileName: typeof formData.fileName === 'string' ? formData.fileName.slice(0, 240) : file.name,
      title,
      notes,
      signingDate,
    });

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...item,
      documentAttached: true,
      documentFileName: document.fileName,
      documentUpdatedAt: document.uploadedAt,
      artifactStatuses: normaliseDocumentArtifactStatuses([
        ...(item.artifactStatuses || []).filter((status) => status.id !== artifactId),
        {
          id: artifactId,
          label: artifactLabel,
          status: 'attached',
          fileName: document.fileName,
          documentId: document.id,
          updatedAt: document.uploadedAt,
        },
      ]),
      message: `${artifactLabel} uploaded to estate documents.`,
      updatedAt: now,
    };
    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      currentStep: 'estate_document_attached',
      currentItemId: item.id,
      currentClientName: item.clientName,
      currentPolicyNumber: item.policyNumber,
      message: `${artifactLabel} attached for ${item.clientName} / ${item.policyNumber}.`,
    });

    return c.json({ success: true, document, item: items[itemIndex], job: updatedJob });
  } catch (e) {
    log.error('Portal worker estate document upload error:', e);
    return c.json({ error: `Failed to attach estate document: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
