import { describe, expect, it } from 'vitest';
import {
  assertFirmAccess,
  belongsToFirm,
  FirmScopeError,
  resolveFirmId,
} from '../esign-firm-scope.ts';

describe('e-sign trusted firm scope', () => {
  it('uses trusted app metadata and ignores client-editable user metadata', () => {
    const user = {
      id: 'user-1',
      app_metadata: { firm_id: 'trusted-firm' },
      user_metadata: { firm_id: 'attacker-firm' },
    };

    expect(resolveFirmId(user)).toBe('trusted-firm');
    expect(belongsToFirm(user, { firm_id: 'trusted-firm' })).toBe(true);
    expect(belongsToFirm(user, { firm_id: 'attacker-firm' })).toBe(false);
  });

  it('isolates standalone users in their own namespace', () => {
    const user = { id: 'standalone-user' };

    expect(resolveFirmId(user)).toBe('standalone-user');
    expect(belongsToFirm(user, { firm_id: 'standalone-user' })).toBe(true);
    expect(belongsToFirm(user, { firm_id: 'other-user' })).toBe(false);
    expect(belongsToFirm(user, {})).toBe(false);
  });

  it('rejects cross-firm and unscoped records', () => {
    const user = { id: 'user-1', app_metadata: { firm_id: 'firm-a' } };

    expect(() => assertFirmAccess(user, { firm_id: 'firm-b' })).toThrow(FirmScopeError);
    expect(() => assertFirmAccess(user, {})).toThrow(FirmScopeError);
    expect(() => assertFirmAccess(user, { firm_id: 'firm-a' })).not.toThrow();
  });
});
