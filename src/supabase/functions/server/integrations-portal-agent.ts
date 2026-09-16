/**
 * Portal automation — the navigator agent.
 * ========================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The original portal engine drove every provider from hand-authored CSS
 * selectors and consulted a model only in the `catch` of the search-input
 * walk, for two decisions (which input is the search box, which row is the
 * result). That is why exactly one provider worked: Allan Gray has a
 * hand-written adapter, and nothing else had anywhere to put provider
 * knowledge except more selectors.
 *
 * The navigator inverts that. It is given a GOAL and a redacted observation
 * of the current page, and it returns the NEXT ACTION. The worker performs
 * the action, observes again, and asks again, until the goal is met or the
 * step budget runs out. Successful runs are recorded as a per-provider
 * PLAYBOOK, which later runs replay directly — so the model is paid for once
 * per provider, not once per policy per month, and a portal change degrades
 * to "the agent re-derives the step" instead of "the provider is broken".
 *
 * SECURITY: THE MODEL NEVER SEES CREDENTIALS
 * ------------------------------------------
 * A `fill` action carries a `valueRef`, not a value. The worker substitutes
 * the username, password, or policy number locally. The only model-authored
 * string that can reach the page is `literalValue`, which is rejected
 * outright for password-typed targets. Observations are redacted through the
 * same `redactBrainText` / `sanitiseBrainSnapshot` rules the existing brain
 * uses, and input VALUES are never observed — only element metadata.
 *
 * @module server/integrations-portal-agent
 */
import { redactBrainText, sanitiseBrainSnapshot } from './integrations-portal-brain.ts';
import {
  portalAgentBudgets,
  portalPlaybooks,
} from './repositories/portal-automation-repository.ts';
import type {
  PortalAgentAction,
  PortalAgentActionKind,
  PortalAgentConfig,
  PortalAgentObservation,
  PortalAgentPlaybook,
  PortalAgentPlaybookStep,
  PortalAgentStage,
  PortalAgentValueRef,
} from './integrations-portal-types.ts';

/** Every action the navigator is allowed to emit. */
export const PORTAL_AGENT_ACTION_KINDS: PortalAgentActionKind[] = [
  'click',
  'fill',
  'select',
  'press',
  'goto',
  'wait',
  'await_otp',
  'await_push_approval',
  'done',
  'stuck',
];

/** Stages the navigator can be asked to drive. */
export const PORTAL_AGENT_STAGES: PortalAgentStage[] = [
  'pass_auth_checkpoint',
  'find_policy',
  'confirm_policy',
];

/**
 * Value references the worker substitutes locally. `literal` is the only one
 * the model authors, and it never reaches a password field.
 */
export const PORTAL_AGENT_VALUE_REFS: PortalAgentValueRef[] = [
  'policy_number',
  'username',
  'password',
  'literal',
  'none',
];

const DEFAULT_MAX_STEPS = 12;

/**
 * Hard ceiling on paid navigator decisions for ONE job, across every policy in
 * its queue. The per-stage budget stops one stage looping; this stops a job
 * looping. Overridable so a large first-run queue can be raised deliberately.
 */
export const DEFAULT_JOB_DECISION_BUDGET = 200;
const MAX_CANDIDATES = 30;
const MAX_HISTORY = 12;

export function normalisePortalAgentConfig(
  value: unknown,
  fallback?: PortalAgentConfig,
): PortalAgentConfig {
  const entry = (value || {}) as Record<string, unknown>;
  const rawSteps = Number(
    entry.maxStepsPerStage ?? fallback?.maxStepsPerStage ?? DEFAULT_MAX_STEPS,
  );
  return {
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : (fallback?.enabled ?? false),
    goal: typeof entry.goal === 'string' ? entry.goal.trim().slice(0, 500) : fallback?.goal,
    maxStepsPerStage: Number.isFinite(rawSteps)
      ? Math.max(1, Math.min(Math.trunc(rawSteps), 30))
      : DEFAULT_MAX_STEPS,
    recordPlaybook:
      typeof entry.recordPlaybook === 'boolean'
        ? entry.recordPlaybook
        : (fallback?.recordPlaybook ?? true),
    replayPlaybook:
      typeof entry.replayPlaybook === 'boolean'
        ? entry.replayPlaybook
        : (fallback?.replayPlaybook ?? true),
  };
}

