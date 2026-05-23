import { describe, expect, it, vi, beforeEach } from 'vitest';

const kvGet = vi.fn();

vi.mock('../kv_store.tsx', () => ({
  get: (...args: unknown[]) => kvGet(...args),
}));

const resolveCanonicalValueForClient = vi.fn();

vi.mock('../form-prefill-resolver.ts', () => ({
  resolveCanonicalValueForClient: (...args: unknown[]) => resolveCanonicalValueForClient(...args),
}));

import { resolvePrefilledFields } from '../esign-prefill.ts';
import type { EsignField, EsignSigner } from '../esign-types.ts';

const clientId = '11111111-1111-1111-1111-111111111111';

describe('esign-prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvGet.mockResolvedValue({
      personalInformation: {
        firstName: 'Taylor',
        lastName: 'Example',
        profile_tax_number: '9876543210',
      },
    });
    resolveCanonicalValueForClient.mockImplementation(async (_id: string, key: string) => {
      if (key === 'profile_first_name') return { value: 'Taylor', source: 'profile' };
      if (key === 'derived:full_name') return { value: 'Taylor Example', source: 'derived' };
      return null;
    });
  });

  it('resolves key: tokens via unified resolver', async () => {
    const fields: EsignField[] = [
      {
        id: 'f1',
        type: 'text',
        value: '',
        metadata: { prefill: { token: 'key:profile_first_name' } },
      },
    ];
    const signer: EsignSigner = {
      id: 's1',
      client_id: clientId,
      email: 't@example.com',
      name: 'Taylor Example',
    };

    const resolved = await resolvePrefilledFields(fields, {
      signer,
      envelope: {},
    });

    expect(resolved).toBe(1);
    expect(fields[0].value).toBe('Taylor');
    expect(resolveCanonicalValueForClient).toHaveBeenCalledWith(clientId, 'profile_first_name');
  });
});
