import { describe, expect, it } from 'vitest';
import {
  findRecipient,
  findRecipientIndex,
  isRecipient,
  newRecipientKey,
  normaliseFieldRecipients,
  recipientIdOf,
  withRecipientKeys,
} from '../recipientIdentity';
import {
  attachSignerIndexes,
  buildTemplateFieldsForEnvelope,
  toInviteSignerPayload,
  toDraftSignerPayload,
} from '../wizardDerivations';
import type { EsignEnvelope, EsignField, EsignTemplateRecord, SignerFormData } from '../types';

const signer = (over: Partial<SignerFormData>): SignerFormData => ({
  name: 'X',
  email: 'x@x.co',
  otpRequired: false,
  ...over,
});

const field = (over: Partial<EsignField>): EsignField =>
  ({
    id: 'f',
    envelope_id: 'e',
    type: 'signature',
    page: 1,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    required: true,
    created_at: '',
    updated_at: '',
    ...over,
  }) as EsignField;

describe('recipient identity', () => {
  it('tells apart two recipients who share one email address', () => {
    // Spouses often share an address. Keyed on email they were one person:
    // same colour, same fields, same send index.
    const a = signer({ recipientKey: 'r_a', name: 'Alex', email: 'home@x.co' });
    const b = signer({ recipientKey: 'r_b', name: 'Blake', email: 'home@x.co' });
    expect(findRecipientIndex([a, b], 'r_b')).toBe(1);
    expect(findRecipient([a, b], 'r_a')?.name).toBe('Alex');
  });

  it('keeps a field with its recipient when the email is edited', () => {
    const before = signer({ recipientKey: 'r_a', email: 'old@x.co' });
    const after = { ...before, email: 'new@x.co' };
    const f = field({ signer_id: recipientIdOf(before) });
    expect(findRecipient([after], f.signer_id)).toBe(after);
  });

  it('still resolves fields placed before recipients had keys (by email)', () => {
    const a = signer({ recipientKey: 'r_a', email: 'legacy@x.co' });
    expect(findRecipientIndex([a], 'legacy@x.co')).toBe(0);
    expect(isRecipient(a, 'legacy@x.co')).toBe(true);
    expect(isRecipient(a, 'r_a')).toBe(true);
    expect(isRecipient(a, 'someone@else.co')).toBe(false);
    expect(findRecipientIndex([a], undefined)).toBe(-1);
  });

  it('re-points legacy email fields at keys, leaving orphans alone', () => {
    const a = signer({ recipientKey: 'r_a', email: 'a@x.co' });
    const fields = [
      field({ id: '1', signer_id: 'a@x.co' }),
      field({ id: '2', signer_id: 'gone@x.co' }),
    ];
    const out = normaliseFieldRecipients(fields, [a]);
    expect(out.map((f) => f.signer_id)).toEqual(['r_a', 'gone@x.co']);
    // Nothing to change → same array (no needless re-render or unsaved flag).
    expect(normaliseFieldRecipients(out, [a])).toBe(out);
  });

  it('assigns keys once and keeps existing ones', () => {
    const list = [signer({ recipientKey: 'r_keep' }), signer({ email: 'new@x.co' })];
    const keyed = withRecipientKeys(list);
    expect(keyed[0].recipientKey).toBe('r_keep');
    expect(keyed[1].recipientKey).toMatch(/^r_/);
    expect(withRecipientKeys(keyed)).toBe(keyed);
    expect(newRecipientKey()).not.toBe(newRecipientKey());
  });
});

describe('send payload', () => {
  const a = signer({ recipientKey: 'r_a', name: 'A', email: 'a@x.co' });
  const b = signer({ recipientKey: 'r_b', name: 'B', email: 'b@x.co', kind: 'cc' });

  it('maps fields to recipient indexes and the prefill source to its index', () => {
    const fields = [
      field({
        id: '1',
        signer_id: 'r_a',
        metadata: { prefill: { token: 'client.name', locked: false, source: 'r_b' } },
      }),
      field({ id: '2', signer_id: 'r_b' }),
    ];
    const out = attachSignerIndexes(fields, [a, b]);
    expect(out[0].signerIndex).toBe(0);
    expect((out[0].metadata as { prefill: { source_index: number } }).prefill.source_index).toBe(1);
    expect(out[1].signerIndex).toBe(1);
  });

  it('sends each recipient kind, so copy-only recipients get no signing link', () => {
    expect(toInviteSignerPayload([a, b]).map((s) => s.kind)).toEqual([undefined, 'cc']);
  });

  it('saves the recipient key and kind with the draft', () => {
    expect(toDraftSignerPayload([b])[0]).toMatchObject({ recipientKey: 'r_b', kind: 'cc' });
  });
});

describe('applying a template', () => {
  it('re-points conditional rules and formulas at the new fields', () => {
    const template = {
      fields: [
        {
          key: 'k-box',
          type: 'checkbox',
          page: 1,
          x: 1,
          y: 1,
          width: 9,
          height: 9,
          required: false,
          recipientIndex: 0,
        },
        {
          key: 'k-detail',
          type: 'text',
          page: 1,
          x: 1,
          y: 5,
          width: 100,
          height: 14,
          required: true,
          recipientIndex: 0,
          metadata: {
            conditional: { rules: [{ sourceFieldId: 'k-box', operator: 'is_checked' }] },
            calculated: { formula: '{field:k-box} + 1' },
          },
        },
      ],
    } as unknown as EsignTemplateRecord;
    const out = buildTemplateFieldsForEnvelope({
      envelope: { id: 'env-9', document_id: 'doc-9' } as EsignEnvelope,
      template,
      signers: [signer({ recipientKey: 'r_a' })],
    });
    const box = out[0];
    const meta = out[1].metadata as {
      conditional: { rules: Array<{ sourceFieldId: string }> };
      calculated: { formula: string };
    };
    expect(meta.conditional.rules[0].sourceFieldId).toBe(box.id);
    expect(meta.calculated.formula).toBe(`{field:${box.id}} + 1`);
  });
});
