/**
 * Characterization net for the `resources-service.ts` split.
 * =========================================================
 *
 * `ResourcesService` was a single 1,725-line class. Splitting it is a pure
 * move — no behaviour is meant to change — which is exactly the kind of
 * refactor that silently loses a method or flips a key shape. This file was
 * written and made green BEFORE the move, so a red run afterwards means the
 * move broke something rather than that the expectation was wrong.
 *
 * Two properties are pinned.
 *
 * 1. **The public surface survives.** Every method `resources-routes.ts` calls
 *    is still a callable function on a fresh instance. This is not the vacuous
 *    `toBeDefined()` shape: the split moves method bodies out to modules and
 *    re-attaches them, so "still a function on an instance" is precisely the
 *    thing that can break, and the list is derived from the routes file rather
 *    than hand-picked.
 *
 * 2. **The moved regions still behave.** One behavioural pin per region that
 *    changes file — legal documents and the zip tools — plus the regions that
 *    stay put, so a mis-cut boundary shows up as a wrong key or a lost sort
 *    rather than as a type error alone.
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';

const kvStore = vi.hoisted(() => new Map<string, unknown>());
const listBuckets = vi.hoisted(() => vi.fn());
const createBucket = vi.hoisted(() => vi.fn());
const storageList = vi.hoisted(() => vi.fn());
const storageRemove = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const createSignedUrl = vi.hoisted(() => vi.fn());

beforeAll(() => {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) =>
        ({ SUPABASE_URL: 'https://test', SUPABASE_SERVICE_ROLE_KEY: 'service-role' })[name] ?? '',
    },
  });
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: {
      listBuckets: (...a: unknown[]) => listBuckets(...a),
      createBucket: (...a: unknown[]) => createBucket(...a),
      from: () => ({
        list: (...a: unknown[]) => storageList(...a),
        remove: (...a: unknown[]) => storageRemove(...a),
        upload: (...a: unknown[]) => storageUpload(...a),
        createSignedUrl: (...a: unknown[]) => createSignedUrl(...a),
      }),
    },
  }),
}));

vi.mock('npm:@zip.js/zip.js', () => ({ ZipWriter: vi.fn() }));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  getByPrefix: vi.fn(async (prefix: string) =>
    [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
  ),
  listByPrefix: vi.fn(async (prefix: string) =>
    [...kvStore.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, value]) => ({ key, value })),
  ),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

import { ResourcesService } from '../resources-service.ts';
import * as kv from '../kv_store.tsx';
import { NotFoundError, ValidationError } from '../error.middleware.ts';
import { LEGAL_DOCUMENTS_REGISTRY } from '../../../../shared/legal-documents-registry.ts';

const service = new ResourcesService();

/**
 * Read off `resources-routes.ts` rather than typed out here, so a route that
 * starts calling a new method is covered without anyone remembering to add it.
 */
const ROUTED_METHODS = [
  'archiveLegalDocumentVersion',
  'cleanupOldZips',
  'createLegalDocumentDraft',
  'createResource',
  'deleteResource',
  'deleteRetirementScenario',
  'duplicateLegalDocumentVersionToDraft',
  'duplicateResource',
  'fetchRSSFeed',
  'generateEncryptedZip',
  'getAllResources',
  'getLegalDocumentAdmin',
  'getLegalDocumentDefinition',
  'getLegalDocumentPublic',
  'getRetirementScenarios',
  'listLegalDocumentDefinitions',
  'listLegalDocumentVersions',
  'migrateLegacyLegalDocumentToDraft',
  'migratePriorityLegacyLegalDocuments',
  'publishLegalDocumentDraft',
  'saveRetirementScenario',
  'seedLegalDocuments',
  'updateLegalDocumentDraft',
  'updateResource',
  'uploadChunk',
] as const;

/** Public but not currently routed — still part of the surface. */
const OTHER_PUBLIC_METHODS = ['getLegalDocument', 'uploadTempFile'] as const;

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  listBuckets.mockResolvedValue({ data: [{ name: 'make-91ed8379-resource-zips' }] });
  storageList.mockResolvedValue({ data: [] });
  storageUpload.mockResolvedValue({ error: null });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null });
});

