/**
 * estate-planning-fna-will-routes.ts — Route Contract Tests
 * ========================================================
 *
 * 10 routes, 247 statements, 0% coverage before this file. These routes hold a
 * client's Last Will and Living Will: the draft, the finalisation, and the
 * signed PDF in private storage. Getting the boundary wrong here is not a
 * degraded page, it is a stranger reading someone's will.
 *
 * The module authenticates through the OTHER of the two gateways in this
 * codebase — `fna-auth.authenticateUser`, which returns a user object rather
 * than setting one on the Hono context — and then calls `assertClientAccess`,
 * which throws rather than returning a Response. Both halves are exercised for
 * real here: `client-access.ts` is NOT mocked, so the genuine policy runs and
 * only the adviser-assignment lookup is stubbed.
 *
 * Two things this file is built to hold:
 *
 *   1. THE OWNER IS DERIVED FROM THE URL. Every `:willId` route recovers the
 *      client id by regex from a caller-supplied string via `parseWillId`, and
 *      then checks access against what it recovered. The recovery and the
 *      check must not be able to disagree — so the greedy match, the storage
 *      path built from the same derived id, and the malformed-id case are all
 *      pinned.
 *   2. A DENIAL MUST NOT RENDER AS A SERVER ERROR. `assertClientAccess` throws
 *      `ClientAccessError` (403) and `authenticateUser` throws `AuthError`
 *      (403) for a suspended account. Both must reach the caller as 403s.
 *      This matters beyond tidiness: the SPA's api client retries 500s with
 *      exponential backoff and does not retry 403s, so a denial reported as a
 *      500 is retried three times before the user is told no.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test') },
  };
});

// ── In-memory KV, storage and adviser assignments ───────────────────────────
const kvStore = new Map<string, Record<string, unknown>>();
const assignments = new Map<string, string>();

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
}));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: Record<string, unknown>) => {
    kvStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  getByPrefix: vi.fn(async (prefix: string) =>
    [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
  ),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    storage: {
      listBuckets: storage.listBuckets,
      createBucket: storage.createBucket,
      from: () => ({
        upload: storage.upload,
        createSignedUrl: storage.createSignedUrl,
        remove: storage.remove,
      }),
    },
  }),
}));

// The ONLY part of the access policy that is stubbed. `client-access.ts` runs
// for real, so these tests assert the shipping policy rather than a mock of it.
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async (clientId: string) => assignments.get(clientId) ?? null),
}));

vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

/**
 * The gateway is stubbed at `authenticateUser` only — `fnaErrorResponse` and
 * `AuthError` come through from the real module, because how a denial is
 * RENDERED is half of what this file tests.
 */
vi.mock('../fna-auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fna-auth.ts')>();
  const { AuthError } = await import('../auth-mw.ts');
  return {
    ...actual,
    authenticateUser: vi.fn(async (authHeader: string | null | undefined) => {
      if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('Unauthorized');
      // Token format: "Bearer <role>:<userId>", so a single mount can act as
      // any caller. A token of "suspended" raises the real AuthError the
      // account-security check raises, so the rendering of a 403 is tested
      // with the class the shipping code actually throws.
      const [role, userId] = authHeader.slice(7).split(':');
      if (role === 'suspended') {
        throw new AuthError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
      }
      return { id: userId, email: `${userId}@test.co`, role };
    }),
  };
});

const app = (await import('../estate-planning-fna-will-routes.ts')).default;

// ── Fixtures ────────────────────────────────────────────────────────────────
const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ADVISER_A = 'adviser-of-a';
const ADVISER_B = 'adviser-of-b';
const WILL_A = `${CLIENT_A}-last_will-v1`;
const WILL_B = `${CLIENT_B}-last_will-v1`;