export function defaultPortalAgentGoal(providerName: string, stage: PortalAgentStage): string {
  if (stage === 'pass_auth_checkpoint') {
    return `Get past any ${providerName} login verification step (one-time PIN, authenticator push, or security question) and into the signed-in portal.`;
  }
  if (stage === 'find_policy') {
    return `Inside the ${providerName} portal, search for the policy by its policy number and open that policy's own page.`;
  }
  return `Confirm the open ${providerName} page is the policy page for the requested policy number.`;
}

/**
 * Agent runtime configuration. Reuses the Google-hosted model the portal
 * brain already uses, with its own enable flag and model override so the
 * navigator can be rolled forward (or switched off) without touching the
 * existing smart-assist path.
 */
export function getPortalAgentConfig() {
  const apiKey = String(
    Deno.env.get('NW_GOOGLE_AI_API_KEY') ||
      Deno.env.get('GEMINI_API_KEY') ||
      Deno.env.get('GOOGLE_API_KEY') ||
      '',
  ).trim();
  const model = String(
    Deno.env.get('NW_PORTAL_AGENT_MODEL') ||
      Deno.env.get('NW_PORTAL_BRAIN_MODEL') ||
      'gemini-2.5-flash',
  ).trim();
  const apiBase = String(
    Deno.env.get('NW_PORTAL_AGENT_API_BASE') ||
      Deno.env.get('NW_PORTAL_BRAIN_API_BASE') ||
      'https://generativelanguage.googleapis.com/v1beta',
  ).replace(/\/$/, '');
  const enabled = String(Deno.env.get('NW_PORTAL_AGENT_ENABLED') || '1').trim() !== '0';
  return { enabled, available: enabled && !!apiKey, apiKey, model, apiBase };
}

// ---------------------------------------------------------------------------
// Observation sanitising
// ---------------------------------------------------------------------------

/**
 * Trim an observation to what the model needs and strip anything personal.
 *
 * Element VALUES are deliberately not carried: a candidate describes what a
 * control IS (tag, role, label, placeholder), never what is typed in it.
 */
