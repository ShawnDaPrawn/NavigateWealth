/**
 * Two references that must survive the move to recipient keys and to fresh
 * field ids at send (Codex review on PR #515):
 *
 *  - Saving a draft as a template maps each field to its recipient SLOT. The
 *    map only knew emails, so once fields pointed at recipient keys every
 *    field — the second signer's signature included — fell to recipient 1.
 *  - Sending gives every field a new id. Conditional rules and calculated
 *    formulas name other fields by their draft id and must be rewritten, or
 *    a field shown "when the box is ticked" stays hidden whatever happens.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});
vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: new Proxy({}, { get: () => vi.fn(async () => undefined) }),
  dualWriteEnabled: false,
}));
vi.mock('../esign-storage.ts', () => ({
  uploadDocument: vi.fn(async () => ({ path: 'templates/doc.pdf' })),
  downloadDocument: vi.fn(async () => new Uint8Array([1, 2, 3])),
  calculateHash: vi.fn(async () => 'sha256:test'),
  getDocumentUrl: vi.fn(async () => 'https://signed.test/x'),
  extractPageCount: vi.fn(async () => 1),
  validateDocument: vi.fn(async () => ({ valid: true })),
}));

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';
import {
  addFieldsToEnvelope,
  getEnvelopeDetails,
  remapFieldReferences,
} from '../esign-services.ts';
import { createTemplateFromEnvelope } from '../esign-template-service.ts';
import type { EsignField } from '../esign-types.ts';

beforeEach(() => kvStore.clear());

describe('saving a draft as a template', () => {
  it('maps keyed fields to the right recipient slot', async () => {
    kvStore.set(EsignKeys.envelope('env-t'), {
      id: 'env-t',
      title: 'Joint mandate',
      status: 'draft',
      document_id: 'doc-t',
      firm_id: 'f',
      draft_signers: [
        { recipientKey: 'r_a', name: 'A', email: 'home@x.co', role: 'Client', order: 1 },
        // Shares the address — only the key tells the two apart.
        { recipientKey: 'r_b', name: 'B', email: 'home@x.co', role: 'Spouse', order: 2 },
      ],
    });
    kvStore.set(EsignKeys.PREFIX_DOCUMENT + 'doc-t', {
      id: 'doc-t',
      storage_path: 'esign/doc.pdf',
      page_count: 1,
    });
    const field = (id: string, signer: string) => ({
      id,
      envelope_id: 'env-t',
      signer_id: signer,
      type: 'signature',
      page: 1,
      x: 1,
      y: 1,
      width: 100,
      height: 30,
      required: true,
    });
    kvStore.set(EsignKeys.field('fa'), field('fa', 'r_a'));
    kvStore.set(EsignKeys.field('fb'), field('fb', 'r_b'));
    kvStore.set(EsignKeys.envelopeFields('env-t'), ['fa', 'fb']);

    const tpl = await createTemplateFromEnvelope({
      envelopeId: 'env-t',
      name: 'Joint mandate',
      createdBy: 'adviser',
    });
    expect(tpl).toBeTruthy();
    expect(tpl!.fields.map((f) => f.recipientIndex)).toEqual([0, 1]);
  });
});

describe('field references at send', () => {
  it('rewrites conditional sources and formula tokens; leaves unknown ids', () => {
    const idMap = new Map([
      ['draft-box', 'new-box'],
      ['draft-a', 'new-a'],
    ]);
    const out = remapFieldReferences(
      {
        label: 'x',
        conditional: {
          rules: [
            { sourceFieldId: 'draft-box', operator: 'is_checked' },
            { sourceFieldId: 'elsewhere', operator: 'is_filled' },
          ],
          clearOnHide: true,
        },
        calculated: { formula: '{field:draft-a} * 2 + {field:other}', precision: 2 },
      },
      idMap,
    );
    expect(out).toEqual({
      label: 'x',
      conditional: {
        rules: [
          { sourceFieldId: 'new-box', operator: 'is_checked' },
          { sourceFieldId: 'elsewhere', operator: 'is_filled' },
        ],
        clearOnHide: true,
      },
      calculated: { formula: '{field:new-a} * 2 + {field:other}', precision: 2 },
    });
  });

  it('stores sent fields whose rules point at the sent ids', async () => {
    kvStore.set(EsignKeys.envelope('env-s'), { id: 'env-s', status: 'draft', document_id: 'd' });
    await addFieldsToEnvelope('env-s', [
      {
        id: 'draft-box',
        signerId: 's1',
        type: 'checkbox',
        page: 1,
        x: 1,
        y: 1,
        width: 10,
        height: 10,
        required: false,
      },
      {
        id: 'draft-detail',
        signerId: 's1',
        type: 'text',
        page: 1,
        x: 1,
        y: 5,
        width: 100,
        height: 14,
        required: true,
        metadata: {
          conditional: { rules: [{ sourceFieldId: 'draft-box', operator: 'is_checked' }] },
        },
      },
    ]);
    const fields = ((await getEnvelopeDetails('env-s'))?.fields ?? []) as EsignField[];
    const box = fields.find((f) => f.type === 'checkbox')!;
    const detail = fields.find((f) => f.type === 'text')!;
    expect(box.id).not.toBe('draft-box');
    expect(
      (detail.metadata as { conditional: { rules: Array<{ sourceFieldId: string }> } }).conditional
        .rules[0].sourceFieldId,
    ).toBe(box.id);
  });
});
