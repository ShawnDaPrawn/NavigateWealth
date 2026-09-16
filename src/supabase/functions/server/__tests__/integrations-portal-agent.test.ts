import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  PORTAL_AGENT_ACTION_KINDS,
  PORTAL_AGENT_STAGES,
  buildPortalAgentPrompt,
  defaultPortalAgentGoal,
  emptyPortalPlaybook,
  getPortalAgentConfig,
  normalisePlaybookSteps,
  normalisePortalAgentConfig,
  parsePortalAgentAction,
  portalPlaybookKey,
  sanitisePortalAgentObservation,
  DEFAULT_JOB_DECISION_BUDGET,
  getPortalAgentJobBudget,
} from '../integrations-portal-agent.ts';
import type { PortalAgentObservation } from '../integrations-portal-types.ts';

const observation: PortalAgentObservation = {
  url: 'https://portal.example.co.za/search',
  title: 'Client search',
  heading: 'Find a policy',
  pageTextSample: 'Search for a policy by number.',
  candidates: [
    { candidateId: 'c1', tag: 'input', type: 'text', name: 'q', placeholder: 'Policy number' },
    { candidateId: 'c2', tag: 'input', type: 'password', name: 'pw' },
    { candidateId: 'c3', tag: 'button', text: 'Search' },
  ],
};

const ctx = {
  candidateIds: new Set(['c1', 'c2', 'c3']),
  passwordCandidateIds: new Set(['c2']),
  sameOriginHost: 'portal.example.co.za',
};

const json = (value: Record<string, unknown>) => JSON.stringify(value);

describe('portal navigator — configuration', () => {
  it('defaults to disabled so existing provider flows are unchanged', () => {
    const config = normalisePortalAgentConfig(undefined);
    expect(config.enabled).toBe(false);
    expect(config.recordPlaybook).toBe(true);
    expect(config.replayPlaybook).toBe(true);
    expect(config.maxStepsPerStage).toBe(12);
  });

  it('clamps the step budget into a sane range', () => {
    expect(normalisePortalAgentConfig({ maxStepsPerStage: 0 }).maxStepsPerStage).toBe(1);
    expect(normalisePortalAgentConfig({ maxStepsPerStage: 500 }).maxStepsPerStage).toBe(30);
    expect(normalisePortalAgentConfig({ maxStepsPerStage: 'nonsense' }).maxStepsPerStage).toBe(12);
  });

  it('inherits from a fallback flow config', () => {
    const fallback = normalisePortalAgentConfig({ enabled: true, maxStepsPerStage: 5, goal: 'g' });
    const merged = normalisePortalAgentConfig({}, fallback);
    expect(merged.enabled).toBe(true);
    expect(merged.maxStepsPerStage).toBe(5);
    expect(merged.goal).toBe('g');
  });

  it('writes a distinct default goal per stage', () => {
    const goals = PORTAL_AGENT_STAGES.map((stage) => defaultPortalAgentGoal('Acme Life', stage));
    expect(new Set(goals).size).toBe(PORTAL_AGENT_STAGES.length);
    goals.forEach((goal) => expect(goal).toContain('Acme Life'));
  });
});

describe('portal navigator — observation redaction', () => {
  it('redacts personal data while preserving the target policy number', () => {
    const sanitised = sanitisePortalAgentObservation(
      {
        ...observation,
        pageTextSample:
          'Owner adviser@example.com ID 8001015009087 policy 12345678 value R 1 234.56',
      },
      ['12345678'],
    );
    expect(sanitised.pageTextSample).toContain('12345678');
    expect(sanitised.pageTextSample).not.toContain('adviser@example.com');
    expect(sanitised.pageTextSample).not.toContain('8001015009087');
  });

  it('caps the candidate list so a huge page cannot blow the prompt', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      candidateId: `c${index}`,
      tag: 'button',
      text: `Button ${index}`,
    }));
    const sanitised = sanitisePortalAgentObservation({ ...observation, candidates: many });
    expect(sanitised.candidates.length).toBeLessThanOrEqual(30);
  });
});

