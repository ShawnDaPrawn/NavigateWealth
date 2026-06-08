/**
 * Tests for getDefaultPrompt and DEFAULT_PROMPTS registry.
 */

import { describe, expect, it } from 'vitest';
import { getDefaultPrompt, DEFAULT_PROMPTS } from '../defaultPrompts';

describe('DEFAULT_PROMPTS', () => {
  it('contains a public Vasco prompt', () => {
    expect(DEFAULT_PROMPTS['vasco-public:public']).toBeDefined();
    expect(typeof DEFAULT_PROMPTS['vasco-public:public']).toBe('string');
  });

  it('contains an authenticated Vasco prompt', () => {
    expect(DEFAULT_PROMPTS['vasco-authenticated:authenticated']).toBeDefined();
  });

  it('public prompt mentions Navigate Wealth', () => {
    expect(DEFAULT_PROMPTS['vasco-public:public']).toContain('Navigate Wealth');
  });

  it('authenticated prompt mentions Navigate Wealth', () => {
    expect(DEFAULT_PROMPTS['vasco-authenticated:authenticated']).toContain('Navigate Wealth');
  });
});

describe('getDefaultPrompt', () => {
  it('returns the public prompt for vasco-public agent in public context', () => {
    const result = getDefaultPrompt('vasco-public', 'public');
    expect(result).toBe(DEFAULT_PROMPTS['vasco-public:public']);
  });

  it('returns the authenticated prompt for vasco-authenticated agent', () => {
    const result = getDefaultPrompt('vasco-authenticated', 'authenticated');
    expect(result).toBe(DEFAULT_PROMPTS['vasco-authenticated:authenticated']);
  });

  it('returns null for unknown agent/context combination', () => {
    const result = getDefaultPrompt('unknown-agent', 'public');
    expect(result).toBeNull();
  });

  it('returns null for empty agent id', () => {
    const result = getDefaultPrompt('', 'public');
    expect(result).toBeNull();
  });
});
