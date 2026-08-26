/**
 * Shared harness for the FNA / INA route families.
 * ================================================
 *
 * Six domains — risk, medical aid, retirement, investment (INA), tax and estate
 * — ship as six separate route modules with six separate route tables, but they
 * sit on an identical dependency surface:
 *
 *   kv_store.tsx        the record store
 *   fna-auth.ts         `authenticateUser` + `fnaErrorResponse`
 *   client-access.ts    `assertClientAccess` / `assertRecordClientAccess`
 *   fna-validation.ts   the real zod schemas
 *
 * So one harness serves all six. What it stubs is deliberately narrow:
 *
 *   - The Supabase client, so `authenticateUser` resolves a seeded token
 *     instead of reaching the network. The REAL `authenticateUser` still runs,
 *     including its trusted-role resolution and account-security check.
 *   - The adviser-assignment lookup that `client-access.ts` consults.
 *     `client-access.ts` itself is NOT mocked — the genuine policy decides
 *     every 403 in these suites. A mocked policy would leave the tests
 *     asserting the mock, which is the failure mode that let S12 and S14 ship.
 *   - Storage buckets, for the two modules that upload documents.
 *
 * Validation schemas run for real, so the 400 envelopes are the ones that ship.
 *
 * @module __tests__/helpers/fna-routes-harness
 */
import { vi } from 'vitest';

/** token → the Supabase user that token resolves to. */
export const fnaAuthUsers = new Map<string, Record<string, unknown>>();

/** clientId → the adviser the SERVER says owns them. */
export const fnaAssignments = new Map<string, string>();

/** Every storage upload the routes attempted, in order. */
export const fnaStorageUploads: Array<{ bucket: string; path: string }> = [];

/** Buckets `listBuckets` should claim already exist. */
export const fnaExistingBuckets = new Set<string>();

/** Buckets `createBucket` was asked to create, in order. */
export const fnaCreatedBuckets: string[] = [];

export function resetFnaHarness(): void {
  fnaAuthUsers.clear();
  fnaAssignments.clear();
  fnaStorageUploads.length = 0;
  fnaExistingBuckets.clear();
  fnaCreatedBuckets.length = 0;
}

/**
 * Seed a token that `authenticateUser` will accept.
 *
 * `role` is written to `app_metadata`, which is where `resolveTrustedRole`
 * reads from — putting it in `user_metadata` would be silently ignored, which
 * is the whole point of that function and worth not papering over here.
 */
export function seedFnaUser(
  token: string,
  user: { id: string; email?: string; role?: string },
): void {
  fnaAuthUsers.set(token, {
    id: user.id,
    email: user.email ?? `${user.id}@test.co`,
    app_metadata: user.role ? { role: user.role } : {},
    user_metadata: {},
  });
}

/** The `jsr:@supabase/supabase-js` stand-in: auth + storage, nothing else. */
export function makeFnaSupabaseMock() {
  return {
    createClient: () => ({
      auth: {
        getUser: async (token: string) => {
          const user = fnaAuthUsers.get(token);
          return user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: { message: 'invalid token' } };
        },
      },
      storage: {
        listBuckets: async () => ({
          data: [...fnaExistingBuckets].map((name) => ({ name })),
          error: null,
        }),
        createBucket: async (name: string) => {
          fnaCreatedBuckets.push(name);
          fnaExistingBuckets.add(name);
          return { error: null };
        },
        from: (bucket: string) => ({
          upload: async (path: string) => {
            fnaStorageUploads.push({ bucket, path });
            return { error: null };
          },
          download: async () => ({ data: new Blob(['pdf']), error: null }),
          remove: async () => ({ error: null }),
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://signed.test/${bucket}/${path}` },
            error: null,
          }),
        }),
      },
    }),
  };
}

/** The adviser-assignment lookup — the only part of the access policy stubbed. */
export function makeAdviserResolverMock() {
  return {
    resolveClientAdviserUserId: vi.fn(
      async (clientId: string) => fnaAssignments.get(clientId) ?? null,
    ),
  };
}

/**
 * `enforceAccountSecurity` is a real gate on `authenticateUser`; it reads its
 * own KV rows. Suites that care about suspension seed those rows; the default
 * here is a no-op so an unrelated suite does not have to.
 */
export function makeAuthMwMockForFna() {
  class AuthError extends Error {
    status: number;
    code: string;
    constructor(message: string, status = 403, code = 'FORBIDDEN') {
      super(message);
      this.name = 'AuthError';
      this.status = status;
      this.code = code;
    }
  }
  return {
    AuthError,
    enforceAccountSecurity: vi.fn(async () => undefined),
  };
}
