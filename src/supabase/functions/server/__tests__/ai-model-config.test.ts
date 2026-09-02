import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  applyChatTokenLimit,
  isResponsesOnlyModel,
  resolveFeatureModel,
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