describe('portal navigator — prompt', () => {
  const prompt = buildPortalAgentPrompt({
    providerName: 'Acme Life',
    stage: 'find_policy',
    goal: 'Find the policy',
    policyNumber: '12345678',
    observation,
    history: ['click on c9 → FAILED: not visible'],
    playbookHint: null,
  });

  it('carries the goal, the policy number and the candidate ids', () => {
    expect(prompt).toContain('Acme Life');
    expect(prompt).toContain('12345678');
    expect(prompt).toContain('id=c1');
    expect(prompt).toContain('id=c3');
  });

  it('tells the model it may never see or invent a credential', () => {
    expect(prompt).toContain('never shown to you');
    expect(prompt).toContain('Never use "literal" for a password field');
  });

  it('constrains the run to read-only and forbids bot-challenge solving', () => {
    expect(prompt).toContain('READ ONLY');
    expect(prompt).toContain('Do not attempt to solve a CAPTCHA');
  });

  it('replays prior history so the model does not loop', () => {
    expect(prompt).toContain('click on c9');
  });
});

describe('portal navigator — action parsing is the security boundary', () => {
  it('accepts a well-formed fill against a known candidate', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'fill',
        candidateId: 'c1',
        valueRef: 'policy_number',
        literalValue: '',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'search box',
      }),
      ctx,
    );
    expect(action.action).toBe('fill');
    expect(action.candidateId).toBe('c1');
    expect(action.valueRef).toBe('policy_number');
    expect(action.literalValue).toBe('');
  });

  it('rejects a candidate id the worker never observed', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'click',
        candidateId: 'c999',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'invented',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
    expect(action.candidateId).toBeNull();
  });

  it('refuses a model-authored literal aimed at a password field', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'fill',
        candidateId: 'c2',
        valueRef: 'literal',
        literalValue: 'hunter2',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'guessing',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
    expect(action.reason).toContain('password field');
  });

  it('allows the credential reference itself into a password field', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'fill',
        candidateId: 'c2',
        valueRef: 'password',
        literalValue: '',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'sign in',
      }),
      ctx,
    );
    expect(action.action).toBe('fill');
    expect(action.valueRef).toBe('password');
  });

  it('drops a literal value when the reference is not literal', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'fill',
        candidateId: 'c1',
        valueRef: 'username',
        literalValue: 'leaked',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.literalValue).toBe('');
  });

  it('refuses to navigate off the provider site', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'goto',
        candidateId: '',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: 'https://evil.example.com/collect',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
    expect(action.reason).toContain('off the provider site');
  });

  it('allows a same-origin navigation', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'goto',
        candidateId: '',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: 'https://portal.example.co.za/policies',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.action).toBe('goto');
    expect(action.url).toContain('/policies');
  });

  it('rejects a non-http scheme', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'goto',
        candidateId: '',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: 'javascript:alert(1)',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
  });

  it('only allows navigation keys', () => {
    const ok = parsePortalAgentAction(
      json({
        action: 'press',
        candidateId: 'c1',
        valueRef: 'none',
        literalValue: '',
        key: 'Enter',
        url: '',
        confidence: 'high',
        reason: 'submit',
      }),
      ctx,
    );
    expect(ok.action).toBe('press');
    const bad = parsePortalAgentAction(
      json({
        action: 'press',
        candidateId: 'c1',
        valueRef: 'none',
        literalValue: '',
        key: 'F12',
        url: '',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(bad.action).toBe('stuck');
  });

  it('degrades an unknown action to stuck rather than passing it through', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'download_everything',
        candidateId: 'c1',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
  });

  it('degrades non-JSON output to stuck with the raw text in the reason', () => {
    const action = parsePortalAgentAction('I think you should click the blue button', ctx);
    expect(action.action).toBe('stuck');
    expect(action.reason).toContain('non-JSON');
  });

  it('requires a fill to say what to type', () => {
    const action = parsePortalAgentAction(
      json({
        action: 'fill',
        candidateId: 'c1',
        valueRef: 'none',
        literalValue: '',
        key: '',
        url: '',
        confidence: 'high',
        reason: 'x',
      }),
      ctx,
    );
    expect(action.action).toBe('stuck');
  });

  it('passes through the terminal actions untouched', () => {
    (['done', 'stuck', 'await_otp', 'await_push_approval', 'wait'] as const).forEach((kind) => {
      const action = parsePortalAgentAction(
        json({
          action: kind,
          candidateId: '',
          valueRef: 'none',
          literalValue: '',
          key: '',
          url: '',
          confidence: 'medium',
          reason: 'r',
        }),
        ctx,
      );
      expect(action.action).toBe(kind);
    });
  });

  it('exposes every allowed action kind', () => {
    expect(PORTAL_AGENT_ACTION_KINDS).toContain('await_otp');
    expect(PORTAL_AGENT_ACTION_KINDS).not.toContain('evaluate');
  });
});

