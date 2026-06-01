import { describe, expect, it } from 'vitest';
import { isFnaAdminRole, isSyntheticAdminUser } from '../fna-auth.ts';

describe('fna-auth intake helpers', () => {
  it('detects synthetic admin from anon key path', () => {
    expect(isSyntheticAdminUser({ id: 'admin', email: 'admin@system', role: 'admin' })).toBe(true);
    expect(isSyntheticAdminUser({ id: 'real-user', email: 'u@test.com', role: 'client' })).toBe(
      false,
    );
  });

  it('includes adviser in admin role check', () => {
    expect(isFnaAdminRole('adviser')).toBe(true);
    expect(isFnaAdminRole('client')).toBe(false);
  });
});
