import { describe, expect, it } from 'vitest';
import { sanitizeIntakeForClient, type FnaIntakeSession } from '../fna-intake-service.ts';

const baseSession: FnaIntakeSession = {
  id: 'sess-1',
  clientId: 'client-1',
  domain: 'risk',
  status: 'client_draft',
  inputs: { grossMonthlyIncome: 50000 },
  progressPercent: 40,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  intakeSource: 'client',
};

describe('sanitizeIntakeForClient', () => {
  it('returns inputs for client draft without admin fields', () => {
    const session: FnaIntakeSession = {
      ...baseSession,
      acceptedBy: { id: 'admin-1', email: 'admin@test.com' },
      linkedFnaId: 'fna-1',
      submittedBy: { id: 'client-1', email: 'client@test.com' },
    };

    const sanitized = sanitizeIntakeForClient(session);
    expect(sanitized.inputs).toEqual(session.inputs);
    expect(sanitized.acceptedBy).toBeUndefined();
    expect(sanitized.linkedFnaId).toBeNull();
    expect(sanitized.submittedBy?.email).toBe('');
  });

  it('preserves linkedFnaId only after accept', () => {
    const accepted: FnaIntakeSession = {
      ...baseSession,
      status: 'accepted',
      linkedFnaId: 'fna-99',
      acceptedBy: { id: 'admin-1', email: 'admin@test.com' },
    };

    const sanitized = sanitizeIntakeForClient(accepted);
    expect(sanitized.linkedFnaId).toBe('fna-99');
    expect(sanitized.acceptedBy).toEqual(accepted.acceptedBy);
  });
});