export function sanitisePortalAgentObservation(
  observation: PortalAgentObservation,
  preserve: string[] = [],
): PortalAgentObservation {
  const candidates = Array.isArray(observation.candidates) ? observation.candidates : [];
  return {
    url: redactBrainText(String(observation.url || '').slice(0, 300), preserve),
    title: redactBrainText(String(observation.title || '').slice(0, 200), preserve),
    heading: redactBrainText(String(observation.heading || '').slice(0, 200), preserve),
    pageTextSample: redactBrainText(
      String(observation.pageTextSample || '').slice(0, 2500),
      preserve,
    ),
    candidates: (
      sanitiseBrainSnapshot(
        {
          candidates: candidates.slice(0, MAX_CANDIDATES).map((candidate) => ({
            candidateId: String(candidate.candidateId || '').slice(0, 80),
            tag: String(candidate.tag || '').slice(0, 40),
            type: String(candidate.type || '').slice(0, 60),
            role: String(candidate.role || '').slice(0, 60),
            name: String(candidate.name || '').slice(0, 120),
            id: String(candidate.id || '').slice(0, 120),
            placeholder: String(candidate.placeholder || '').slice(0, 120),
            ariaLabel: String(candidate.ariaLabel || '').slice(0, 120),
            text: String(candidate.text || '').slice(0, 200),
            nearbyText: String(candidate.nearbyText || '').slice(0, 200),
            disabled: candidate.disabled === true,
          })),
        },
        preserve,
      ) as { candidates: PortalAgentObservation['candidates'] }
    ).candidates,
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildPortalAgentPrompt(options: {
  providerName: string;
  stage: PortalAgentStage;
  goal: string;
  policyNumber: string;
  observation: PortalAgentObservation;
  history: string[];
  playbookHint?: PortalAgentPlaybookStep | null;
}): string {
  const { providerName, stage, goal, policyNumber, observation, history, playbookHint } = options;

  const candidateLines = observation.candidates.length
    ? observation.candidates
        .map((candidate) => {
          const parts = [
            `id=${candidate.candidateId}`,
            `<${candidate.tag}${candidate.type ? ` type=${candidate.type}` : ''}>`,
            candidate.role ? `role=${candidate.role}` : '',
            candidate.name ? `name=${candidate.name}` : '',
            candidate.id ? `domId=${candidate.id}` : '',
            candidate.placeholder ? `placeholder="${candidate.placeholder}"` : '',
            candidate.ariaLabel ? `aria-label="${candidate.ariaLabel}"` : '',
            candidate.text ? `text="${candidate.text}"` : '',
            candidate.nearbyText ? `near="${candidate.nearbyText}"` : '',
            candidate.disabled ? 'DISABLED' : '',
          ].filter(Boolean);
          return `- ${parts.join(' ')}`;
        })
        .join('\n')
    : '- (no interactive elements were visible)';

  return [
    "You are navigating a South African financial services provider portal on behalf of a licensed financial adviser who is signed in with their own credentials, to read their own client's policy values. You control a real browser one action at a time.",
    '',
    `PROVIDER: ${providerName}`,
    `STAGE: ${stage}`,
    `GOAL: ${goal}`,
    `TARGET POLICY NUMBER: ${policyNumber || '(none supplied)'}`,
    '',
    'CURRENT PAGE',
    `url: ${observation.url}`,
    `title: ${observation.title}`,
    `heading: ${observation.heading}`,
    'visible text (redacted):',
    observation.pageTextSample || '(no text captured)',
    '',
    'INTERACTIVE ELEMENTS (use candidateId exactly as given)',
    candidateLines,
    '',
    history.length
      ? `ACTIONS ALREADY TAKEN THIS STAGE (most recent last):\n${history
          .slice(-MAX_HISTORY)
          .map((entry, index) => `${index + 1}. ${entry}`)
          .join('\n')}`
      : 'ACTIONS ALREADY TAKEN THIS STAGE: none.',
    '',
    playbookHint
      ? `PREVIOUS SUCCESSFUL RUN did "${playbookHint.action}" on an element described as "${playbookHint.note || playbookHint.selector || 'unknown'}" at this point. Prefer the matching element if one is present, but do not force it if the page has changed.`
      : '',
    '',
    'RULES',
    '1. Return exactly ONE next action as JSON. Do not plan several steps ahead.',
    '2. Use only a candidateId from the list above. Never invent a selector or an id.',
    '3. To type a value use action "fill" with a valueRef: "policy_number" for the target policy number, "username" or "password" for the adviser\'s stored credentials. The real value is substituted locally and is never shown to you. Use valueRef "literal" with literalValue ONLY for harmless values you can see are needed, such as a search term visible on the page. Never use "literal" for a password field.',
    '4. If the page is asking for a one-time PIN or code that must be typed, return "await_otp". The adviser will supply it.',
    '5. If the page is asking the user to approve a sign-in in an authenticator app, or to tap a matching number, return "await_push_approval".',
    '6. If the goal for this stage is already met on this page, return "done".',
    '7. If you cannot make progress, or the page looks like an error, a lockout, or somewhere you should not be, return "stuck" with a short reason. Returning "stuck" is always better than guessing.',
    '8. Do not attempt to solve a CAPTCHA or a bot challenge. If you see one, return "stuck" and say so.',
    '9. Do not take any action that changes data, moves money, submits an instruction, or alters the client\'s policy. This task is READ ONLY. If the only way forward appears to require such an action, return "stuck".',
    '10. Prefer the fewest steps. Avoid repeating an action from the history that clearly did not work.',
    '',
    'Respond with JSON only.',
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Model call
// ---------------------------------------------------------------------------

export async function callPortalAgentModel(options: {
  prompt: string;
  model: string;
  apiBase: string;
  apiKey: string;
}): Promise<{ text: string }> {
  const response = await fetch(
    `${options.apiBase}/models/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: PORTAL_AGENT_ACTION_KINDS },
              candidateId: { type: 'STRING' },
              valueRef: { type: 'STRING', enum: PORTAL_AGENT_VALUE_REFS },
              literalValue: { type: 'STRING' },
              key: { type: 'STRING' },
              url: { type: 'STRING' },
              confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
              reason: { type: 'STRING' },
            },
            required: [
              'action',
              'candidateId',
              'valueRef',
              'literalValue',
              'key',
              'url',
              'confidence',
              'reason',
            ],
          },
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(
      errObj && typeof errObj === 'object' && errObj.message
        ? String(errObj.message)
        : `Portal agent request failed with HTTP ${response.status}`,
    );
  }

  const candidates = Array.isArray(data.candidates)
    ? (data.candidates as Array<Record<string, unknown>>)
    : [];
  const text = candidates
    .flatMap((candidate) => {
      const content = candidate.content as { parts?: Array<{ text?: string }> } | undefined;
      return Array.isArray(content?.parts) ? content.parts : [];
    })
    .map((part) => String(part.text || ''))
    .join('\n')
    .trim();

  if (!text) throw new Error('The navigator response did not contain usable text.');
  return { text };
}

function extractFirstJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return text;
  return text.slice(firstBrace, lastBrace + 1);
}

/**
 * Parse and CONSTRAIN a model response into an action the worker may perform.
 *
 * Everything is validated against the supplied candidate ids and the allowed
 * action set; anything unrecognised degrades to `stuck` rather than being
 * passed through. A `fill` whose target is a password-typed control may only
 * carry valueRef `password` — never a model-authored literal.
 */
export function parsePortalAgentAction(
  text: string,
  context: {
    candidateIds: Set<string>;
    passwordCandidateIds?: Set<string>;
    sameOriginHost?: string;
  },
): PortalAgentAction {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
  } catch {
    return {
      action: 'stuck',
      candidateId: null,
      valueRef: 'none',
      literalValue: '',
      key: '',
      url: '',
      confidence: 'low',
      reason: `Navigator returned non-JSON output: ${
        String(text || '')
          .trim()
          .slice(0, 180) || 'empty response'
      }`,
    };
  }

  const rawAction = String(parsed.action || '');
  const action = (PORTAL_AGENT_ACTION_KINDS as string[]).includes(rawAction)
    ? (rawAction as PortalAgentActionKind)
    : 'stuck';

  const rawCandidateId = String(parsed.candidateId || '').trim();
  const candidateId = context.candidateIds.has(rawCandidateId) ? rawCandidateId : null;

  const rawValueRef = String(parsed.valueRef || 'none');
  let valueRef = (PORTAL_AGENT_VALUE_REFS as string[]).includes(rawValueRef)
    ? (rawValueRef as PortalAgentValueRef)
    : 'none';
  let literalValue = String(parsed.literalValue || '').slice(0, 200);

  const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence))
    ? (String(parsed.confidence) as 'high' | 'medium' | 'low')
    : 'low';
  const reason = String(parsed.reason || 'No reason supplied.')
    .trim()
    .slice(0, 300);

  const reject = (why: string): PortalAgentAction => ({
    action: 'stuck',
    candidateId: null,
    valueRef: 'none',
    literalValue: '',
    key: '',
    url: '',
    confidence: 'low',
    reason: why,
  });

  // Actions that must name a real element.
  if ((action === 'click' || action === 'fill' || action === 'select') && !candidateId) {
    return reject(`Navigator chose "${action}" without naming a visible element.`);
  }

  if (action === 'fill' || action === 'select') {
    const isPasswordTarget = context.passwordCandidateIds?.has(candidateId || '') === true;
    if (isPasswordTarget && valueRef !== 'password') {
      return reject('Navigator tried to type a non-credential value into a password field.');
    }
    if (valueRef === 'literal' && !literalValue) {
      return reject('Navigator asked to type a literal value but supplied none.');
    }
    if (valueRef === 'none') {
      return reject(`Navigator chose "${action}" without saying what to type.`);
    }
    if (valueRef !== 'literal') literalValue = '';
  } else {
    valueRef = 'none';
    literalValue = '';
  }

  let key = '';
  if (action === 'press') {
    key = String(parsed.key || '')
      .trim()
      .slice(0, 20);
    // Only keys a read-only navigation needs.
    if (!['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp'].includes(key)) {
      return reject(`Navigator asked to press an unsupported key: ${key || '(none)'}`);
    }
  }

  let url = '';
  if (action === 'goto') {
    url = String(parsed.url || '')
      .trim()
      .slice(0, 500);
    const parsedUrl = (() => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })();
    if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)) {
      return reject('Navigator asked to navigate to an unusable URL.');
    }
    // Never let the navigator leave the provider's own site.
    if (context.sameOriginHost && parsedUrl.hostname !== context.sameOriginHost) {
      return reject(
        `Navigator asked to navigate off the provider site (${parsedUrl.hostname}); refused.`,
      );
    }
  }

  return { action, candidateId, valueRef, literalValue, key, url, confidence, reason };
}

// ---------------------------------------------------------------------------
// Playbook persistence
// ---------------------------------------------------------------------------

export function portalPlaybookKey(providerId: string, categoryId: string): string {
  return portalPlaybooks.key(`${providerId}:${categoryId}`);
}

export function emptyPortalPlaybook(providerId: string, categoryId: string): PortalAgentPlaybook {
  return {
    providerId,
    categoryId,
    updatedAt: new Date().toISOString(),
    stages: {},
    stats: { recordedRuns: 0, replayedRuns: 0, repairedSteps: 0 },
  };
}

export async function loadPortalPlaybook(
  providerId: string,
  categoryId: string,
): Promise<PortalAgentPlaybook> {
  const stored = await portalPlaybooks.get(`${providerId}:${categoryId}`);
  if (!stored || typeof stored !== 'object') return emptyPortalPlaybook(providerId, categoryId);
  return {
    ...emptyPortalPlaybook(providerId, categoryId),
    ...stored,
    stages: stored.stages && typeof stored.stages === 'object' ? stored.stages : {},
    stats: {
      recordedRuns: Number(stored.stats?.recordedRuns || 0),
      replayedRuns: Number(stored.stats?.replayedRuns || 0),
      repairedSteps: Number(stored.stats?.repairedSteps || 0),
    },
  };
}

export async function savePortalPlaybook(playbook: PortalAgentPlaybook): Promise<void> {
  await portalPlaybooks.put(`${playbook.providerId}:${playbook.categoryId}`, {
    ...playbook,
    updatedAt: new Date().toISOString(),
  });
}

/** Clamp a recorded step list to what is safe and useful to persist. */
export function normalisePlaybookSteps(value: unknown): PortalAgentPlaybookStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 30)
    .map((entry) => {
      const step = (entry || {}) as Record<string, unknown>;
      const action = String(step.action || '');
      if (!(PORTAL_AGENT_ACTION_KINDS as string[]).includes(action)) return null;
      const valueRef = String(step.valueRef || 'none');
      return {
        action: action as PortalAgentActionKind,
        selector: String(step.selector || '').slice(0, 400),
        valueRef: ((PORTAL_AGENT_VALUE_REFS as string[]).includes(valueRef)
          ? valueRef
          : 'none') as PortalAgentValueRef,
        note: redactBrainText(String(step.note || '').slice(0, 200)),
      };
    })
    .filter((step): step is PortalAgentPlaybookStep => step !== null);
}

// ---------------------------------------------------------------------------
// Spend budget
// ---------------------------------------------------------------------------

export function getPortalAgentJobBudget(): number {
  const raw = Number(Deno.env.get('NW_PORTAL_AGENT_JOB_BUDGET') || DEFAULT_JOB_DECISION_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_JOB_DECISION_BUDGET;
}

/**
 * Count one decision against this job's budget.
 *
 * Returns `{ allowed: false }` once the job has spent its ceiling, so the
 * caller answers without calling the model at all. Counting BEFORE the call is
 * deliberate: a model call that then fails has still cost money.
 */
export async function consumePortalAgentBudget(
  jobId: string,
  budget = getPortalAgentJobBudget(),
): Promise<{ allowed: boolean; spent: number; budget: number }> {
  const current = await portalAgentBudgets.get(jobId);
  const spent = Number(current?.decisions || 0);
  if (spent >= budget) return { allowed: false, spent, budget };
  await portalAgentBudgets.put(jobId, {
    jobId,
    decisions: spent + 1,
    updatedAt: new Date().toISOString(),
  });
  return { allowed: true, spent: spent + 1, budget };
}
