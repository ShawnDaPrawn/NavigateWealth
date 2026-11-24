// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AiUse, PasswordAccess } from '../../../../shared/password-manager.ts';
import { canSee, passwordMode, reachesService } from '../vault-policy.ts';
import { totp } from '../vault-totp.ts';

const login = (aiUse: AiUse, serviceId = 'allan-gray') => ({ aiUse, serviceId });
const agent = (passwords: PasswordAccess, serviceIds: string[] | null = null) => ({
  passwords,
  serviceIds,
});

describe('vault policy', () => {
  it('hides logins marked off, and services outside the agent’s reach', () => {
    expect(canSee(agent('allowed'), login('off'))).toBe(false);
    expect(canSee(agent('allowed'), login('ask'))).toBe(true);
    expect(canSee(agent('allowed', ['goaml']), login('allowed'))).toBe(false);
    expect(canSee(agent('allowed', ['allan-gray']), login('allowed'))).toBe(true);
    expect(reachesService(agent('never'), 'anything')).toBe(true);
  });

  it('gives a password only when both the login and the agent allow it', () => {
    expect(passwordMode(agent('allowed'), login('allowed'))).toBe('go');
    expect(passwordMode(agent('allowed'), login('ask'))).toBe('ask');
    expect(passwordMode(agent('ask'), login('allowed'))).toBe('ask');
    expect(passwordMode(agent('never'), login('allowed'))).toBe('deny');
    expect(passwordMode(agent('allowed'), login('off'))).toBe('deny');
    expect(passwordMode(agent('allowed', ['goaml']), login('allowed'))).toBe('deny');
  });

  it('computes RFC 6238 one-time codes', async () => {
    // RFC 6238 appendix B, SHA-1 seed "12345678901234567890", T = 59 s → 94287082.
    expect((await totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).code).toBe('287082');
    expect((await totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1_111_111_109_000)).code).toBe('081804');
  });
});
