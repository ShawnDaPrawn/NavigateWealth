import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  buildPortalFieldsFromBindings,
  normaliseIntegrationLabelList,
} from '../../../shared/integrations/binding-utils.ts';
import { applyTemplateRowMetadata } from './integrations-spreadsheet.ts';
import { normaliseSettings, normaliseIntegrationConfig } from './integrations-config-utils.ts';
import { getSchemaForCategory } from './integrations-field-utils.ts';
import {
  defaultPortalBrainGoal,
  loadPortalBrainMemory,
  savePortalBrainMemory,
  summarisePortalBrainMemory,
  rememberPortalBrainHint,
  getPortalBrainConfig,
  sanitiseBrainSnapshot,
  callPortalBrainModel,
  parsePortalBrainDecision,
  buildPortalBrainPrompt,
} from './integrations-portal-brain.ts';
import { loadPortalCredentialRecord } from './integrations-portal-credentials.ts';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import { uploadPortalLiveView, normaliseRunMode } from './integrations-portal-runtime.ts';
import {
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
  normaliseDocumentArtifactStatuses,
  PORTAL_ESTATE_DOCUMENT_TYPES,
} from './integrations-portal-flow-config.ts';
import { getPortalFlow } from './integrations-portal-flow.ts';
import {
  getTemplateFieldBindings,
  summarisePortalJobItems,
  loadPortalJobItems,
  sanitisePortalWarnings,
  latestPortalWarning,
  persistPortalJobItems,
  stagePortalRows,
  portalRowHasBusinessValue,
  portalItemHasStageableBusinessValue,
} from './integrations-sync-engine.ts';
import {
  uploadEstateDocumentForClient,
  replacePolicyDocumentForPolicy,
} from './integrations-document-storage.ts';
import type { KvProvider, PolicyDocument } from './integrations-types.ts';
import type {
  PortalJobStatus,
  PortalJobItemStatus,
  PortalSyncJob,
  PortalDiscoveryReport,
  PortalProviderFlow,
  PortalFlowField,
} from './integrations-portal-types.ts';
import type { IntegrationConfig, IntegrationFieldBinding } from './integrations-core-types.ts';

const log = createModuleLogger('integrations-portal-worker-routes');

const app = new Hono();

function buildPortalExtractionFieldsForBindings(
  bindings: IntegrationFieldBinding[],
  existingFields: PortalFlowField[] = [],
): PortalFlowField[] {
  return buildPortalFieldsFromBindings(bindings, existingFields).map((field) => ({
    sourceHeader: field.sourceHeader || field.columnName || '',
    columnName: field.columnName || field.sourceHeader || '',
    targetFieldId: field.targetFieldId,
    targetFieldName: field.targetFieldName,
    selector: field.selector || '',
    labels: normaliseIntegrationLabelList(field.labels),
    attribute: typeof field.attribute === 'string' ? field.attribute : 'text',
    required: field.required === true,
    transform: typeof field.transform === 'string' ? field.transform : 'trim',
  }));
}

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

