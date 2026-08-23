/**
 * Direct unit tests for the wizard's pure derivations. The component-level
 * net (EsignModule.wizardFlow.test.tsx) pins the wiring; these pin each
 * function's edge behaviour on its own, without a DOM in the way.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  templateHasSavedDocuments,
  mapTemplateRecipientsToWizard,
  toDraftSignerPayload,
  buildTemplateFieldsForEnvelope,
  attachSignerIndexes,
  toInviteSignerPayload,
  signersFromResumedEnvelope,
  deriveExpiryDays,
} from '../wizardDerivations';
import type { EsignEnvelope, EsignField, EsignTemplateRecord, SignerFormData } from '../types';

const template = (over: Partial<EsignTemplateRecord>): EsignTemplateRecord => ({
  id: 'tpl-1',
  name: 'T',
  signingMode: 'sequential',
  defaultExpiryDays: 30,
  recipients: [],
  documents: [],
  fields: [],
  usageCount: 0,
  version: 1,
  createdBy: 'x',
  createdAt: 'x',
  updatedAt: 'x',
  ...over,
});

const envelope = (over: Partial<EsignEnvelope>): EsignEnvelope =>
  ({
    id: 'env-1',
    client_id: '',
    title: 'E',
    status: 'draft',
    created_at: 'x',
    updated_at: 'x',
    ...over,
  }) as EsignEnvelope;

const signer = (over: Partial<SignerFormData>): SignerFormData => ({
  name: 'S',
  email: 's@x.co',
  otpRequired: false,
  ...over,
});

describe('templateHasSavedDocuments', () => {
  it('is true only for a template with at least one saved document', () => {
    expect(templateHasSavedDocuments(null)).toBe(false);
    expect(templateHasSavedDocuments(undefined)).toBe(false);
    expect(templateHasSavedDocuments(template({}))).toBe(false);
    expect(
      templateHasSavedDocuments(
        template({
          documents: [
            {
              documentId: 'd',
              order: 1,
              displayName: 'D',
              originalFilename: 'd.pdf',
              pageCount: 1,
              storagePath: 'p',
            },
          ],
        }),
      ),
    ).toBe(true);
  });
});

describe('mapTemplateRecipientsToWizard', () => {
  it('fills defaults: role Signer, order index+1, otpRequired false, never a system client', () => {
    const out = mapTemplateRecipientsToWizard(
      template({
        recipients: [
          { name: '', email: '', order: undefined as unknown as number, otpRequired: false },
          { name: 'Adv', email: 'a@x.co', role: 'Adviser', order: 9, otpRequired: true },
        ],
      }),
    );
    expect(out[0]).toEqual({
      name: '',
      email: '',
      role: 'Signer',
      order: 1,
      otpRequired: false,
      accessCode: undefined,
      kind: undefined,
      clientId: undefined,
      isSystemClient: false,
    });
    expect(out[1]).toMatchObject({ role: 'Adviser', order: 9, otpRequired: true });
  });
});

describe('toDraftSignerPayload', () => {
  it('defaults role and order per position', () => {
    const out = toDraftSignerPayload([signer({ role: undefined, order: undefined })]);
    expect(out[0]).toMatchObject({ role: 'Signer', order: 1 });
  });
});

describe('buildTemplateFieldsForEnvelope', () => {
  const tplField = {
    type: 'signature' as const,
    page: 2,
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    required: true,
    recipientIndex: 0,
  };

  it('returns [] for a template without fields', () => {
    expect(
      buildTemplateFieldsForEnvelope({
        envelope: envelope({}),
        template: template({}),
        signers: [signer({})],
      }),
    ).toEqual([]);
  });

  it('drops fields whose recipient index has no wizard signer', () => {
    const out = buildTemplateFieldsForEnvelope({
      envelope: envelope({}),
      template: template({ fields: [tplField, { ...tplField, recipientIndex: 5 }] }),
      signers: [signer({ email: 'only@x.co' })],
    });
    expect(out).toHaveLength(1);
    expect(out[0].signer_id).toBe('only@x.co');
  });

  it('maps the field onto the live document via documentMap, else the primary document', () => {
    const out = buildTemplateFieldsForEnvelope({
      envelope: envelope({ document_id: 'primary-doc' }),
      template: template({
        fields: [{ ...tplField, documentId: 'tpl-doc' }, tplField],
      }),
      signers: [signer({})],
      documentMap: { 'tpl-doc': 'live-doc' },
    });
    expect(out[0].document_id).toBe('live-doc');
    expect(out[1].document_id).toBe('primary-doc');
  });
});

describe('attachSignerIndexes', () => {
  const field = (signer_id: string): EsignField => ({
    id: 'f',
    envelope_id: 'env-1',
    type: 'signature',
    page: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    required: true,
    signer_id,
    metadata: {},
    created_at: 'x',
    updated_at: 'x',
  });

  it('resolves each field to its signer position; unknown emails fall back to 0', () => {
    const signers = [signer({ email: 'a@x.co' }), signer({ email: 'b@x.co' })];
    const out = attachSignerIndexes([field('b@x.co'), field('ghost@x.co')], signers);
    expect(out[0].signerIndex).toBe(1);
    expect(out[1].signerIndex).toBe(0);
  });
});

describe('toInviteSignerPayload', () => {
  it('passes fields through without inventing defaults', () => {
    const out = toInviteSignerPayload([signer({ role: undefined, order: undefined })]);
    expect(out[0]).toEqual({
      name: 'S',
      email: 's@x.co',
      phone: undefined,
      role: undefined,
      order: undefined,
      otpRequired: false,
      accessCode: undefined,
      clientId: undefined,
      smsOptIn: undefined,
    });
  });
});

describe('signersFromResumedEnvelope', () => {
  it('prefers real signer records and maps their snake_case fields', () => {
    const out = signersFromResumedEnvelope(
      envelope({
        signers: [
          {
            id: 's1',
            envelope_id: 'env-1',
            name: 'Dana',
            email: 'dana@x.co',
            role: 'Witness',
            order: 2,
            otp_required: true,
            access_code: 'ac',
            client_id: 'c-7',
            access_token: 't',
            status: 'pending',
            created_at: 'x',
            updated_at: 'x',
          },
        ],
        draft_signers: [{ name: 'Stale', email: 'stale@x.co' }],
      } as Partial<EsignEnvelope>),
    );
    expect(out).toEqual([
      {
        name: 'Dana',
        email: 'dana@x.co',
        role: 'Witness',
        order: 2,
        otpRequired: true,
        accessCode: 'ac',
        clientId: 'c-7',
        isSystemClient: true,
      },
    ]);
  });

  it('falls back to the legacy requires_otp flag when otp_required is absent', () => {
    const out = signersFromResumedEnvelope(
      envelope({
        signers: [
          {
            id: 's1',
            envelope_id: 'env-1',
            name: 'R',
            email: 'r@x.co',
            order: 1,
            otp_required: undefined as unknown as boolean,
            requires_otp: true,
            access_token: 't',
            status: 'pending',
            created_at: 'x',
            updated_at: 'x',
          } as never,
        ],
      }),
    );
    expect(out[0].otpRequired).toBe(true);
  });

  it('uses draft_signers when no real records exist, inferring isSystemClient from clientId', () => {
    const out = signersFromResumedEnvelope(
      envelope({
        signers: [],
        draft_signers: [
          { name: 'A', email: 'a@x.co' },
          { name: 'B', email: 'b@x.co', clientId: 'c-1' },
        ],
      } as Partial<EsignEnvelope>),
    );
    expect(out[0]).toMatchObject({ role: 'Signer', otpRequired: false, isSystemClient: false });
    expect(out[1]).toMatchObject({ clientId: 'c-1', isSystemClient: true });
  });

  it('returns [] when the envelope carries neither source', () => {
    expect(signersFromResumedEnvelope(envelope({}))).toEqual([]);
  });
});

describe('deriveExpiryDays', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const ref = Date.UTC(2026, 7, 1);

  it('rounds partial days up', () => {
    expect(deriveExpiryDays(new Date(ref + 9.2 * DAY).toISOString(), ref, 30)).toBe(10);
  });

  it('falls back when the timestamp is missing, past, or unparseable', () => {
    expect(deriveExpiryDays(undefined, ref, 30)).toBe(30);
    expect(deriveExpiryDays(new Date(ref - DAY).toISOString(), ref, 30)).toBe(30);
    expect(deriveExpiryDays('not-a-date', ref, 30)).toBe(30);
  });
});
