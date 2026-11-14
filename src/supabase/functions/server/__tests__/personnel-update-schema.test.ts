/**
 * Personnel › Profile and Commission save fields the old schema silently
 * stripped: job title, reporting manager and commission entity. zod drops
 * unknown keys, so a save "succeeded" while losing them.
 */
import { describe, expect, it } from 'vitest';
import { UpdatePersonnelSchema } from '../client-management-personnel-validation-enhanced.ts';

describe('UpdatePersonnelSchema', () => {
  it('keeps job title, manager and commission entity', () => {
    const parsed = UpdatePersonnelSchema.safeParse({
      jobTitle: '  Senior Adviser ',
      managerId: 'mgr-1',
      commissionEntity: 'company',
      commissionSplit: 0.7,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      jobTitle: 'Senior Adviser',
      managerId: 'mgr-1',
      commissionEntity: 'company',
      commissionSplit: 0.7,
    });
  });

  it('accepts null to clear the reporting manager', () => {
    const parsed = UpdatePersonnelSchema.safeParse({ managerId: null });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ managerId: null });
  });

  it('rejects an unknown commission entity and an over-long job title', () => {
    expect(UpdatePersonnelSchema.safeParse({ commissionEntity: 'trust' }).success).toBe(false);
    expect(UpdatePersonnelSchema.safeParse({ jobTitle: 'x'.repeat(121) }).success).toBe(false);
  });

  it('does not default the status on an edit (a suspended record stays suspended)', () => {
    const parsed = UpdatePersonnelSchema.safeParse({ jobTitle: 'Adviser' });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('status');
  });
});