describe('portal navigator — playbook', () => {
  it('keys a playbook per provider and category', () => {
    expect(portalPlaybookKey('allan-gray', 'retirement_pre')).toBe(
      'portal-playbook:allan-gray:retirement_pre',
    );
  });

  it('starts empty with zeroed stats', () => {
    const playbook = emptyPortalPlaybook('p', 'c');
    expect(playbook.stages).toEqual({});
    expect(playbook.stats.recordedRuns).toBe(0);
  });

  it('drops steps with an action the worker cannot perform', () => {
    const steps = normalisePlaybookSteps([
      { action: 'click', selector: '#go', valueRef: 'none', note: 'Search' },
      { action: 'exfiltrate', selector: '#x', valueRef: 'none', note: '' },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].action).toBe('click');
  });

  it('redacts a note captured from the page', () => {
    const steps = normalisePlaybookSteps([
      {
        action: 'fill',
        selector: '#q',
        valueRef: 'policy_number',
        note: 'for adviser@example.com',
      },
    ]);
    expect(steps[0].note).not.toContain('adviser@example.com');
  });

  it('returns nothing for a non-array', () => {
    expect(normalisePlaybookSteps('nope')).toEqual([]);
  });
});

describe('portal navigator — runtime config', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubEnv = (values: Record<string, string>) => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => values[name] } });
  };

  it('is unavailable without an API key', () => {
    stubEnv({});
    expect(getPortalAgentConfig().available).toBe(false);
  });

  it('is available once a key is present, and defaults the model', () => {
    stubEnv({ NW_GOOGLE_AI_API_KEY: 'k' });
    const config = getPortalAgentConfig();
    expect(config.available).toBe(true);
    expect(config.model).toBe('gemini-2.5-flash');
  });

  it('honours the kill switch even with a key present', () => {
    stubEnv({ NW_GOOGLE_AI_API_KEY: 'k', NW_PORTAL_AGENT_ENABLED: '0' });
    expect(getPortalAgentConfig().available).toBe(false);
  });

  it('takes a per-feature model override', () => {
    stubEnv({ NW_GOOGLE_AI_API_KEY: 'k', NW_PORTAL_AGENT_MODEL: 'gemini-3-pro' });
    expect(getPortalAgentConfig().model).toBe('gemini-3-pro');
  });

  it('bounds paid decisions per job, and takes a deliberate override', () => {
    stubEnv({});
    expect(getPortalAgentJobBudget()).toBe(DEFAULT_JOB_DECISION_BUDGET);
    stubEnv({ NW_PORTAL_AGENT_JOB_BUDGET: '25' });
    expect(getPortalAgentJobBudget()).toBe(25);
  });

  it('ignores a nonsense or negative budget rather than disabling the ceiling', () => {
    stubEnv({ NW_PORTAL_AGENT_JOB_BUDGET: 'lots' });
    expect(getPortalAgentJobBudget()).toBe(DEFAULT_JOB_DECISION_BUDGET);
    stubEnv({ NW_PORTAL_AGENT_JOB_BUDGET: '-5' });
    expect(getPortalAgentJobBudget()).toBe(DEFAULT_JOB_DECISION_BUDGET);
  });
});
