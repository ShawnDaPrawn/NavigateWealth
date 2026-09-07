import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  applyChatTokenLimit,
  isResponsesOnlyModel,
  resolveFeatureModel,
  resolvePreferredModel,
  resetAvailableModelsCache,
  OPENAI_PRIMARY_MODEL,
} from '../ai-model-config.ts';

describe('ai-model-config', () => {
  it('classifies GPT-5 / o-series as Responses-only and gpt-4o as not', () => {
    expect(isResponsesOnlyModel('gpt-5.4')).toBe(true);
    expect(isResponsesOnlyModel('gpt-5')).toBe(true);
    expect(isResponsesOnlyModel('o3-mini')).toBe(true);
    expect(isResponsesOnlyModel('gpt-4o')).toBe(false);
    expect(isResponsesOnlyModel('gpt-4o-mini')).toBe(false);
  });

  it('uses max_completion_tokens for Responses-only models on Chat Completions', () => {
    const body: Record<string, unknown> = { model: 'gpt-5.4' };
    applyChatTokenLimit(body, 'gpt-5.4', 1234);
    expect(body.max_completion_tokens).toBe(1234);
    expect(body.max_tokens).toBeUndefined();
  });

  it('uses max_tokens for legacy chat models', () => {
    const body: Record<string, unknown> = { model: 'gpt-4o' };
    applyChatTokenLimit(body, 'gpt-4o', 2000);
    expect(body.max_tokens).toBe(2000);
    expect(body.max_completion_tokens).toBeUndefined();
  });
});

describe('per-feature model override', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the shared primary model when the feature var is unset', () => {
    // The property that makes this safe to add everywhere at once: a feature
    // nobody has configured behaves exactly as it did before the override
    // existed.
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
    expect(resolveFeatureModel('OPENAI_SUMMARY_MODEL')).toBe(OPENAI_PRIMARY_MODEL);
  });

  it('returns the feature var when it is set', () => {
    vi.stubGlobal('Deno', {
      env: {
        get: (name: string) => (name === 'OPENAI_SUMMARY_MODEL' ? 'some-newer-model' : undefined),
      },
    });
    expect(resolveFeatureModel('OPENAI_SUMMARY_MODEL')).toBe('some-newer-model');
  });

  it("does not let one feature's var leak into another", () => {
    // The whole point is isolation: moving the summariser must not move policy
    // extraction, which reaches OpenAI with no model fallback.
    vi.stubGlobal('Deno', {
      env: {
        get: (name: string) => (name === 'OPENAI_SUMMARY_MODEL' ? 'some-newer-model' : undefined),
      },
    });
    expect(resolveFeatureModel('OPENAI_EXTRACTION_MODEL')).toBe(OPENAI_PRIMARY_MODEL);
  });

  it('ignores a blank or whitespace-only value', () => {
    // An operator clearing a secret in the dashboard can leave an empty string
    // behind; that must read as "unset", not as a model id of "".
    vi.stubGlobal('Deno', { env: { get: () => '   ' } });
    expect(resolveFeatureModel('OPENAI_SUMMARY_MODEL')).toBe(OPENAI_PRIMARY_MODEL);
  });
});

