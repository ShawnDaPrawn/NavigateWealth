/**
 * Personnel › Compliance › Upload, through the real route and auth middleware
 * with the KV store in memory and Supabase Storage stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authUsers } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => (key === 'SUPER_ADMIN_EMAILS' ? '' : `test-${key}`) },
  };
  return { authUsers: new Map<string, Record<string, unknown>>() };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = authUsers.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: async () => ({ data: { user: null }, error: null }),
        inviteUserByEmail: async () => ({ data: { user: null }, error: null }),
        updateUserById: async () => ({ data: { user: null }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: async () => ({ error: null }),
    }),
  }),
}));
const storage = vi.hoisted(() => ({
  uploads: [] as Array<{ bucket: string; path: string }>,
  failUpload: false,
}));
vi.mock('../client-management-utils.ts', () => ({
  createServiceClient: () => ({
    storage: {
      listBuckets: async () => ({ data: [] }),
      createBucket: async () => ({ error: null }),
      from: (bucket: string) => ({
        upload: async (path: string) => {
          if (storage.failUpload) return { data: null, error: { message: 'boom' } };
          storage.uploads.push({ bucket, path });
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        }),
      }),
    },
  }),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  createEmailTemplate: () => '<html></html>',
  getFooterSettings: vi.fn(async () => ({})),
}));

import { kvStore } from './helpers/contract-harness.ts';
import app from '../client-management-personnel-routes.ts';
import { safeFileName } from '../personnel-documents-service.ts';

/** From the real allowlist in constants.ts — not invented for the test. */
const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';

const asUser = (id: string, role: string, email = `${id}@example.co.za`) => {
  const token = `token-${id}`;
  authUsers.set(token, { id, email, app_metadata: { role }, user_metadata: {} });
  return `Bearer ${token}`;
};

const call = (path: string, init: RequestInit & { auth?: string } = {}) => {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (auth) headers.set('Authorization', auth);
  if (rest.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return app.request(path, { ...rest, headers });
};

const json = async (res: Response) => (await res.json()) as any;

const staff = (id: string) =>
  kvStore.set(`personnel:profile:${id}`, {
    id,
    email: `${id}@example.co.za`,
    firstName: id,
    lastName: 'Staff',
    role: 'adviser',
    status: 'active',
    commissionSplit: 0.7,
    createdAt: 'x',
    updatedAt: 'x',
  });

const owner = () => asUser('owner', 'super_admin', SUPER_ADMIN_EMAIL);

const upload = (id: string, file: File | null, fields: Record<string, string>, auth = owner()) => {
  const form = new FormData();
  if (file) form.set('file', file);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const headers = new Headers({ Authorization: auth });
  return app.request(`/${id}/documents/upload`, { method: 'POST', body: form, headers });
};

const pdf = () => new File(['%PDF-1.4'], 'RE5 cert (final).pdf', { type: 'application/pdf' });

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
  storage.uploads.length = 0;
  storage.failUpload = false;
});

describe('POST /:id/documents/upload', () => {
  it('stores the file privately under the person and records the document', async () => {
    await staff('naledi');
    const res = await upload('naledi', pdf(), { name: 'RE5 certificate', type: 'qualification' });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data).toMatchObject({ name: 'RE5 certificate', type: 'qualification' });
    // The test realm's FormData renames the file to "blob"; the name rule is unit-tested below.
    expect(data.path).toMatch(/^naledi\/\d+_/);
    expect(storage.uploads).toEqual([
      { bucket: 'make-91ed8379-personnel-documents', path: data.path },
    ]);
    const profile = kvStore.get('personnel:profile:naledi') as { documents: unknown[] };
    expect(profile.documents).toHaveLength(1);

    const link = await call(`/naledi/documents/${data.id}/url`, { auth: owner() });
    expect(link.status).toBe(200);
    expect((await json(link)).data.url).toBe(`https://signed.example/${data.path}`);
  });

  it('checks the file and fields', async () => {
    await staff('naledi');
    const exe = new File(['x'], 'x.exe', { type: 'application/x-msdownload' });
    expect((await upload('naledi', exe, { name: 'X', type: 'other' })).status).toBe(400);
    expect((await upload('naledi', null, { name: 'X', type: 'other' })).status).toBe(400);
    expect((await upload('naledi', pdf(), { name: '', type: 'other' })).status).toBe(400);
    expect((await upload('naledi', pdf(), { name: 'X', type: 'passport' })).status).toBe(400);
    expect((await upload('nobody', pdf(), { name: 'X', type: 'other' })).status).toBe(404);
    expect(storage.uploads).toHaveLength(0);
  });

  it('is refused to staff without a managing role', async () => {
    await staff('naledi');
    const res = await upload('naledi', pdf(), { name: 'X', type: 'other' }, asUser('a', 'adviser'));
    expect(res.status).toBe(403);
  });

  it('reports a storage failure without recording a document', async () => {
    await staff('naledi');
    storage.failUpload = true;
    const res = await upload('naledi', pdf(), { name: 'X', type: 'other' });
    expect(res.status).toBe(500);
    expect(
      (kvStore.get('personnel:profile:naledi') as { documents?: unknown[] }).documents,
    ).toBeUndefined();
  });
});

describe('safeFileName', () => {
  it('keeps letters, digits, dots and dashes only', () => {
    expect(safeFileName('RE5 cert (final).pdf')).toBe('RE5_cert__final_.pdf');
    expect(safeFileName('')).toBe('document');
  });
});