// POST /portal-worker/jobs/claim
app.post('/portal-worker/jobs/claim', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const requestedMode = typeof body?.runMode === 'string' ? body.runMode : undefined;
    const workerId = String(body?.workerId || 'portal-worker').slice(0, 120);
    const jobs = (await kv.listByPrefix('portal-job:', { limit: 500 }))
      .map((entry) => entry.value as Partial<PortalSyncJob>)
      .filter((job): job is PortalSyncJob => !!job?.id && job.status === 'queued')
      .filter(
        (job) =>
          !requestedMode || normaliseRunMode(job.runMode) === normaliseRunMode(requestedMode),
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const job = jobs[0];
    if (!job) {
      return c.json({ success: true, job: null });
    }

    const now = new Date().toISOString();
    const claimed: PortalSyncJob = {
      ...job,
      status: 'running',
      workerId,
      startedAt: job.startedAt || now,
      updatedAt: now,
      currentStep: 'worker_claimed',
      message: `Hosted Playwright worker claimed ${normaliseRunMode(job.runMode)} job.`,
    };
    await kv.set(`portal-job:${job.id}`, claimed);
    return c.json({ success: true, job: claimed });
  } catch (e) {
    log.error('Portal worker claim error:', e);
    return c.json({ error: `Failed to claim portal job: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-worker/jobs/:jobId/runtime
app.get('/portal-worker/jobs/:jobId/runtime', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }
    const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }
    const flow = await getPortalFlow(provider, job.providerId, job.categoryId);
    const schema = await getSchemaForCategory(job.categoryId);
    const storedConfig = (await kv.get(
      `config:mapping:${job.providerId}:${job.categoryId}`,
    )) as IntegrationConfig | null;
    const config = storedConfig
      ? normaliseIntegrationConfig(
          {
            ...storedConfig,
            providerId: job.providerId,
            categoryId: job.categoryId,
          },
          schema.fields || [],
        )
      : null;
    const flowForJobRequest: PortalProviderFlow = {
      ...flow,
      policySchedule: normalisePolicyScheduleConfig(job.policySchedule, flow.policySchedule),
      documentArtifacts: normaliseDocumentArtifactConfigs(
        job.documentArtifacts,
        flow.documentArtifacts || [],
      ),
    };
    const flowForJobCategory = config
      ? {
          ...flowForJobRequest,
          extraction: {
            ...flowForJobRequest.extraction,
            fields: buildPortalExtractionFieldsForBindings(
              getTemplateFieldBindings(config, schema.fields || []),
              Array.isArray(flowForJobRequest.extraction?.fields)
                ? flowForJobRequest.extraction.fields
                : [],
            ),
          },
        }
      : flowForJobRequest;
    const items = await loadPortalJobItems(jobId);
    const brainConfig = getPortalBrainConfig();
    const brainMemory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    const credentialRecord = await loadPortalCredentialRecord(
      job.providerId,
      job.credentialProfileId,
    );
    if (!credentialRecord?.username || !credentialRecord?.password) {
      return c.json({ error: 'Provider credentials are not saved for this job' }, 400);
    }
    return c.json({
      success: true,
      job,
      flow: flowForJobCategory,
      config: config ? { ...config, settings: normaliseSettings(config.settings) } : null,
      items,
      credentials: {
        username: credentialRecord.username,
        password: credentialRecord.password,
      },
      brain: {
        available: brainConfig.available,
        configured: brainConfig.available && flowForJobCategory.search?.brain?.enabled === true,
        model: brainConfig.model,
        memory: brainMemory,
        summary: summarisePortalBrainMemory(brainMemory, {
          available: brainConfig.available,
          configured: brainConfig.available && flowForJobCategory.search?.brain?.enabled === true,
          model: brainConfig.model,
        }),
      },
    });
  } catch (e) {
    log.error('Portal worker runtime error:', e);
    return c.json({ error: `Failed to load worker runtime: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/brain/decide
app.post('/portal-worker/jobs/:jobId/brain/decide', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, job.providerId, job.categoryId);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const stage = String(body.stage || '');
    const policyNumber = String(body.policyNumber || '').trim();
    const snapshot =
      body.snapshot && typeof body.snapshot === 'object'
        ? (body.snapshot as Record<string, unknown>)
        : null;
    if (!['search_input', 'search_result'].includes(stage) || !policyNumber || !snapshot) {
      return c.json({ error: 'stage, policyNumber, and snapshot are required' }, 400);
    }

    const candidates = Array.isArray(snapshot.candidates)
      ? (snapshot.candidates as Array<Record<string, unknown>>)
      : [];
    if (candidates.length === 0) {
      return c.json({ error: 'No visible candidates were supplied for the brain' }, 400);
    }

    const brain = getPortalBrainConfig();
    if (!brain.available || flow.search?.brain?.enabled !== true) {
      return c.json({
        success: true,
        available: false,
        decision: {
          action: 'stop_uncertain',
          candidateId: null,
          confidence: 'low',
          reason:
            flow.search?.brain?.enabled !== true
              ? 'Smart search assist is disabled for this provider.'
              : 'Google-hosted brain API is not configured on the backend.',
        },
      });
    }

    const memory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    memory.stats.brainCalls += 1;
    await savePortalBrainMemory(memory);

    const prompt = buildPortalBrainPrompt({
      providerName: job.providerName,
      goal: flow.search?.brain?.goal || defaultPortalBrainGoal(job.providerName),
      stage: stage as 'search_input' | 'search_result',
      policyNumber,
      instructions: flow.search?.instructions,
      labels: flow.search?.searchInputLabels,
      memory,
      snapshot: sanitiseBrainSnapshot(
        {
          ...snapshot,
          candidates: candidates.slice(0, 20).map((candidate) => ({
            candidateId: String(candidate.candidateId || '').slice(0, 80),
            selector: String(candidate.selector || '').slice(0, 500),
            tag: String(candidate.tag || '').slice(0, 40),
            type: String(candidate.type || '').slice(0, 60),
            role: String(candidate.role || '').slice(0, 60),
            placeholder: String(candidate.placeholder || '').slice(0, 120),
            name: String(candidate.name || '').slice(0, 120),
            id: String(candidate.id || '').slice(0, 120),
            ariaLabel: String(candidate.ariaLabel || '').slice(0, 120),
            title: String(candidate.title || '').slice(0, 120),
            text: String(candidate.text || '').slice(0, 240),
            nearbyText: String(candidate.nearbyText || '').slice(0, 240),
          })),
        },
        [policyNumber],
      ) as Record<string, unknown>,
    });

    const result = await callPortalBrainModel({
      prompt,
      model: brain.model,
      apiBase: brain.apiBase,
      apiKey: brain.apiKey,
    });
    const parsed = parsePortalBrainDecision(result.text);
    const candidateIds = new Set(
      candidates.map((candidate) => String(candidate.candidateId || '')).filter(Boolean),
    );
    const action = parsed.action === 'use_candidate' ? 'use_candidate' : 'stop_uncertain';
    const candidateId =
      action === 'use_candidate' && candidateIds.has(String(parsed.candidateId || ''))
        ? String(parsed.candidateId)
        : null;
    const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence))
      ? String(parsed.confidence)
      : 'low';
    const reason = String(parsed.reason || 'No reason supplied.')
      .trim()
      .slice(0, 300);

    return c.json({
      success: true,
      available: true,
      model: brain.model,
      decision: {
        action: candidateId ? action : 'stop_uncertain',
        candidateId,
        confidence,
        reason,
      },
      summary: summarisePortalBrainMemory(memory, {
        available: true,
        configured: true,
        model: brain.model,
      }),
    });
  } catch (e) {
    log.error('Portal brain decision error:', e);
    return c.json({ error: `Failed to get a brain decision: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/brain/memory
app.post('/portal-worker/jobs/:jobId/brain/memory', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const stage = String(body.stage || '').trim();
    const selector = String(body.selector || '').trim();
    if (!['search_input', 'search_result'].includes(stage) || !selector) {
      return c.json({ error: 'stage and selector are required' }, 400);
    }

    const memory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    if (stage === 'search_input') {
      memory.searchInputHints = rememberPortalBrainHint(memory.searchInputHints, {
        selector,
        label: typeof body.label === 'string' ? body.label : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        source: body.source === 'deterministic' || body.source === 'manual' ? body.source : 'brain',
      });
      memory.stats.searchInputSuccesses += 1;
    } else {
      memory.searchResultHints = rememberPortalBrainHint(memory.searchResultHints, {
        selector,
        label: typeof body.label === 'string' ? body.label : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        source: body.source === 'deterministic' || body.source === 'manual' ? body.source : 'brain',
      });
      memory.stats.searchResultSuccesses += 1;
    }

    if (body.source !== 'deterministic' && body.source !== 'manual') {
      memory.stats.successfulDecisions += 1;
    }

    await savePortalBrainMemory(memory);
    const brain = getPortalBrainConfig();
    return c.json({
      success: true,
      memory,
      summary: summarisePortalBrainMemory(memory, {
        available: brain.available,
        configured: brain.available,
        model: brain.model,
      }),
    });
  } catch (e) {
    log.error('Portal brain memory update error:', e);
    return c.json({ error: `Failed to update portal brain memory: ${getErrMsg(e)}` }, 500);
  }
});

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
