/**
 * Portal-worker routes for driving a browser session: claiming the next
 * queued job, fetching its runtime bundle (flow, credentials, extraction
 * fields), and the brain loop (decide, memory, page-extract).
 * Mounted by integrations-portal-worker-routes.ts.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
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
  buildPortalPageExtractionPrompt,
  callPortalExtractionModel,
  parsePortalExtractionFields,
  redactPortalPageTextForExtraction,
} from './integrations-portal-brain.ts';
import type { PortalPageExtractionFieldRequest } from './integrations-portal-brain.ts';
import { loadPortalCredentialRecord } from './integrations-portal-credentials.ts';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import { normaliseRunMode } from './integrations-portal-runtime.ts';
import {
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
} from './integrations-portal-flow-config.ts';
import { getPortalFlow } from './integrations-portal-flow.ts';
import { getTemplateFieldBindings, loadPortalJobItems } from './integrations-sync-engine.ts';
import type { KvProvider } from './integrations-types.ts';
import type { PortalSyncJob, PortalProviderFlow } from './integrations-portal-types.ts';
import type { IntegrationConfig } from './integrations-core-types.ts';
import { buildPortalExtractionFieldsForBindings } from './integrations-portal-worker-shared.ts';

const log = createModuleLogger('integrations-portal-worker-routes');

const app = new Hono();

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

// POST /portal-worker/jobs/:jobId/page-extract
// Observe-only LLM page extraction (shadow mode): the worker sends the
// confirmed policy page's visible text plus the configured field list and
// gets one value per field back for comparison against the selector path.
// Reuses the portal-brain Gemini configuration; never writes job/item state.
app.post('/portal-worker/jobs/:jobId/page-extract', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param('jobId')!;
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: 'Portal job not found' }, 404);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const policyNumber = String(body.policyNumber || '').trim();
    const pageText = String(body.pageText || '')
      .trim()
      .slice(0, 16000);
    const rawFields = Array.isArray(body.fields) ? body.fields : [];
    const fields: PortalPageExtractionFieldRequest[] = rawFields
      .slice(0, 30)
      .map((field) => {
        const entry = (field || {}) as Record<string, unknown>;
        return {
          columnName: String(entry.columnName || '').slice(0, 120),
          fieldName:
            typeof entry.fieldName === 'string' ? entry.fieldName.slice(0, 160) : undefined,
          labels: Array.isArray(entry.labels)
            ? entry.labels.slice(0, 8).map((label) => String(label).slice(0, 120))
            : [],
          semantic: typeof entry.semantic === 'string' ? entry.semantic.slice(0, 60) : undefined,
          required: entry.required === true,
        };
      })
      .filter((field) => field.columnName);
    if (!policyNumber || !pageText || fields.length === 0) {
      return c.json({ error: 'policyNumber, pageText, and fields are required' }, 400);
    }

    const brain = getPortalBrainConfig();
    if (!brain.available) {
      return c.json({
        success: true,
        available: false,
        fields: [],
        reason: 'Google-hosted brain API is not configured on the backend.',
      });
    }

    const prompt = buildPortalPageExtractionPrompt({
      providerName: job.providerName,
      policyNumber,
      pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 1000) : undefined,
      pageTitle: typeof body.pageTitle === 'string' ? body.pageTitle.slice(0, 240) : undefined,
      fields,
      pageText: redactPortalPageTextForExtraction(pageText, [policyNumber]),
    });

    const result = await callPortalExtractionModel({
      prompt,
      model: brain.model,
      apiBase: brain.apiBase,
      apiKey: brain.apiKey,
    });
    const requestedColumns = new Set(fields.map((field) => field.columnName));
    const extracted = parsePortalExtractionFields(result.text).filter((field) =>
      requestedColumns.has(field.columnName),
    );

    return c.json({
      success: true,
      available: true,
      model: brain.model,
      fields: extracted,
    });
  } catch (e) {
    log.error('Portal page extraction error:', e);
    return c.json({ error: `Failed to run page extraction: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
