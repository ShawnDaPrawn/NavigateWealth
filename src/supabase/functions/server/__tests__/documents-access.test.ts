/**
 * documents.tsx — what a client can do to a document record.
 * ==========================================================
 *
 * The router checks that the caller may act for `:userId` (self, admin or the
 * assigned adviser). That was never the whole question:
 *
 *   - `PATCH` validated with `.passthrough()` and spread the result over the
 *     stored record, so a client could rewrite `filePath` on their OWN record
 *     to another client's file — and then download or delete it, because both
 *     trusted whatever path the record held.
 *   - `/link` stored any URL (the admin panel opens them with `window.open`),
 *     `DELETE` let a client remove the firm's record of what they were given,
 *     and `/email` let a client send firm-branded mail anywhere.
 *
 * Real: the router, its schemas and the client-access policy. Stubbed: the auth
 * guards (role-aware), storage and email.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const storage = vi.hoisted(() => ({
  createSignedUrl: vi.fn(async (path: string) => ({
    data: { signedUrl: `https://signed/${path}` },
    error: null,
  })),
  remove: vi.fn(async () => ({ error: null })),
}));
const email = vi.hoisted(() => ({ sendEmail: vi.fn(async () => true) }));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAuth: makeRoleGate(['client', 'adviser', 'admin', 'super_admin'], 'AUTH', 'client'),
    requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN'),
  };
});
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async () => null),
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: {
      listBuckets: async () => ({ data: [{ name: 'make-91ed8379-documents' }] }),
      createBucket: async () => ({ error: null }),
      from: () => ({ createSignedUrl: storage.createSignedUrl, remove: storage.remove }),
    },
  }),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: email.sendEmail,
  createEmailTemplate: vi.fn((c: string) => c),
  getFooterSettings: vi.fn(async () => ({})),
  getEmailTemplate: vi.fn(async () => null),
}));

const { kvStore, request } = await import('./helpers/contract-harness.ts');
const app = (await import('../documents.tsx')).default;

const DOC_KEY = 'document:client-a:doc-1';
const stored = () => kvStore.get(DOC_KEY) as Record<string, unknown>;

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  kvStore.set(DOC_KEY, {
    id: 'doc-1',
    userId: 'client-a',
    type: 'document',
    title: 'Policy schedule',
    fileName: 'schedule.pdf',
    filePath: 'client-a/1700000000_schedule.pdf',
    status: 'new',
    isFavourite: false,
  });
});

const asClientA = { as: 'client', user: 'client-a' } as const;

describe('PATCH — nobody rewrites where the file lives', () => {
  it("ignores a client's attempt to repoint filePath at another client's file", async () => {
    const res = await request(app, '/client-a/doc-1', {
      ...asClientA,
      method: 'PATCH',
      body: {
        isFavourite: true,
        filePath: 'client-b/1700000000_tax-return.pdf',
        sourceSystem: 'record-of-advice',
      },
    });
    expect(res.status).toBe(200);
    expect(stored()).toMatchObject({
      filePath: 'client-a/1700000000_schedule.pdf',
      isFavourite: true,
    });
    expect(stored().sourceSystem).toBeUndefined();
  });

  it('lets a client change only their own view of the record', async () => {
    await request(app, '/client-a/doc-1', {
      ...asClientA,
      method: 'PATCH',
      body: { title: 'Renamed by client', status: 'reviewed' },
    });
    expect(stored()).toMatchObject({ title: 'Policy schedule', status: 'reviewed' });
  });

  it('lets an admin edit descriptive fields, still not the path', async () => {
    await request(app, '/client-a/doc-1', {
      as: 'admin',
      method: 'PATCH',
      body: { title: 'Renamed by admin', filePath: 'elsewhere/x.pdf' },
    });
    expect(stored()).toMatchObject({
      title: 'Renamed by admin',
      filePath: 'client-a/1700000000_schedule.pdf',
    });
  });
});

describe('download — only a file inside the owner folder is ever signed', () => {
  it('signs the owner’s own file', async () => {
    const res = await request(app, '/client-a/doc-1/download', asClientA);
    expect(res.status).toBe(200);
    expect(storage.createSignedUrl).toHaveBeenCalledWith('client-a/1700000000_schedule.pdf', 3600);
  });

  it('refuses a record whose path points into another client’s folder', async () => {
    kvStore.set(DOC_KEY, { ...stored(), filePath: 'client-b/1700000000_tax-return.pdf' });
    const res = await request(app, '/client-a/doc-1/download', asClientA);
    expect(res.status).toBe(404);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses another client outright', async () => {
    const res = await request(app, '/client-a/doc-1/download', { as: 'client', user: 'client-b' });
    expect(res.status).toBe(403);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe('staff-only actions', () => {
  it('a client cannot delete the firm’s record of their document', async () => {
    const res = await request(app, '/client-a/doc-1', { ...asClientA, method: 'DELETE' });
    expect(res.status).toBe(403);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(stored()).toBeDefined();
  });

  it('an admin can, and only the file in the owner folder is removed', async () => {
    const res = await request(app, '/client-a/doc-1', { as: 'admin', method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['client-a/1700000000_schedule.pdf']);
  });

  it('a client cannot add a link record', async () => {
    const res = await request(app, '/client-a/link', {
      ...asClientA,
      method: 'POST',
      body: { title: 'x', url: 'https://example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('an admin cannot store a javascript: link', async () => {
    const res = await request(app, '/client-a/link', {
      as: 'admin',
      method: 'POST',
      body: { title: 'x', url: 'javascript:alert(document.domain)' },
    });
    expect(res.status).toBe(400);
  });

  it('a client cannot send firm email from the documents route', async () => {
    const res = await request(app, '/client-a/email', {
      ...asClientA,
      method: 'POST',
      body: { documentIds: ['doc-1'], email: 'anyone@example.com', customMessage: '<b>hi</b>' },
    });
    expect(res.status).toBe(403);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});
