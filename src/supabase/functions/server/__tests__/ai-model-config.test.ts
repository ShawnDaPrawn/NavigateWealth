import { describe, expect, it } from 'vitest';
import { applyChatTokenLimit, isResponsesOnlyModel } from '../ai-model-config.ts';

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
