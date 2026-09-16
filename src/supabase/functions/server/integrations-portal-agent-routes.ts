/**
 * Portal-worker routes for the navigator agent.
 * =============================================
 *
 * Three endpoints, all worker-secret authenticated:
 *
 *   POST /portal-worker/jobs/:jobId/agent/decide    — next action for a stage
 *   GET  /portal-worker/jobs/:jobId/agent/playbook  — recorded steps to replay
 *   POST /portal-worker/jobs/:jobId/agent/playbook  — record a successful run
 *
 * The decide endpoint is the only place the navigator model is called. It
 * validates the returned action against the candidate set the worker actually
 * saw, so a hallucinated selector can never reach the browser, and it refuses
 * any fill that would put a model-authored string into a password field.
 *
 * @module server/integrations-portal-agent-routes
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requirePortalWorker } from './integrations-portal-guards.ts';
import { getPortalFlow } from './integrations-portal-flow.ts';
import {
  PORTAL_AGENT_STAGES,
  buildPortalAgentPrompt,
  callPortalAgentModel,
  consumePortalAgentBudget,
  defaultPortalAgentGoal,
  getPortalAgentConfig,
  loadPortalPlaybook,
  normalisePlaybookSteps,
  normalisePortalAgentConfig,
  parsePortalAgentAction,
  sanitisePortalAgentObservation,
  savePortalPlaybook,
} from './integrations-portal-agent.ts';
import { portalJobs, providers } from './repositories/portal-automation-repository.ts';
import type { PortalAgentObservation, PortalAgentStage } from './integrations-portal-types.ts';

const log = createModuleLogger('integrations-portal-agent-routes');

const app = new Hono();

/** Load the job + its flow, or answer with the right error. */
async function loadJobAndFlow(jobId: string) {
  const job = await portalJobs.get(jobId);
  if (!job) return { error: 'Portal job not found', status: 404 as const };
  const provider = await providers.get(job.providerId);
  if (!provider) return { error: 'Invalid provider ID', status: 400 as const };
  const flow = await getPortalFlow(provider, job.providerId, job.categoryId);
  return { job, flow };
}

