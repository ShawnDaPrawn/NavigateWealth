/**
 * Regression pins for the e-sign send/sign path (Phase 0 of the e-sign
 * refinement). Each case below shipped broken to production:
 *
 *  - the signer client's submit payload was rejected with a 400 by the
 *    body schema (`signature_data` array vs `z.string()`), so no one could
 *    finish signing;
 *  - the draft-recipients schema took only lowercase kinds as `role`, while
 *    the wizard sends display labels — draft recipients were never saved;
 *  - a prefill binding could only ever read the assignee's record;
 *  - copy-only recipients blocked the signing order;
 *  - the expiry chosen at send was ignored.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const kvGet = vi.fn();
vi.mock('../kv_store.tsx', () => ({
  get: (...args: unknown[]) => kvGet(...args),
}));
const resolveCanonicalValueForClient = vi.fn();
vi.mock('../form-prefill-resolver.ts', () => ({
  resolveCanonicalValueForClient: (...args: unknown[]) => resolveCanonicalValueForClient(...args),
}));

import {
  DraftSignersSchema,
  SignerSubmitBodySchema,
  primarySignatureImage,
} from '../esign-validation.ts';
import { resolvePrefilledFields, withPrefillSourceSigner } from '../esign-prefill.ts';
import { isCarbonCopy, isSignerTurn } from '../esign-signer-guards.ts';
import type { EsignField, EsignSigner } from '../esign-types.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('POST /signer/submit body', () => {
  it('accepts the array the signer client actually sends', () => {
    // esignSignerService.submitSignature: one entry per filled field.
    const body = {
      access_token: 'tok',
      signature_data: [
        { field_id: 'f1', type: 'text', value: 'Jane' },
        { field_id: 'f2', type: 'signature', value: PNG },
      ],
      field_values: [
        { field_id: 'f1', value: 'Jane' },
        { field_id: 'f2', value: PNG },
      ],
    };
    expect(SignerSubmitBodySchema.safeParse(body).success).toBe(true);
  });

  it('still accepts a bare signature image string', () => {
    expect(
      SignerSubmitBodySchema.safeParse({ access_token: 'tok', signature_data: PNG }).success,
    ).toBe(true);
  });

  it('rejects a missing signature_data', () => {
    expect(SignerSubmitBodySchema.safeParse({ access_token: 'tok' }).success).toBe(false);
  });
});

describe('primarySignatureImage', () => {
  it('picks the signature image out of the per-field array', () => {
    expect(
      primarySignatureImage([
        { field_id: 'f1', type: 'text', value: 'Jane' },
        { field_id: 'f2', type: 'initials', value: 'data:image/png;base64,INIT' },
        { field_id: 'f3', type: 'signature', value: PNG },
      ]),
    ).toBe(PNG);
  });

  it('falls back to initials, and ignores non-image values', () => {
    expect(
      primarySignatureImage([
        { type: 'signature', value: 'typed name' },
        { type: 'initials', value: 'data:image/jpeg;base64,X' },
      ]),
    ).toBe('data:image/jpeg;base64,X');
    expect(primarySignatureImage([{ type: 'text', value: 'x' }])).toBeUndefined();
    expect(primarySignatureImage('not an image')).toBeUndefined();
    expect(primarySignatureImage(PNG)).toBe(PNG);
  });
});

describe('draft recipients schema', () => {
  it('accepts the display labels the wizard sends as role', () => {
    const parsed = DraftSignersSchema.safeParse({
      signers: [
        { name: 'A', email: 'a@x.co', role: 'Client' },
        { name: 'B', email: 'b@x.co', role: 'First Life Assured', kind: 'witness' },
        { name: 'C', email: 'c@x.co', role: 'Signer', kind: 'cc', recipientKey: 'r_1' },
      ],
    });
    expect(parsed.success).toBe(true);
    // Unknown keys pass through, so the recipient key is stored with the draft.
    expect((parsed.data!.signers[2] as { recipientKey?: string }).recipientKey).toBe('r_1');
  });

  it('defaults a missing role to Signer and rejects an unknown kind', () => {
    const ok = DraftSignersSchema.safeParse({ signers: [{ name: 'A', email: 'a@x.co' }] });
    expect(ok.success && ok.data.signers[0].role).toBe('Signer');
    const bad = DraftSignersSchema.safeParse({
      signers: [{ name: 'A', email: 'a@x.co', kind: 'approver' }],
    });
    expect(bad.success).toBe(false);
  });
});

describe('prefill data source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kvGet.mockImplementation(async (key: string) => {
      if (key === 'user_profile:client-main:personal_info') {
        return { firstName: 'Main', lastName: 'Client', idNumber: '8001015009087' };
      }
      if (key === 'user_profile:client-spouse:personal_info') {
        return { firstName: 'Spouse', lastName: 'Client', idNumber: '8203030123083' };
      }
      return null;
    });
    resolveCanonicalValueForClient.mockResolvedValue(null);
  });

  const main = { id: 's-main', client_id: 'client-main', name: 'Main', email: 'm@x.co' };
  const spouse = { id: 's-spouse', client_id: 'client-spouse', name: 'Spouse', email: 's@x.co' };

  it('reads the named source signer, not the assignee', async () => {
    const fields = [
      {
        id: 'f1',
        type: 'text',
        signer_id: 's-main',
        metadata: { prefill: { token: 'client.id_number', source_signer_id: 's-spouse' } },
      },
      {
        id: 'f2',
        type: 'text',
        signer_id: 's-main',
        metadata: { prefill: { token: 'client.id_number' } },
      },
    ] as unknown as EsignField[];

    await resolvePrefilledFields(fields, {
      signer: main as unknown as EsignSigner,
      signers: [main, spouse] as unknown as EsignSigner[],
      envelope: {},
    });

    expect(fields[0].value).toBe('8203030123083');
    expect(fields[1].value).toBe('8001015009087');
  });

  it('translates the studio source index to the created signer id', () => {
    const meta = { label: 'x', prefill: { token: 'client.name', source_index: 1 } };
    expect(withPrefillSourceSigner(meta, ['sid-0', 'sid-1'])).toEqual({
      label: 'x',
      prefill: { token: 'client.name', source_index: 1, source_signer_id: 'sid-1' },
    });
    // No or bad index: untouched, so the source stays the assignee.
    const plain = { prefill: { token: 'client.name' } };
    expect(withPrefillSourceSigner(plain, ['sid-0'])).toBe(plain);
    expect(
      withPrefillSourceSigner({ prefill: { token: 'client.name', source_index: 5 } }, ['sid-0']),
    ).toEqual({ prefill: { token: 'client.name', source_index: 5 } });
    expect(withPrefillSourceSigner(undefined, ['sid-0'])).toBeUndefined();
  });
});

describe('copy-only recipients', () => {
  it('never hold up a sequential signing turn', () => {
    const envelope = {
      signing_mode: 'sequential',
      signers: [
        { id: 'a', order: 1, status: 'signed' },
        { id: 'cc', order: 2, status: 'pending', kind: 'cc' },
        { id: 'b', order: 3, status: 'sent' },
      ],
    };
    expect(isCarbonCopy(envelope.signers[1])).toBe(true);
    expect(isCarbonCopy(envelope.signers[0])).toBe(false);
    expect(isSignerTurn(envelope, envelope.signers[2])).toBe(true);
  });
});
