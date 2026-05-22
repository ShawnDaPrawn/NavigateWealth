import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rowToSession, sessionToRow } from '../fna-intake-postgres-repo.ts';
import type { FnaIntakeSession } from '../fna-intake-types.ts';

describe('fna-intake-postgres-repo mapping', () => {
  it('round-trips session fields between app and database row shape', () => {
    const session: FnaIntakeSession = {
      id: '11111111-1111-1111-1111-111111111111',
      clientId: '22222222-2222-2222-2222-222222222222',
      domain: 'retirement',
      status: 'submitted',
      inputs: { currentAge: 45 },
      progressPercent: 80,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T01:00:00.000Z',
      submittedAt: '2026-05-01T01:00:00.000Z',
      submittedBy: { id: '22222222-2222-2222-2222-222222222222', email: 'c@test.com' },
      intakeSource: 'client',
    };

    const row = sessionToRow(session);
    expect(row.client_id).toBe(session.clientId);
    expect(row.progress_percent).toBe(80);

    const restored = rowToSession({
      ...row,
      consent_accepted_at: null,
      consent_text_version: null,
      accepted_at: null,
      accepted_by: null,
      linked_fna_id: null,
      request_info_at: null,
    });
    expect(restored.clientId).toBe(session.clientId);
    expect(restored.domain).toBe('retirement');
    expect(restored.inputs).toEqual({ currentAge: 45 });
  });

  it('claimSessionForAccept uses conditional update on submitted status only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/supabase/functions/server/fna-intake-postgres-repo.ts'),
      'utf8',
    );
    const claimStart = source.indexOf('async claimSessionForAccept');
    const claimBlock = source.slice(claimStart, claimStart + 1200);

    expect(claimBlock).toContain(".eq('status', 'submitted')");
    expect(claimBlock).toContain("kind: 'already_accepted'");
    expect(claimBlock).toContain('placeholderLinkedId');
  });
});