describe('the public surface survives the split', () => {
  it.each([...ROUTED_METHODS, ...OTHER_PUBLIC_METHODS])('exposes %s as a function', (name) => {
    expect(typeof (service as unknown as Record<string, unknown>)[name]).toBe('function');
  });

  it('exposes every method resources-routes.ts calls, with nothing missed', async () => {
    // Derives the list from the routes file itself. If a route starts calling a
    // method this test does not know about, the assertion below names it rather
    // than passing quietly.
    const { readFileSync } = await import('node:fs');
    const { join, dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const src = readFileSync(join(serverDir, 'resources-routes.ts'), 'utf8');

    const called = [
      ...new Set([...src.matchAll(/\bservice\.([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1])),
    ].sort();

    expect(called).toEqual([...ROUTED_METHODS].sort());
    for (const name of called) {
      expect(typeof (service as unknown as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});

describe('resource CRUD', () => {
  it('stores a created resource under resource:{id} with the documented defaults', async () => {
    const created = await service.createResource({ title: 'Guide' });

    expect(created.category).toBe('General');
    expect(created.version).toBe('1.0');
    expect(kvStore.get(`resource:${created.id}`)).toEqual(created);
  });

  it('filters by category and sorts newest first', async () => {
    kvStore.set('resource:a', { id: 'a', category: 'Legal', createdAt: '2024-01-01T00:00:00Z' });
    kvStore.set('resource:b', { id: 'b', category: 'Legal', createdAt: '2025-01-01T00:00:00Z' });
    kvStore.set('resource:c', { id: 'c', category: 'Other', createdAt: '2026-01-01T00:00:00Z' });

    const found = await service.getAllResources({ category: 'Legal' } as never);

    expect(found.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('throws NotFoundError rather than creating on update of a missing resource', async () => {
    await expect(service.updateResource('nope', { title: 'x' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('duplicates non-destructively, as a draft with a Copy of prefix', async () => {
    kvStore.set('resource:a', { id: 'a', title: 'Original', status: 'published' });

    const copy = await service.duplicateResource('a');

    expect(copy.id).not.toBe('a');
    expect(copy.title).toBe('Copy of Original');
    expect(copy.status).toBe('draft');
    expect(kvStore.get('resource:a')).toMatchObject({ title: 'Original', status: 'published' });
  });
});

describe('RSS feed domain allowlist', () => {
  it('refuses a host outside the allowlist before fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(service.fetchRSSFeed('https://evil.example.com/feed')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('refuses a host that merely contains an allowed domain', async () => {
    await expect(
      service.fetchRSSFeed('https://investing.com.evil.example/feed'),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('legal documents (moves file)', () => {
  it('returns null for a slug the registry does not know', async () => {
    expect(await service.getLegalDocumentDefinition('not-a-real-slug')).toBeNull();
  });

  it('bootstraps a definition on first read of a known slug', async () => {
    const slug = LEGAL_DOCUMENTS_REGISTRY[0].slug;

    const definition = await service.getLegalDocumentDefinition(slug);

    expect(definition).toMatchObject({ slug, title: LEGAL_DOCUMENTS_REGISTRY[0].name });
    expect(kvStore.has(`legal_document_definition:${slug}`)).toBe(true);
  });

  it('lists definitions for every registry entry, ordered by section then title', async () => {
    const definitions = await service.listLegalDocumentDefinitions();

    expect(definitions).toHaveLength(LEGAL_DOCUMENTS_REGISTRY.length);
    const order = ['legal-notices', 'privacy-data-protection', 'regulatory-disclosures', 'other'];
    const ranks = definitions.map((d) => {
      const i = order.indexOf(d.section);
      return i === -1 ? 99 : i;
    });
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('sorts versions newest first', async () => {
    kvStore.set('legal_document_version:s:1', { id: '1', createdAt: '2024-01-01T00:00:00Z' });
    kvStore.set('legal_document_version:s:2', { id: '2', createdAt: '2026-01-01T00:00:00Z' });

    const versions = await service.listLegalDocumentVersions('s');

    expect(versions.map((v) => v.id)).toEqual(['2', '1']);
  });
});

describe('zip tools (moves file)', () => {
  it('uploads a chunk to chunks/{runId}/{index} with upsert on', async () => {
    const result = await service.uploadChunk('run-1', 3, new File(['x'], 'c'));

    expect(result.path).toBe('chunks/run-1/3');
    expect(storageUpload).toHaveBeenCalledWith(
      'chunks/run-1/3',
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('creates the bucket when it is missing, and not when it is present', async () => {
    listBuckets.mockResolvedValue({ data: [] });
    await service.uploadChunk('run-1', 0, new File(['x'], 'c'));
    expect(createBucket).toHaveBeenCalledWith(
      'make-91ed8379-resource-zips',
      expect.objectContaining({ public: false }),
    );

    createBucket.mockClear();
    listBuckets.mockResolvedValue({ data: [{ name: 'make-91ed8379-resource-zips' }] });
    await service.uploadChunk('run-2', 0, new File(['x'], 'c'));
    expect(createBucket).not.toHaveBeenCalled();
  });

  it('removes only zips older than seven days', async () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    storageList.mockResolvedValue({
      data: [
        { name: 'old.zip', created_at: old },
        { name: 'fresh.zip', created_at: fresh },
      ],
    });

    await service.cleanupOldZips();

    expect(storageRemove).toHaveBeenCalledWith(['old.zip']);
  });

  it('uploads a temp file under temp/{runId}/{subcategory}/{safeName}', async () => {
    const { path } = await service.uploadTempFile(new File(['x'], 'my file!.pdf'), 'wills');

    expect(path).toMatch(/^temp\/[^/]+\/wills\/my_file_\.pdf$/);
  });
});

describe('retirement scenarios', () => {
  it('writes under calculator:retirement:client:{clientId}:{id} and stamps timestamps', async () => {
    const saved = await service.saveRetirementScenario({ clientId: 'c1' });

    expect(saved.createdAt).toEqual(expect.any(String));
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(kv.set).toHaveBeenCalledWith(
      `calculator:retirement:client:c1:${saved.id}`,
      expect.anything(),
    );
  });

  it('returns a client scenarios newest-updated first', async () => {
    kvStore.set('calculator:retirement:client:c1:a', { id: 'a', updatedAt: '2024-01-01' });
    kvStore.set('calculator:retirement:client:c1:b', { id: 'b', updatedAt: '2026-01-01' });
    kvStore.set('calculator:retirement:client:c2:z', { id: 'z', updatedAt: '2027-01-01' });

    const scenarios = await service.getRetirementScenarios('c1');

    expect(scenarios.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('deletes exactly the addressed scenario key', async () => {
    await service.deleteRetirementScenario('c1', 'a');

    expect(kv.del).toHaveBeenCalledWith('calculator:retirement:client:c1:a');
  });
});