// POST /portal-worker/jobs/:jobId/agent/decide
app.post('/portal-worker/jobs/:jobId/agent/decide', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const loaded = await loadJobAndFlow(c.req.param('jobId')!);
    if ('error' in loaded) return c.json({ error: loaded.error }, loaded.status);
    const { job, flow } = loaded;

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const stage = String(body.stage || '') as PortalAgentStage;
    const policyNumber = String(body.policyNumber || '').trim();
    const observationInput =
      body.observation && typeof body.observation === 'object'
        ? (body.observation as PortalAgentObservation)
        : null;

    if (!PORTAL_AGENT_STAGES.includes(stage) || !observationInput) {
      return c.json({ error: 'A valid stage and observation are required' }, 400);
    }

    const agentConfig = normalisePortalAgentConfig(flow.agent);
    const runtime = getPortalAgentConfig();
    if (!runtime.available || !agentConfig.enabled) {
      return c.json({
        success: true,
        available: false,
        decision: {
          action: 'stuck',
          candidateId: null,
          valueRef: 'none',
          literalValue: '',
          key: '',
          url: '',
          confidence: 'low',
          reason: !agentConfig.enabled
            ? 'The navigator agent is disabled for this provider.'
            : 'The navigator model is not configured on the backend.',
        },
      });
    }

    const candidates = Array.isArray(observationInput.candidates)
      ? observationInput.candidates
      : [];
    if (candidates.length === 0) {
      return c.json({
        success: true,
        available: true,
        decision: {
          action: 'stuck',
          candidateId: null,
          valueRef: 'none',
          literalValue: '',
          key: '',
          url: '',
          confidence: 'low',
          reason: 'No interactive elements were visible on the page.',
        },
      });
    }

    const observation = sanitisePortalAgentObservation(observationInput, [policyNumber]);
    const history = Array.isArray(body.history)
      ? (body.history as unknown[])
          .map((entry) => String(entry || '').slice(0, 200))
          .filter(Boolean)
      : [];
    const playbookHint =
      body.playbookHint && typeof body.playbookHint === 'object'
        ? (normalisePlaybookSteps([body.playbookHint])[0] ?? null)
        : null;

    // Count the spend before making it: a failed paid call still costs.
    const budget = await consumePortalAgentBudget(job.id);
    if (!budget.allowed) {
      return c.json({
        success: true,
        available: true,
        decision: {
          action: 'stuck',
          candidateId: null,
          valueRef: 'none',
          literalValue: '',
          key: '',
          url: '',
          confidence: 'low',
          reason: `This job has used its navigator budget of ${budget.budget} decisions. Raise NW_PORTAL_AGENT_JOB_BUDGET deliberately if a large queue genuinely needs more.`,
        },
      });
    }

    const prompt = buildPortalAgentPrompt({
      providerName: job.providerName,
      stage,
      goal: agentConfig.goal || defaultPortalAgentGoal(job.providerName, stage),
      policyNumber,
      observation,
      history,
      playbookHint,
    });

    const result = await callPortalAgentModel({
      prompt,
      model: runtime.model,
      apiBase: runtime.apiBase,
      apiKey: runtime.apiKey,
    });

    // Constrain the answer to what the worker actually saw.
    const candidateIds = new Set(
      candidates.map((candidate) => String(candidate.candidateId || '')).filter(Boolean),
    );
    const passwordCandidateIds = new Set(
      candidates
        .filter((candidate) => String(candidate.type || '').toLowerCase() === 'password')
        .map((candidate) => String(candidate.candidateId || ''))
        .filter(Boolean),
    );
    let sameOriginHost: string | undefined;
    try {
      sameOriginHost = new URL(String(observationInput.url || flow.loginUrl)).hostname;
    } catch {
      sameOriginHost = undefined;
    }

    const decision = parsePortalAgentAction(result.text, {
      candidateIds,
      passwordCandidateIds,
      sameOriginHost,
    });

    return c.json({ success: true, available: true, model: runtime.model, decision });
  } catch (e) {
    log.error('Portal agent decision error:', e);
    return c.json({ error: `Failed to get a navigator decision: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-worker/jobs/:jobId/agent/playbook
app.get('/portal-worker/jobs/:jobId/agent/playbook', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const loaded = await loadJobAndFlow(c.req.param('jobId')!);
    if ('error' in loaded) return c.json({ error: loaded.error }, loaded.status);
    const { job, flow } = loaded;

    const agentConfig = normalisePortalAgentConfig(flow.agent);
    const playbook = await loadPortalPlaybook(job.providerId, job.categoryId);
    return c.json({
      success: true,
      agent: agentConfig,
      playbook: agentConfig.replayPlaybook ? playbook : { ...playbook, stages: {} },
    });
  } catch (e) {
    log.error('Portal agent playbook read error:', e);
    return c.json({ error: `Failed to load the provider playbook: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/agent/playbook
app.post('/portal-worker/jobs/:jobId/agent/playbook', async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const loaded = await loadJobAndFlow(c.req.param('jobId')!);
    if ('error' in loaded) return c.json({ error: loaded.error }, loaded.status);
    const { job, flow } = loaded;

    const agentConfig = normalisePortalAgentConfig(flow.agent);
    if (!agentConfig.recordPlaybook) {
      return c.json({ success: true, recorded: false, reason: 'Playbook recording is disabled.' });
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const stage = String(body.stage || '') as PortalAgentStage;
    if (!PORTAL_AGENT_STAGES.includes(stage)) {
      return c.json({ error: 'A valid stage is required' }, 400);
    }

    const steps = normalisePlaybookSteps(body.steps);
    if (steps.length === 0) {
      return c.json({ success: true, recorded: false, reason: 'No replayable steps supplied.' });
    }

    const playbook = await loadPortalPlaybook(job.providerId, job.categoryId);
    playbook.stages[stage] = steps;
    playbook.stats.recordedRuns += 1;
    if (body.repaired === true) playbook.stats.repairedSteps += 1;
    await savePortalPlaybook(playbook);

    return c.json({ success: true, recorded: true, stage, stepCount: steps.length });
  } catch (e) {
    log.error('Portal agent playbook write error:', e);
    return c.json({ error: `Failed to record the provider playbook: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
