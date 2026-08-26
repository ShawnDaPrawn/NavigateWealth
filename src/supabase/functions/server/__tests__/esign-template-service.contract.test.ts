/**
 * esign-template-service.ts — template CRUD and versioning contracts
 * ==================================================================
 *
 * A template is the shape of an agreement: who signs, in what order, and where
 * the fields sit on the page. Envelopes record the template *version* they were
 * raised under so a later edit cannot retroactively change what a client was
 * asked to sign — which makes the version-bump rule the load-bearing part of
 * this module, and the reason it is pinned field by field here.
 *
 * Real collaborators: the in-memory KV and the real key builders. Only the
 * document-cloning boundary (storage, PDF transform, envelope documents) is
 * stubbed, and the CRUD paths under test never reach it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-storage.ts', () => ({
  calculateHash: vi.fn(async () => 'hash'),
  downloadDocument: vi.fn(async () => new Uint8Array(0)),
  extractPageCount: vi.fn(() => 1),
  uploadDocument: vi.fn(async () => ({ path: 'firm/doc.pdf', error: null })),
}));
vi.mock('../esign-documents.ts', () => ({ getEnvelopeDocuments: vi.fn(async () => []) }));
vi.mock('../esign-pdf-transform.ts', () => ({
  applyManifest: vi.fn(async () => new Uint8Array(0)),
}));
vi.mock('../esign-services.tsx', () => ({ createDocument: vi.fn(async () => undefined) }));

import * as kv from '../kv_store.tsx';
import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplateVersion,
  incrementUsageCount,
  listTemplateVersions,
  listTemplates,
  updateTemplate,
  type EsignTemplateRecord,
} from '../esign-template-service.ts';

const RECIPIENTS = [
  { name: 'Thandi Nkosi', email: 'thandi@example.co.za', role: 'Client', order: 1 },
];
const FIELDS = [{ type: 'signature', page: 1, x: 100, y: 200, recipientIndex: 0 }];

const newTemplate = (overrides: Record<string, unknown> = {}) =>
  createTemplate({
    name: 'Discretionary mandate',
    createdBy: 'adviser-1',
    recipients: RECIPIENTS,
    fields: FIELDS,
    ...overrides,
  } as Parameters<typeof createTemplate>[0]);

const storedTemplate = (id: string) =>
  kvStore.get(EsignKeys.template(id)) as EsignTemplateRecord | undefined;

const listIndex = () => (kvStore.get(EsignKeys.templatesList()) as string[] | undefined) ?? [];

beforeEach(() => {
  kvStore.clear();
});

describe('createTemplate', () => {
  it('records the template and adds it to the list index', async () => {
    const template = await newTemplate({ description: '  A mandate  ', category: ' Mandates ' });

    expect(template).toMatchObject({
      name: 'Discretionary mandate',
      description: 'A mandate',
      category: 'Mandates',
      createdBy: 'adviser-1',
      usageCount: 0,
      version: 1,
    });
    expect(storedTemplate(template.id)).toEqual(template);
    expect(listIndex()).toEqual([template.id]);
  });

  it('trims the name, because it is what an adviser searches by', async () => {
    const template = await newTemplate({ name: '   Living annuity switch   ' });

    expect(template.name).toBe('Living annuity switch');
  });

  it('defaults to sequential signing and a 30-day expiry', async () => {
    // Sequential is the safer default: parallel lets a later signer see the
    // document before an earlier one has agreed to it.
    const template = await newTemplate();

    expect(template.signingMode).toBe('sequential');
    expect(template.defaultExpiryDays).toBe(30);
  });

  it('honours an explicit signing mode and expiry', async () => {
    const template = await newTemplate({ signingMode: 'parallel', defaultExpiryDays: 7 });

    expect(template).toMatchObject({ signingMode: 'parallel', defaultExpiryDays: 7 });
  });

  it('treats a zero expiry as unset rather than as immediate', async () => {
    // `|| 30` means 0 falls back. An envelope that expired the moment it was
    // sent would be worse than one that lasts a month.
    const template = await newTemplate({ defaultExpiryDays: 0 });

    expect(template.defaultExpiryDays).toBe(30);
  });

  it('starts every collection as an empty array rather than undefined', async () => {
    const template = await createTemplate({ name: 'Bare', createdBy: 'adviser-1' });

    expect(template.recipients).toEqual([]);
    expect(template.documents).toEqual([]);
    expect(template.fields).toEqual([]);
  });

  it('appends to the index without disturbing what is already there', async () => {
    const first = await newTemplate({ name: 'First' });
    const second = await newTemplate({ name: 'Second' });

    expect(listIndex()).toEqual([first.id, second.id]);
  });
});

describe('getTemplate', () => {
  it('returns null for an unknown id', async () => {
    await expect(getTemplate('no-such-template')).resolves.toBeNull();
  });

  it('repairs a record written before the version field existed', async () => {
    kvStore.set(EsignKeys.template('legacy'), {
      id: 'legacy',
      name: 'Legacy',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const template = await getTemplate('legacy');

    expect(template).toMatchObject({ version: 1, documents: [], recipients: [], fields: [] });
  });

  it('repairs a collection that was stored as something other than an array', async () => {
    // A malformed row must not crash the templates list — an adviser cannot fix
    // what they cannot open.
    kvStore.set(EsignKeys.template('broken'), {
      id: 'broken',
      name: 'Broken',
      version: 2,
      recipients: { '0': 'not an array' },
      documents: null,
      fields: 'nope',
    });

    const template = await getTemplate('broken');

    expect(template).toMatchObject({ version: 2, recipients: [], documents: [], fields: [] });
  });

  it('returns null rather than throwing when the store fails', async () => {
    const get = vi.mocked(kv.get);
    const original = get.getMockImplementation()!;
    get.mockRejectedValueOnce(new Error('KV unavailable'));
    try {
      await expect(getTemplate('anything')).resolves.toBeNull();
    } finally {
      get.mockImplementation(original);
    }
  });
});

describe('listTemplates', () => {
  it('returns the newest template first', async () => {
    const older = await newTemplate({ name: 'Older' });
    const newer = await newTemplate({ name: 'Newer' });
    kvStore.set(EsignKeys.template(older.id), {
      ...storedTemplate(older.id),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    kvStore.set(EsignKeys.template(newer.id), {
      ...storedTemplate(newer.id),
      createdAt: '2026-06-01T00:00:00.000Z',
    });

    const templates = await listTemplates();

    expect(templates.map((t) => t.name)).toEqual(['Newer', 'Older']);
  });

  it('returns an empty list when the index is empty', async () => {
    await expect(listTemplates()).resolves.toEqual([]);
  });

  it('skips an index entry whose record has gone', async () => {
    const template = await newTemplate();
    kvStore.set(EsignKeys.templatesList(), [template.id, 'dangling-id']);

    const templates = await listTemplates();

    expect(templates.map((t) => t.id)).toEqual([template.id]);
  });
});

describe('updateTemplate — the version rule', () => {
  it('bumps the version and snapshots the old one when the agreement changes', async () => {
    const template = await newTemplate();

    const updated = await updateTemplate(template.id, {
      fields: [...FIELDS, { type: 'date', page: 1, x: 10, y: 20, recipientIndex: 0 }],
    } as Partial<EsignTemplateRecord>);

    expect(updated?.version).toBe(2);
    // The snapshot is what an envelope raised under v1 will read back. Without
    // it, "which document did the client actually sign" has no answer.
    expect(kvStore.get(EsignKeys.templateVersion(template.id, 1))).toMatchObject({
      version: 1,
      fields: FIELDS,
    });
    expect(kvStore.get(EsignKeys.templateVersionsIndex(template.id))).toEqual([1]);
  });

  it.each([
    ['signingMode', { signingMode: 'parallel' }],
    ['recipients', { recipients: [] }],
    ['documents', { documents: [{ documentId: 'doc-1' }] }],
    ['fields', { fields: [] }],
    ['defaultExpiryDays', { defaultExpiryDays: 14 }],
  ])('bumps the version when %s changes', async (_label, updates) => {
    const template = await newTemplate();

    const updated = await updateTemplate(template.id, updates as Partial<EsignTemplateRecord>);

    expect(updated?.version).toBe(2);
  });

  it.each([
    ['name', { name: 'Renamed mandate' }],
    ['description', { description: 'Clearer wording' }],
    ['category', { category: 'Discretionary' }],
    ['defaultMessage', { defaultMessage: 'Please sign at your convenience.' }],
  ])('does NOT bump the version when only %s changes', async (_label, updates) => {
    // A typo fix in the covering note is not a change to the agreement. Bumping
    // here would strand every in-flight envelope on a superseded version for no
    // reason.
    const template = await newTemplate();

    const updated = await updateTemplate(template.id, updates as Partial<EsignTemplateRecord>);

    expect(updated?.version).toBe(1);
    expect(kvStore.has(EsignKeys.templateVersion(template.id, 1))).toBe(false);
  });

  it('does not bump when a versioned field is re-submitted unchanged', async () => {
    // The UI sends the whole record back on every save, so a no-op save must not
    // manufacture a version.
    const template = await newTemplate();

    const updated = await updateTemplate(template.id, {
      fields: FIELDS,
      recipients: RECIPIENTS,
      signingMode: 'sequential',
    } as Partial<EsignTemplateRecord>);

    expect(updated?.version).toBe(1);
  });

  it('ignores a versioned key that is omitted rather than treating it as cleared', async () => {
    const template = await newTemplate();

    const updated = await updateTemplate(template.id, { name: 'Same shape, new name' });

    expect(updated).toMatchObject({ version: 1, recipients: RECIPIENTS, fields: FIELDS });
  });

  it('keeps bumping across successive changes and records each snapshot', async () => {
    const template = await newTemplate();
    await updateTemplate(template.id, { defaultExpiryDays: 14 });
    await updateTemplate(template.id, { defaultExpiryDays: 21 });

    const live = await getTemplate(template.id);

    expect(live?.version).toBe(3);
    expect(kvStore.get(EsignKeys.templateVersionsIndex(template.id))).toEqual([1, 2]);
    expect(
      (kvStore.get(EsignKeys.templateVersion(template.id, 2)) as EsignTemplateRecord)
        .defaultExpiryDays,
    ).toBe(14);
  });

  it('still applies the update when snapshotting fails', async () => {
    // Losing the history is bad; refusing the edit because history could not be
    // written is worse — the adviser would be stuck.
    const template = await newTemplate();
    const set = vi.mocked(kv.set);
    const original = set.getMockImplementation()!;
    set.mockImplementationOnce(async () => {
      throw new Error('KV unavailable');
    });
    try {
      const updated = await updateTemplate(template.id, { defaultExpiryDays: 14 });
      expect(updated).toMatchObject({ version: 2, defaultExpiryDays: 14 });
    } finally {
      set.mockImplementation(original);
    }
  });
});

describe('updateTemplate — what a caller cannot change', () => {
  it('refuses to move the id, creator, creation time, usage count or version', async () => {
    const template = await newTemplate();
    await incrementUsageCount(template.id);

    const updated = await updateTemplate(template.id, {
      id: 'hijacked',
      createdBy: 'someone-else',
      createdAt: '1999-01-01T00:00:00.000Z',
      usageCount: 9999,
      version: 42,
      name: 'Renamed',
    } as Partial<EsignTemplateRecord>);

    expect(updated).toMatchObject({
      id: template.id,
      createdBy: 'adviser-1',
      createdAt: template.createdAt,
      usageCount: 1,
      version: 1,
      name: 'Renamed',
    });
    expect(kvStore.has(EsignKeys.template('hijacked'))).toBe(false);
  });

  it('moves updatedAt on every save', async () => {
    const template = await newTemplate();
    kvStore.set(EsignKeys.template(template.id), {
      ...storedTemplate(template.id),
      updatedAt: '2020-01-01T00:00:00.000Z',
    });

    const updated = await updateTemplate(template.id, { name: 'Touched' });

    expect(updated?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('reports a miss rather than creating a template', async () => {
    await expect(updateTemplate('no-such-template', { name: 'Ghost' })).resolves.toBeNull();
    expect(kvStore.has(EsignKeys.template('no-such-template'))).toBe(false);
  });
});

describe('getTemplateVersion', () => {
  it('serves the live record when the requested version is the current one', async () => {
    const template = await newTemplate();

    await expect(getTemplateVersion(template.id, 1)).resolves.toMatchObject({
      id: template.id,
      version: 1,
    });
  });

  it('serves the snapshot for a superseded version', async () => {
    const template = await newTemplate();
    await updateTemplate(template.id, { defaultExpiryDays: 14 });

    const v1 = await getTemplateVersion(template.id, 1);
    const v2 = await getTemplateVersion(template.id, 2);

    expect(v1?.defaultExpiryDays).toBe(30);
    expect(v2?.defaultExpiryDays).toBe(14);
  });

  it('returns null for a version that was never recorded', async () => {
    const template = await newTemplate();

    await expect(getTemplateVersion(template.id, 7)).resolves.toBeNull();
  });

  it('still serves a snapshot after the live template is deleted', async () => {
    // An envelope raised under v1 has to remain explainable even once the
    // template itself is retired.
    const template = await newTemplate();
    await updateTemplate(template.id, { defaultExpiryDays: 14 });
    await deleteTemplate(template.id);

    await expect(getTemplateVersion(template.id, 1)).resolves.toMatchObject({ version: 1 });
  });
});

describe('listTemplateVersions', () => {
  it('lists every version ascending and marks the live one', async () => {
    const template = await newTemplate();
    await updateTemplate(template.id, { defaultExpiryDays: 14 });
    await updateTemplate(template.id, { defaultExpiryDays: 21 });

    const versions = await listTemplateVersions(template.id);

    expect(versions.map((v) => ({ version: v.version, isLive: v.isLive }))).toEqual([
      { version: 1, isLive: false },
      { version: 2, isLive: false },
      { version: 3, isLive: true },
    ]);
    expect(versions.every((v) => v.record !== null)).toBe(true);
  });

  it('reports the single live version for a template never edited', async () => {
    const template = await newTemplate();

    const versions = await listTemplateVersions(template.id);

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, isLive: true });
  });

  it('returns nothing for a template that does not exist', async () => {
    await expect(listTemplateVersions('no-such-template')).resolves.toEqual([]);
  });
});

describe('incrementUsageCount', () => {
  it('counts each use and touches updatedAt', async () => {
    const template = await newTemplate();

    await incrementUsageCount(template.id);
    await incrementUsageCount(template.id);

    expect(storedTemplate(template.id)).toMatchObject({ usageCount: 2 });
  });

  it('does not bump the version, because a use is not an edit', async () => {
    const template = await newTemplate();

    await incrementUsageCount(template.id);

    expect(storedTemplate(template.id)?.version).toBe(1);
  });

  it('is a silent no-op for a template that has gone', async () => {
    await expect(incrementUsageCount('no-such-template')).resolves.toBeUndefined();
    expect(kvStore.has(EsignKeys.template('no-such-template'))).toBe(false);
  });
});

describe('deleteTemplate', () => {
  it('removes the record and its index entry, leaving the others alone', async () => {
    const kept = await newTemplate({ name: 'Kept' });
    const doomed = await newTemplate({ name: 'Doomed' });

    await expect(deleteTemplate(doomed.id)).resolves.toBe(true);

    expect(kvStore.has(EsignKeys.template(doomed.id))).toBe(false);
    expect(listIndex()).toEqual([kept.id]);
  });

  it('leaves the version snapshots in place', async () => {
    // Deleting the template must not destroy the evidence for envelopes already
    // signed under it.
    const template = await newTemplate();
    await updateTemplate(template.id, { defaultExpiryDays: 14 });

    await deleteTemplate(template.id);

    expect(kvStore.has(EsignKeys.templateVersion(template.id, 1))).toBe(true);
  });

  it('reports false for a template that is already gone', async () => {
    await expect(deleteTemplate('no-such-template')).resolves.toBe(false);
  });
});