describe('account-verified model preferences', () => {
  /** Model ids the fake account serves. */
  let served: string[] = [];
  let fetchCalls = 0;
  let fetchImpl: () => Promise<unknown>;
  let lastInit: RequestInit | undefined;

  beforeEach(() => {
    resetAvailableModelsCache();
    served = [];
    fetchCalls = 0;
    fetchImpl = async () => ({
      ok: true,
      json: async () => ({ data: served.map((id) => ({ id })) }),
    });
    vi.stubGlobal('Deno', {
      env: { get: (n: string) => (n === 'OPENAI_API_KEY' ? 'k' : undefined) },
    });
    lastInit = undefined;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      fetchCalls += 1;
      lastInit = init;
      return fetchImpl();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAvailableModelsCache();
  });

  it('picks the highest-ranked model the account actually serves', async () => {
    served = ['gpt-4o', 'gpt-4.1-mini', 'whisper-1'];

    await expect(resolvePreferredModel(['gpt-5-mini', 'gpt-4.1-mini'], 'X')).resolves.toBe(
      'gpt-4.1-mini',
    );
  });

  it('SKIPS a preferred model the account cannot serve, rather than requesting it', async () => {
    // The whole safety argument. `gpt-5.4` was a name someone believed in; the
    // account is the only thing that actually knows. A name that is not served
    // must be passed over silently, never sent.
    served = ['gpt-4o'];

    await expect(resolvePreferredModel(['a-model-that-never-existed'], 'X')).resolves.toBe(
      OPENAI_PRIMARY_MODEL,
    );
  });

  it('falls back to the shared default when the probe fails', async () => {
    // Fails OPEN: model selection is a nicety and must never be why a summary
    // does not get written.
    fetchImpl = async () => {
      throw new Error('network down');
    };

    await expect(resolvePreferredModel(['gpt-5-mini'], 'X')).resolves.toBe(OPENAI_PRIMARY_MODEL);
  });

  it('falls back when the account returns an empty list', async () => {
    served = [];

    await expect(resolvePreferredModel(['gpt-5-mini'], 'X')).resolves.toBe(OPENAI_PRIMARY_MODEL);
  });

  it('lets an explicit env var win outright, without probing at all', async () => {
    // An operator who names a model has decided. Probing to second-guess them
    // would make the setting untrustworthy — and would spend a request to do it.
    served = ['gpt-4o'];
    vi.stubGlobal('Deno', {
      env: {
        get: (n: string) =>
          n === 'OPENAI_SUMMARY_MODEL'
            ? 'operator-choice'
            : n === 'OPENAI_API_KEY'
              ? 'k'
              : undefined,
      },
    });

    await expect(resolvePreferredModel(['gpt-5-mini'], 'OPENAI_SUMMARY_MODEL')).resolves.toBe(
      'operator-choice',
    );
    expect(fetchCalls).toBe(0);
  });

  it('probes once and caches, so a 40-batch scan pays for it one time', async () => {
    served = ['gpt-4.1-mini'];

    await resolvePreferredModel(['gpt-4.1-mini'], 'X');
    await resolvePreferredModel(['gpt-4.1-mini'], 'X');
    await resolvePreferredModel(['gpt-4.1-mini'], 'X');

    expect(fetchCalls).toBe(1);
  });

  it('returns the shared default for an empty preference list', async () => {
    await expect(resolvePreferredModel([], 'X')).resolves.toBe(OPENAI_PRIMARY_MODEL);
    expect(fetchCalls).toBe(0);
  });

  // ── The failure paths. These are what a 40-batch scan actually hits. ──────

  it('caches a FAILED probe, so an outage costs one request and not forty', async () => {
    // The weekly scan calls generateSummaryDraft sequentially for up to 40
    // groups. Without a cached negative, one 429 becomes 40 doomed probes and
    // 40 lots of latency in front of work that was always going to fall back.
    fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });

    for (let i = 0; i < 5; i++) {
      await expect(resolvePreferredModel(['gpt-5-mini'], 'X')).resolves.toBe(OPENAI_PRIMARY_MODEL);
    }

    expect(fetchCalls).toBe(1);
  });

  it('caches a THROWN probe failure too', async () => {
    fetchImpl = async () => {
      throw new Error('network down');
    };

    await resolvePreferredModel(['gpt-5-mini'], 'X');
    await resolvePreferredModel(['gpt-5-mini'], 'X');

    expect(fetchCalls).toBe(1);
  });

  it('caches an empty model list as a failure rather than re-asking', async () => {
    served = [];

    await resolvePreferredModel(['gpt-5-mini'], 'X');
    await resolvePreferredModel(['gpt-5-mini'], 'X');

    expect(fetchCalls).toBe(1);
  });

  it('bounds the probe with an abort signal', async () => {
    // Without this, a connection that is accepted and then stalls never reaches
    // the catch — so the fail-open path never runs and the summary is blocked
    // behind an OPTIONAL discovery call until the invocation is killed.
    served = ['gpt-4o'];

    await resolvePreferredModel(['gpt-4o'], 'X');

    expect(lastInit?.signal).toBeInstanceOf(AbortSignal);
    expect(lastInit?.signal?.aborted).toBe(false);
  });

  it('gives up and falls back when the probe is aborted', async () => {
    fetchImpl = async () => {
      throw Object.assign(new Error('The signal has been aborted'), { name: 'AbortError' });
    };

    await expect(resolvePreferredModel(['gpt-5-mini'], 'X')).resolves.toBe(OPENAI_PRIMARY_MODEL);
  });
});
