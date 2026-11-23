// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  autonomyPreset,
  type CheckResult,
  type VaultSummary,
} from '../../../../shared/password-manager.ts';
import { canSee, effectiveLevel, gate, modeFor, suggestNext } from '../vault-policy.ts';
import { totp } from '../vault-totp.ts';

const item = (patch: Partial<VaultSummary> = {}) =>
  ({
    collectionId: 'brokerage',
    tags: [],
    aiAccess: 'use',
    askFirst: false,
    ...patch,
  }) as VaultSummary;
const conn = (level: 'find' | 'use' | 'reveal' | 'full', autonomy = autonomyPreset('full')) => ({
  collectionIds: ['brokerage'],
  tagFilter: null,
  level,
  autonomy,
});
const failed = (mode: CheckResult['mode']): CheckResult[] => [
  { key: 'daily_limit', mode, passed: false, note: '' },
];

describe('vault policy', () => {
  it('Full access sees and reveals everything in scope, including “never” logins', () => {
    expect(canSee(conn('full'), item({ aiAccess: 'never' }))).toBe(true);
    expect(effectiveLevel(conn('full'), item({ aiAccess: 'find' }))).toBe('reveal');
    expect(canSee(conn('reveal'), item({ aiAccess: 'never' }))).toBe(false);
    expect(effectiveLevel(conn('reveal'), item({ aiAccess: 'use' }))).toBe('use');
    expect(canSee(conn('full'), item({ collectionId: 'other' }))).toBe(false);
  });

  it('Full autonomy never waits; a failed “ask” check is only logged', () => {
    const full = conn('full');
    expect(Object.values(full.autonomy.actions).every((m) => m === 'auto')).toBe(true);
    expect(gate(modeFor(full, 'money_workflow', item()), failed('ask'))).toBe('go');
    expect(gate('auto', failed('block'))).toBe('block');
  });

  it('Checks only waits when a check fails; Supervised always waits', () => {
    expect(gate('ask_on_fail', [])).toBe('go');
    expect(gate('ask_on_fail', failed('ask'))).toBe('ask');
    expect(gate('ask_on_fail', failed('log'))).toBe('go');
    expect(gate('ask', [])).toBe('ask');
    expect(gate('deny', [])).toBe('deny');
  });

  it('honours per-workflow overrides and “Ask first” logins unless they run on their own', () => {
    const policy = { ...autonomyPreset('checks'), workflowOverrides: { w1: 'auto' as const } };
    expect(modeFor({ autonomy: policy }, 'change_workflow', item(), 'w1')).toBe('auto');
    expect(modeFor({ autonomy: policy }, 'change_workflow', item({ askFirst: true }), 'w1')).toBe(
      'ask',
    );
    expect(modeFor({ autonomy: autonomyPreset('full') }, 'reveal', item({ askFirst: true }))).toBe(
      'auto',
    );
  });

  it('suggests the next rung of the trust ladder after a clean record', () => {
    expect(suggestNext('ask', 9)).toBeNull();
    expect(suggestNext('ask', 10)).toBe('ask_on_fail');
    expect(suggestNext('ask_on_fail', 25)).toBe('auto');
    expect(suggestNext('auto', 100)).toBeNull();
  });

  it('computes RFC 6238 one-time codes', async () => {
    // RFC 6238 appendix B, SHA-1 seed "12345678901234567890", T = 59 s → 94287082.
    expect((await totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).code).toBe('287082');
    expect((await totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1_111_111_109_000)).code).toBe('081804');
  });
});
