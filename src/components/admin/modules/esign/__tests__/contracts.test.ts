/**
 * Behaviour pins for the e-signature runtime contracts (Stage C / F8).
 *
 * These assert the properties the schema exists for, directly against the
 * schema rather than through the query hooks. Through the hooks most of it is
 * unfalsifiable: both hooks discard the parsed value and read
 * `response.envelopes || []` off the original object, so a broken schema would
 * not change what they return. The same reasoning is recorded in
 * `client-management`'s contract test.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  parseContract,
  setContractViolationReporter,
  resetContractViolationReporter,
} from '../../../../../shared/contracts';
import { EnvelopeListSchema, EnvelopeEntrySchema, EnvelopeStatusSchema } from '../contracts';

/** Captures what `parseContract` reported, instead of letting it log. */
function captureViolations(run: () => void): { endpoint: string; issues: string }[] {
  const seen: { endpoint: string; issues: string }[] = [];
  setContractViolationReporter((report) => seen.push(report));
  try {
    run();
  } finally {
    resetContractViolationReporter();
  }
  return seen;
}

const validEnvelope = {
  id: 'env-1',
  title: 'Advice record',
  status: 'sent',
  client_id: 'client-1',
  created_at: '2026-01-01T00:00:00.000Z',
};

afterEach(() => resetContractViolationReporter());

describe('EnvelopeListSchema', () => {
  it('accepts a well-formed list without reporting', () => {
    const seen = captureViolations(() => {
      parseContract(EnvelopeListSchema, { envelopes: [validEnvelope] }, { endpoint: 'test' });
    });
    expect(seen).toEqual([]);
  });

  it('accepts a genuinely empty list without reporting', () => {
    // An empty array is a real answer ("this client has signed nothing"), and
    // must stay distinguishable from the drift case below.
    const seen = captureViolations(() => {
      parseContract(EnvelopeListSchema, { envelopes: [] }, { endpoint: 'test' });
    });
    expect(seen).toEqual([]);
  });

  it('REPORTS when the list field is renamed — the drift this file exists for', () => {
    // Exactly the shape `users` -> `clients` produced on the client list: no
    // throw, and `response.envelopes || []` silently yields an empty history.
    const seen = captureViolations(() => {
      parseContract(
        EnvelopeListSchema,
        { items: [validEnvelope] },
        { endpoint: 'GET esign/envelopes' },
      );
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].endpoint).toBe('GET esign/envelopes');
    expect(seen[0].issues).toContain('envelopes');
  });

  it('REPORTS when the list field is present but not an array', () => {
    const seen = captureViolations(() => {
      parseContract(EnvelopeListSchema, { envelopes: null }, { endpoint: 'test' });
    });
    expect(seen).toHaveLength(1);
  });

  it('REPORTS an unrecognised status rather than dropping the envelope silently', () => {
    // Every consumer branches on status; one the SPA does not know matches no
    // branch and vanishes from every filter and count.
    const seen = captureViolations(() => {
      parseContract(
        EnvelopeListSchema,
        { envelopes: [{ ...validEnvelope, status: 'archived' }] },
        { endpoint: 'test' },
      );
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].issues).toContain('status');
  });

  it('preserves nested relations through passthrough', () => {
    // A stripping schema would silently delete signers/fields from any caller
    // that used the parsed value, which is what `parseContract` invites.
    const parsed = parseContract(
      EnvelopeListSchema,
      { envelopes: [{ ...validEnvelope, signers: [{ id: 's1' }] }], count: 1 },
      { endpoint: 'test' },
    ) as { envelopes: Record<string, unknown>[]; count?: number };
    expect(parsed.envelopes[0].signers).toEqual([{ id: 's1' }]);
    expect(parsed.count).toBe(1);
  });
});

describe('EnvelopeStatusSchema', () => {
  it('mirrors the declared EnvelopeStatus union exactly', () => {
    expect(EnvelopeStatusSchema.options).toEqual([
      'draft',
      'sent',
      'viewed',
      'partially_signed',
      'completing',
      'completed',
      'declined',
      'rejected',
      'expired',
      'voided',
    ]);
  });
});

describe('EnvelopeEntrySchema', () => {
  it('requires the fields every list consumer reads', () => {
    for (const missing of ['id', 'title', 'status', 'client_id', 'created_at']) {
      const entry: Record<string, unknown> = { ...validEnvelope };
      delete entry[missing];
      expect(EnvelopeEntrySchema.safeParse(entry).success, `missing ${missing}`).toBe(false);
    }
  });
});