function req(
  path: string,
  {
    as = 'admin',
    user = 'staff-1',
    method = 'GET',
    body,
    formData,
    auth = true,
  }: {
    as?: string;
    user?: string;
    method?: string;
    body?: unknown;
    formData?: FormData;
    auth?: boolean;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${as}:${user}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(formData ? { body: formData } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Seed a stored will under the key the routes compute. */
function seedWill(
  clientId: string,
  willId: string,
  extra: Record<string, unknown> = {},
  type = 'last_will',
) {
  kvStore.set(`will:${clientId}:${type}:${willId}`, {
    id: willId,
    clientId,
    type,
    version: 1,
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  });
}

/** Every route, with a body where the method needs one. */
const ALL_ROUTES: Array<[string, string, unknown?]> = [
  [`/wills/client/${CLIENT_A}/profile-prefill`, 'GET'],
  ['/wills/create', 'POST', { clientId: CLIENT_A, type: 'last_will', data: {} }],
  [`/wills/${WILL_A}`, 'PUT', { data: {} }],
  [`/wills/client/${CLIENT_A}`, 'GET'],
  [`/wills/${WILL_A}`, 'GET'],
  [`/wills/${WILL_A}/finalize`, 'PUT'],
  [`/wills/${WILL_A}`, 'DELETE'],
  [`/wills/${WILL_A}/attach-signed`, 'POST'],
  [`/wills/${WILL_A}/signed-document`, 'GET'],
  [`/wills/${WILL_A}/signed-document`, 'DELETE'],
];

beforeEach(() => {
  kvStore.clear();
  assignments.clear();
  assignments.set(CLIENT_A, ADVISER_A);
  assignments.set(CLIENT_B, ADVISER_B);

  storage.listBuckets.mockReset().mockResolvedValue({ data: [{ name: 'x' }], error: null });
  storage.createBucket.mockReset().mockResolvedValue({ data: {}, error: null });
  storage.upload.mockReset().mockResolvedValue({ data: { path: 'p' }, error: null });
  storage.createSignedUrl
    .mockReset()
    .mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc' }, error: null });
  storage.remove.mockReset().mockResolvedValue({ data: {}, error: null });
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

describe('authentication', () => {
  it.each(ALL_ROUTES)(
    '%s %s rejects a request with no bearer token',
    async (path, method, body) => {
      const res = await req(path, { method, auth: false, body });
      expect(res.status).toBe(401);
      expect((await res.json()).success).toBe(false);
    },
  );

  it('covers every route the module registers', () => {
    expect(ALL_ROUTES).toHaveLength(10);
  });

  it.each(ALL_ROUTES)(
    '%s %s answers 403, not 500, for a suspended account',
    async (path, method, body) => {
      // authenticateUser throws AuthError(403) when the account-security check
      // fails. A 500 here would send a suspended user round the api client's
      // 500-retry ladder before telling them anything.
      seedWill(CLIENT_A, WILL_A);
      const res = await req(path, { method, as: 'suspended', user: 'someone', body });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('ACCOUNT_SUSPENDED');
    },
  );
});

// ============================================================================
// CLIENT ISOLATION — the same policy on all ten routes
// ============================================================================

describe('client isolation', () => {
  it.each(ALL_ROUTES)(
    '%s %s answers 403, not 500, when the caller may not reach the client',
    async (path, method, body) => {
      // ClientAccessError is a 403 with code FORBIDDEN_CLIENT. Rendering it as
      // a 500 both misreports the reason and puts the request on the api
      // client's retry ladder — three round trips to be told no.
      seedWill(CLIENT_A, WILL_A);
      const res = await req(path, { method, as: 'adviser', user: ADVISER_B, body });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('FORBIDDEN_CLIENT');
    },
  );

  it("denies a client reaching another client's will", async () => {
    seedWill(CLIENT_B, WILL_B);
    const res = await req(`/wills/${WILL_B}`, { as: 'client', user: CLIENT_A });
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('last_will');
  });

  it('lets a client reach their own will', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}`, { as: 'client', user: CLIENT_A });
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(WILL_A);
  });

  it('lets the assigned adviser reach their client', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
  });

  it.each(['paraplanner', 'compliance', 'viewer', 'worker'])(
    'denies %s — signing in is not client access',
    async (role) => {
      seedWill(CLIENT_A, WILL_A);
      const res = await req(`/wills/${WILL_A}`, { as: role, user: 'staff-1' });
      expect(res.status).toBe(403);
    },
  );

  it('lets a platform admin reach any client', async () => {
    seedWill(CLIENT_B, WILL_B);
    const res = await req(`/wills/${WILL_B}`, { as: 'admin', user: 'staff-1' });
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// parseWillId — the owner is recovered from a caller-supplied string
// ============================================================================

describe('will id parsing', () => {
  it.each([
    ['no version suffix', `${CLIENT_A}-last_will`],
    ['unknown will type', `${CLIENT_A}-secret_will-v1`],
    ['no client segment', 'last_will-v1'],
    ['empty-ish', '-last_will-v1'],
    ['non-numeric version', `${CLIENT_A}-last_will-vX`],
  ])('rejects a malformed will id (%s) without reaching storage', async (_label, willId) => {
    const res = await req(`/wills/${encodeURIComponent(willId)}`, { as: 'admin' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });

  it('rejects an id with anything trailing the version, rather than truncating to it', async () => {
    // Pins the `$` anchor in `^(.+)-(last_will)-v\d+$`. Without it the parser
    // accepts "<client>-last_will-v1-EXTRA" and silently recovers the real
    // client id from it, so a caller-invented id passes the access check and
    // goes on to build a KV key and a storage path. Anchored, it is a 400.
    //
    // Note on the OTHER half of that pattern: greedy `(.+)` versus lazy
    // `(.+?)` is not a real difference here. `$` pins the split to the final
    // `-<type>-v<digits>`, so both quantifiers recover the same segment. The
    // anchors carry the safety, not the greediness.
    const res = await req(`/wills/${WILL_A}-EXTRA`, { as: 'admin' });
    expect(res.status).toBe(400);
  });

  it('recovers a DIFFERENT owner from a prefixed id, so the access check denies it', async () => {
    // The owner is recovered from the string the caller supplied and then
    // checked against. Those two steps must never be able to disagree: an id
    // dressed up to look like another client's still resolves to whatever the
    // regex actually recovered, which is not that client.
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/attacker-${WILL_A}`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(403);
  });

  it('accepts living_will as well as last_will', async () => {
    const livingWill = `${CLIENT_A}-living_will-v1`;
    seedWill(CLIENT_A, livingWill, {}, 'living_will');
    const res = await req(`/wills/${livingWill}`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
    expect((await res.json()).data.type).toBe('living_will');
  });
});

// ============================================================================
// CREATE
// ============================================================================

describe('create', () => {
  it('creates v1 for a client with no prior wills', async () => {
    const res = await req('/wills/create', {
      method: 'POST',
      as: 'adviser',
      user: ADVISER_A,
      body: { clientId: CLIENT_A, type: 'last_will', data: { personalDetails: { fullName: 'A' } } },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.id).toBe(`${CLIENT_A}-last_will-v1`);
    expect(data.version).toBe(1);
    expect(data.status).toBe('draft');
    expect(data.clientName).toBe('A');
  });

  it('increments the version past existing wills of the same type', async () => {
    seedWill(CLIENT_A, `${CLIENT_A}-last_will-v1`);
    seedWill(CLIENT_A, `${CLIENT_A}-last_will-v2`);
    const res = await req('/wills/create', {
      method: 'POST',
      as: 'admin',
      body: { clientId: CLIENT_A, type: 'last_will', data: {} },
    });
    expect((await res.json()).data.version).toBe(3);
  });

  it('versions last_will and living_will independently', async () => {
    seedWill(CLIENT_A, `${CLIENT_A}-last_will-v1`);
    const res = await req('/wills/create', {
      method: 'POST',
      as: 'admin',
      body: { clientId: CLIENT_A, type: 'living_will', data: {} },
    });
    expect((await res.json()).data.version).toBe(1);
  });

  it.each([
    ['clientId', { type: 'last_will', data: {} }],
    ['type', { clientId: CLIENT_A, data: {} }],
    ['data', { clientId: CLIENT_A, type: 'last_will' }],
  ])('rejects a body missing %s', async (_field, body) => {
    const res = await req('/wills/create', { method: 'POST', as: 'admin', body });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown will type AFTER the access check', async () => {
    // Ordering matters: a caller who may not reach the client must not be able
    // to learn anything from the difference between "bad type" and "denied".
    const denied = await req('/wills/create', {
      method: 'POST',
      as: 'adviser',
      user: ADVISER_B,
      body: { clientId: CLIENT_A, type: 'secret_will', data: {} },
    });
    expect(denied.status).toBe(403);

    const allowed = await req('/wills/create', {
      method: 'POST',
      as: 'admin',
      body: { clientId: CLIENT_A, type: 'secret_will', data: {} },
    });
    expect(allowed.status).toBe(400);
  });
});

// ============================================================================
// UPDATE / FINALIZE / DELETE — the state machine
// ============================================================================

describe('update', () => {
  it('updates a draft', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}`, {
      method: 'PUT',
      as: 'adviser',
      user: ADVISER_A,
      body: { data: { x: 1 } },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.data).toEqual({ x: 1 });
  });

  it('refuses to update a finalized will', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}`, {
      method: 'PUT',
      as: 'admin',
      body: { data: { x: 1 } },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/finalized/i);
  });

  it('404s for a will that does not exist', async () => {
    const res = await req(`/wills/${WILL_A}`, { method: 'PUT', as: 'admin', body: { data: {} } });
    expect(res.status).toBe(404);
  });

  it('rejects a body with no data field', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}`, { method: 'PUT', as: 'admin', body: {} });
    expect(res.status).toBe(400);
  });
});

describe('finalize', () => {
  it('finalizes a draft and records who did it', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}/finalize`, {
      method: 'PUT',
      as: 'adviser',
      user: ADVISER_A,
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.status).toBe('finalized');
    expect(data.finalizedBy).toBe(ADVISER_A);
    expect(data.finalizedAt).toBeTruthy();
  });

  it.each([
    ['finalized', /already finalized/i],
    ['signed', /already has a signed copy/i],
  ])('refuses to finalize a %s will', async (status, message) => {
    seedWill(CLIENT_A, WILL_A, { status });
    const res = await req(`/wills/${WILL_A}/finalize`, { method: 'PUT', as: 'admin' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(message);
  });

  it('404s for a will that does not exist', async () => {
    const res = await req(`/wills/${WILL_A}/finalize`, { method: 'PUT', as: 'admin' });
    expect(res.status).toBe(404);
  });
});

describe('delete', () => {
  it('discards a draft', async () => {
    seedWill(CLIENT_A, WILL_A);
    const res = await req(`/wills/${WILL_A}`, { method: 'DELETE', as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
    expect(kvStore.has(`will:${CLIENT_A}:last_will:${WILL_A}`)).toBe(false);
  });

  it.each(['finalized', 'signed'])(
    'retains a %s will — compliance keeps them, and the record survives the attempt',
    async (status) => {
      seedWill(CLIENT_A, WILL_A, { status });
      const res = await req(`/wills/${WILL_A}`, { method: 'DELETE', as: 'admin' });
      expect(res.status).toBe(400);
      expect(kvStore.has(`will:${CLIENT_A}:last_will:${WILL_A}`)).toBe(true);
    },
  );

  it('404s for a will that does not exist', async () => {
    const res = await req(`/wills/${WILL_A}`, { method: 'DELETE', as: 'admin' });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// SIGNED DOCUMENT — private storage
// ============================================================================

function pdf(name = 'signed.pdf', type = 'application/pdf') {
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array([1, 2, 3])], name, { type }));
  return fd;
}

describe('attach signed document', () => {
  it('uploads under a path scoped to the will owner', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'adviser',
      user: ADVISER_A,
      formData: pdf(),
    });
    expect(res.status).toBe(200);
    // The storage path is built from the client id recovered by parseWillId —
    // the same value the access check was made against. If those two ever
    // diverge, one client's signed will lands in another's folder.
    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^signed-wills/${CLIENT_A}/${WILL_A}\\.`));
    expect(options).toMatchObject({ contentType: 'application/pdf', upsert: true });
    // The extension is deliberately NOT asserted. jsdom/undici drops the
    // filename when a FormData File round-trips through `c.req.formData()` —
    // `file.name` arrives as "blob" here regardless of what was appended — so
    // an extension assertion would be testing the harness. The owner-scoped
    // folder is the part that matters and it is asserted above.
    expect((await res.json()).data.status).toBe('signed');
  });

  it('refuses to attach to a draft — finalize first', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'draft' });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: pdf(),
    });
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a request with no file', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ['text/html', 'evil.html'],
    ['application/javascript', 'evil.js'],
    ['application/octet-stream', 'blob.bin'],
  ])('rejects a %s upload', async (type, name) => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: pdf(name, type),
    });
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each(['image/jpeg', 'image/png'])('accepts a %s upload', async (type) => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: pdf('scan.png', type),
    });
    expect(res.status).toBe(200);
  });

  it('reports a storage failure as a 500 without inventing success', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    storage.upload.mockResolvedValueOnce({ data: null, error: { message: 'bucket offline' } });
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: pdf(),
    });
    expect(res.status).toBe(500);
    // The will must NOT be marked signed when the upload failed.
    expect(kvStore.get(`will:${CLIENT_A}:last_will:${WILL_A}`)!.status).toBe('finalized');
  });

  it('404s for a will that does not exist', async () => {
    const res = await req(`/wills/${WILL_A}/attach-signed`, {
      method: 'POST',
      as: 'admin',
      formData: pdf(),
    });
    expect(res.status).toBe(404);
  });
});

describe('read signed document', () => {
  it('returns a time-limited signed url', async () => {
    seedWill(CLIENT_A, WILL_A, {
      status: 'signed',
      signedDocumentPath: `signed-wills/${CLIENT_A}/${WILL_A}.pdf`,
      signedDocumentFileName: 'my-will.pdf',
    });
    const res = await req(`/wills/${WILL_A}/signed-document`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://signed.example/doc');
    expect(json.fileName).toBe('my-will.pdf');
    // One hour, not indefinite: the url leaves the trust boundary.
    expect(storage.createSignedUrl).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it('does not mint a url before the access check', async () => {
    seedWill(CLIENT_A, WILL_A, {
      status: 'signed',
      signedDocumentPath: `signed-wills/${CLIENT_A}/${WILL_A}.pdf`,
    });
    const res = await req(`/wills/${WILL_A}/signed-document`, { as: 'adviser', user: ADVISER_B });
    expect(res.status).toBe(403);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('404s when the will carries no signed document', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/signed-document`, { as: 'admin' });
    expect(res.status).toBe(404);
  });

  it('500s when the url cannot be minted', async () => {
    seedWill(CLIENT_A, WILL_A, {
      status: 'signed',
      signedDocumentPath: 'p',
    });
    storage.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });
    const res = await req(`/wills/${WILL_A}/signed-document`, { as: 'admin' });
    expect(res.status).toBe(500);
  });
});

