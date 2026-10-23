// @vitest-environment node
// (Node's own File, so the route's `file instanceof File` sees the parsed upload.)
/**
 * client-management-avatar-routes.ts — client profile photos.
 * ===========================================================
 *
 * The photo is one private object per client at `<userId>/avatar`; there is no
 * KV record. These pin the access scope (self / admin / assigned adviser, via
 * requireClientAccess) and the upload limits.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'npm:hono';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const storage = vi.hoisted(() => ({
  upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
  remove: vi.fn(async () => ({ error: null })),
  createSignedUrl: vi.fn(
    async (path: string): Promise<{ data: { signedUrl: string } | null; error: unknown }> => ({
      data: { signedUrl: `https://signed.example/${path}` },
      error: null,
    }),
  ),
}));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async () => null),
}));
vi.mock('../client-management-utils.ts', () => ({
  createServiceClient: () => ({
    storage: {
      listBuckets: async () => ({ data: [{ name: 'make-91ed8379-client-avatars' }] }),
      createBucket: async () => ({ error: null }),
      from: () => ({
        upload: storage.upload,
        remove: storage.remove,
        createSignedUrl: storage.createSignedUrl,
      }),
    },
  }),
}));

const { multipart } = await import('./helpers/contract-harness.ts');
const avatarRoutes = (await import('../client-management-avatar-routes.ts')).default;

// The mount-level requireAuth, played from headers.
const app = new Hono();
app.use('*', async (c, next) => {
  if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
  c.set('userId' as never, (c.req.header('x-test-user') ?? 'client-a') as never);
  c.set('userRole' as never, (c.req.header('x-test-role') ?? 'client') as never);
  await next();
});
app.route('/', avatarRoutes);

const as = (role: string, user: string) => ({
  Authorization: 'Bearer t',
  'x-test-role': role,
  'x-test-user': user,
});

const upload = (userId: string, type: string, value: string, headers: Record<string, string>) => {
  const form = multipart([{ name: 'file', value, filename: 'avatar', type }]);
  return app.request(`/avatar/${userId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': form.contentType },
    body: form.body,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /avatar/:userId', () => {
  it('returns a signed URL for an admin', async () => {
    const res = await app.request('/avatar/client-a', { headers: as('admin', 'admin-1') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      url: 'https://signed.example/client-a/avatar',
    });
  });

  it('returns url: null, not an error, when the client has no photo', async () => {
    storage.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'Object not found' },
    });
    const res = await app.request('/avatar/client-a', { headers: as('admin', 'admin-1') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, url: null });
  });

  it("refuses a client reading another client's photo", async () => {
    const res = await app.request('/avatar/client-b', { headers: as('client', 'client-a') });
    expect(res.status).toBe(403);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated request', async () => {
    const res = await app.request('/avatar/client-a');
    expect(res.status).toBe(401);
  });
});

describe('POST /avatar/:userId', () => {
  it("stores the photo at the client's own fixed path, replacing any previous one", async () => {
    const res = await upload('client-a', 'image/jpeg', 'jpegbytes', as('admin', 'admin-1'));
    expect(res.status).toBe(200);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    const [path, , options] = storage.upload.mock.calls[0] as unknown as [
      string,
      unknown,
      { upsert: boolean; contentType: string },
    ];
    expect(path).toBe('client-a/avatar');
    expect(options).toMatchObject({ upsert: true, contentType: 'image/jpeg' });
  });

  it('lets a client set their own photo', async () => {
    const res = await upload('client-a', 'image/png', 'pngbytes', as('client', 'client-a'));
    expect(res.status).toBe(200);
  });

  it("refuses an upload into another client's folder", async () => {
    const res = await upload('client-b', 'image/jpeg', 'x', as('client', 'client-a'));
    expect(res.status).toBe(403);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('refuses types that are not JPEG, PNG or WebP (SVG can carry script)', async () => {
    for (const type of ['image/svg+xml', 'application/pdf', 'text/html']) {
      const res = await upload('client-a', type, 'x', as('admin', 'admin-1'));
      expect(res.status).toBe(400);
    }
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('refuses a photo over 2MB', async () => {
    const res = await upload(
      'client-a',
      'image/jpeg',
      'x'.repeat(2 * 1024 * 1024 + 1),
      as('admin', 'admin-1'),
    );
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('refuses a request with no file', async () => {
    const res = await app.request('/avatar/client-a', {
      method: 'POST',
      headers: as('admin', 'admin-1'),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /avatar/:userId', () => {
  it('removes only the addressed client photo', async () => {
    const res = await app.request('/avatar/client-a', {
      method: 'DELETE',
      headers: as('admin', 'admin-1'),
    });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['client-a/avatar']);
  });

  it("refuses a client removing another client's photo", async () => {
    const res = await app.request('/avatar/client-b', {
      method: 'DELETE',
      headers: as('client', 'client-a'),
    });
    expect(res.status).toBe(403);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
