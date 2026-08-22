/**
 * Client-list schema properties (Stage C / F8).
 * =============================================
 *
 * These are pinned HERE, against the schema directly, rather than through
 * `useClientList` — because through the hook they are unfalsifiable. The hook
 * discards `parseContract`'s return value and reads the original response, so
 * a schema that silently strips every unknown key would leave every hook test
 * green. A mutation test caught exactly that: removing `.passthrough()` broke
 * nothing, which meant the hook test claiming to cover it was decorative.
 *
 * The distinction matters beyond this file. `parseContract` hands back the
 * PARSED value on success, so the moment any caller uses that return value, a
 * lossy schema stops being cosmetic and starts deleting data. The property has
 * to be guarded where it lives.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseContract,
  setContractViolationReporter,
  resetContractViolationReporter,
} from '../../../../../shared/contracts';
import { ClientListEnvelopeSchema, ClientListEntrySchema } from '../contracts';

const endpoint = { endpoint: 'test' };

afterEach(() => resetContractViolationReporter());

describe('ClientListEntrySchema is not lossy', () => {
  it('returns the nested payloads the transform depends on', () => {
    const entry = {
      id: 'user-1',
      email: 'a@example.com',
      profile: { personalInformation: { idNumber: '900101' } },
      application: { status: 'approved' },
      created_at: '2024-01-01T00:00:00Z',
    };

    const parsed = ClientListEntrySchema.parse(entry);

    // Without `.passthrough()` every one of these is silently dropped.
    expect(parsed).toMatchObject({
      profile: { personalInformation: { idNumber: '900101' } },
      application: { status: 'approved' },
      created_at: '2024-01-01T00:00:00Z',
    });
  });
});

describe('ClientListEnvelopeSchema is not lossy', () => {
  it('preserves both the entries and any unrecognised envelope fields', () => {
    const response = {
      clients: [{ id: 'user-1', email: 'a@example.com', profile: { nested: true } }],
      total: 1,
      somethingTheServerAddedLater: 'keep me',
    };

    const parsed = parseContract(ClientListEnvelopeSchema, response, endpoint) as Record<
      string,
      unknown
    >;

    expect(parsed.somethingTheServerAddedLater).toBe('keep me');
    expect((parsed.clients as { profile: unknown }[])[0].profile).toEqual({ nested: true });
  });
});

describe('ClientListEnvelopeSchema accepts both spellings of the list', () => {
  it.each([
    ['clients', { clients: [{ id: 'a', email: 'a@example.com' }] }],
    ['users (legacy)', { users: [{ id: 'a', email: 'a@example.com' }] }],
    [
      'both, during a migration',
      {
        clients: [{ id: 'a', email: 'a@example.com' }],
        users: [{ id: 'a', email: 'a@example.com' }],
      },
    ],
  ])('accepts %s without reporting', (_label, response) => {
    const reporter = vi.fn();
    setContractViolationReporter(reporter);

    parseContract(ClientListEnvelopeSchema, response, endpoint);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('rejects a response carrying neither', () => {
    const reporter = vi.fn();
    setContractViolationReporter(reporter);

    parseContract(ClientListEnvelopeSchema, { total: 0 }, endpoint);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0].issues).toContain('neither');
  });

  it('returns the original object unchanged when it rejects', () => {
    setContractViolationReporter(vi.fn());
    const response = { total: 0, page: 1 };

    const result = parseContract(ClientListEnvelopeSchema, response, endpoint);

    expect(result).toBe(response);
  });
});