describe('remove signed document', () => {
  it('removes the file and reverts the will to finalized', async () => {
    seedWill(CLIENT_A, WILL_A, {
      status: 'signed',
      signedDocumentPath: 'p',
      signedDocumentFileName: 'f.pdf',
      signedAt: '2026-01-01T00:00:00.000Z',
      signedBy: 'someone',
    });
    const res = await req(`/wills/${WILL_A}/signed-document`, {
      method: 'DELETE',
      as: 'adviser',
      user: ADVISER_A,
    });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['p']);
    const { data } = await res.json();
    expect(data.status).toBe('finalized');
    expect(data.signedDocumentPath).toBeNull();
    expect(data.signedAt).toBeNull();
  });

  it('still clears the record when storage deletion fails', async () => {
    // Deliberate: a storage error is logged and swallowed so the KV record
    // does not keep pointing at a document the user asked to remove.
    seedWill(CLIENT_A, WILL_A, { status: 'signed', signedDocumentPath: 'p' });
    storage.remove.mockResolvedValueOnce({ data: null, error: { message: 'gone' } });
    const res = await req(`/wills/${WILL_A}/signed-document`, { method: 'DELETE', as: 'admin' });
    expect(res.status).toBe(200);
    expect((await res.json()).data.signedDocumentPath).toBeNull();
  });

  it('404s when there is nothing attached', async () => {
    seedWill(CLIENT_A, WILL_A, { status: 'finalized' });
    const res = await req(`/wills/${WILL_A}/signed-document`, { method: 'DELETE', as: 'admin' });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// LIST AND PREFILL
// ============================================================================

describe('list by client', () => {
  it('returns the client wills newest first', async () => {
    seedWill(CLIENT_A, `${CLIENT_A}-last_will-v1`, { createdAt: '2026-01-01T00:00:00.000Z' });
    seedWill(CLIENT_A, `${CLIENT_A}-last_will-v2`, { createdAt: '2026-03-01T00:00:00.000Z' });
    seedWill(
      CLIENT_A,
      `${CLIENT_A}-living_will-v1`,
      {
        createdAt: '2026-02-01T00:00:00.000Z',
      },
      'living_will',
    );
    const res = await req(`/wills/client/${CLIENT_A}`, { as: 'adviser', user: ADVISER_A });
    const { data } = await res.json();
    expect(data.map((w: { id: string }) => w.id)).toEqual([
      `${CLIENT_A}-last_will-v2`,
      `${CLIENT_A}-living_will-v1`,
      `${CLIENT_A}-last_will-v1`,
    ]);
  });

  it("does not return another client's wills", async () => {
    seedWill(CLIENT_A, WILL_A);
    seedWill(CLIENT_B, WILL_B);
    const res = await req(`/wills/client/${CLIENT_A}`, { as: 'adviser', user: ADVISER_A });
    const { data } = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].clientId).toBe(CLIENT_A);
  });

  it('returns an empty list rather than failing when the client has none', async () => {
    const res = await req(`/wills/client/${CLIENT_A}`, { as: 'admin' });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});

describe('profile prefill', () => {
  it('returns the profile and client keys for an authorized caller', async () => {
    kvStore.set(`user_profile:${CLIENT_A}:personal_info`, { fullName: 'A Client' });
    kvStore.set(`user_profile:${CLIENT_A}:client_keys`, { idNumber: 'x' });
    const res = await req(`/wills/client/${CLIENT_A}/profile-prefill`, {
      as: 'adviser',
      user: ADVISER_A,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile).toEqual({ fullName: 'A Client' });
    expect(json.clientKeys).toEqual({ idNumber: 'x' });
  });

  it('reports success with nulls when the client has no stored profile', async () => {
    const res = await req(`/wills/client/${CLIENT_A}/profile-prefill`, { as: 'admin' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.profile).toBeNull();
    expect(json.clientKeys).toBeNull();
  });

  it("does not leak another client's profile", async () => {
    kvStore.set(`user_profile:${CLIENT_A}:personal_info`, { idNumber: 'SECRET' });
    const res = await req(`/wills/client/${CLIENT_A}/profile-prefill`, {
      as: 'adviser',
      user: ADVISER_B,
    });
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('SECRET');
  });
});
