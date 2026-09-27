// @vitest-environment node
// (Node's own File, so the route's `file instanceof File` sees the parsed upload.)
/**
 * client-management-documents-routes.ts — upload scope and send-documents.
 * =======================================================================
 *
 *   - `POST /upload` took `userId` as OPTIONAL and, without it, wrote to a
 *     shared `temp/` folder with no access check: storage for any signed-in
 *     user. It is now required and checked.
 *   - `POST /send-documents` zipped storage paths read from the client's own
 *     (client-editable) profile and mailed them to the profile's (editable)
 *     email. It is admin-only now, and skips any path outside the client's
 *     folder.
 *
 * The router sits behind a mount-level `requireAuth`; the stand-in below plays
 * that part from test headers, and `requireAdmin` is role-aware.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'npm:hono';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const storage = vi.hoisted(() => ({
  upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
  download: vi.fn(async () => ({ data: new Blob(['pdf']), error: null })),
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
  return { requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN') };
});
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async () => null),
}));
vi.mock('../email-service.ts', () => ({ sendEmail: email.sendEmail }));
vi.mock('../client-management-utils.ts', () => ({
  createServiceClient: () => ({
    storage: {
      listBuckets: async () => ({ data: [{ name: 'make-91ed8379-client-documents' }] }),
      createBucket: async () => ({ error: null }),
      from: () => ({ upload: storage.upload, download: storage.download }),
    },
  }),
}));
vi.mock('npm:@zip.js/zip.js', () => ({
  ZipWriter: class {
    add = vi.fn(async () => undefined);
    close = vi.fn(async () => new Uint8Array([1, 2, 3]));
  },
  Uint8ArrayWriter: class {},
  Uint8ArrayReader: class {},
}));

const { kvStore, multipart } = await import('./helpers/contract-harness.ts');
const documentRoutes = (await import('../client-management-documents-routes.ts')).default;

// The mount-level requireAuth, played from headers.
const app = new Hono();
app.use('*', async (c, next) => {
  if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
  c.set('userId' as never, (c.req.header('x-test-user') ?? 'client-a') as never);
  c.set('userRole' as never, (c.req.header('x-test-role') ?? 'client') as never);
  await next();
});
app.route('/', documentRoutes);

const headers = (role: string, user: string) => ({
  Authorization: 'Bearer t',
  'x-test-role': role,
  'x-test-user': user,
});

const upload = (fields: Record<string, string>, as: Record<string, string>) => {
  const form = multipart([
    { name: 'file', value: '%PDF-1.4', filename: 'id.pdf', type: 'application/pdf' },
    ...Object.entries(fields).map(([name, value]) => ({ name, value })),
  ]);
  return app.request('/upload', {
    method: 'POST',
    headers: { ...as, 'Content-Type': form.contentType },
    body: form.body,
  });
};

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('POST /upload', () => {
  it('refuses an upload with no userId instead of filing it under temp/', async () => {
    const res = await upload({}, headers('client', 'client-a'));
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("refuses an upload into another client's folder", async () => {
    const res = await upload({ userId: 'client-b' }, headers('client', 'client-a'));
    expect(res.status).toBe(403);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('files a client upload in their own folder', async () => {
    const res = await upload({ userId: 'client-a' }, headers('client', 'client-a'));
    expect(res.status).toBe(200);
    expect(storage.upload.mock.calls[0][0]).toMatch(/^client-a\//);
  });
});

describe('POST /send-documents', () => {
  beforeEach(() => {
    kvStore.set('user_profile:client-a:personal_info', {
      idNumber: '9001015009087',
      email: 'client-a@example.com',
      identityDocuments: [
        { fileName: 'own.pdf', path: 'client-a/1_own.pdf' },
        { fileName: 'stolen.pdf', path: 'client-b/1_their-id.pdf' },
      ],
    });
  });

  it('refuses a client', async () => {
    const res = await app.request('/send-documents', {
      method: 'POST',
      headers: { ...headers('client', 'client-a'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'client-a' }),
    });
    expect(res.status).toBe(403);
    expect(storage.download).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('never reads a file outside the client folder, whatever the profile lists', async () => {
    await app.request('/send-documents', {
      method: 'POST',
      headers: { ...headers('admin', 'admin-1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'client-a' }),
    });
    const paths = storage.download.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(['client-a/1_own.pdf']);
  });
});
