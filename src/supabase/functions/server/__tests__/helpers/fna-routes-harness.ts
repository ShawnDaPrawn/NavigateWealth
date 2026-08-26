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

/**
 * Storage failures to inject, per operation.
 *
 * These live on the module rather than being spied onto a client instance
 * because the routes call `createClient()` fresh on every request — a spy
 * installed on a client the test built is a spy on an object the route never
 * sees, and the test passes while asserting nothing. That mistake is easy to
 * make and silent, which is why the switch is here instead.
 */
export const fnaStorageErrors: {
  upload?: string | null;
  remove?: string | null;
  signedUrl?: string | null;
  createBucket?: string | null;
} = {};

export function resetFnaHarness(): void {
  fnaAuthUsers.clear();
  fnaAssignments.clear();
  fnaStorageUploads.length = 0;
  fnaExistingBuckets.clear();
  fnaCreatedBuckets.length = 0;
  fnaStorageErrors.upload = null;
  fnaStorageErrors.remove = null;
  fnaStorageErrors.signedUrl = null;
  fnaStorageErrors.createBucket = null;
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
          // Recorded BEFORE the failure check, so a test can assert which
          // buckets were ATTEMPTED and not only which succeeded. The reverse
          // order made an earlier bucket-init test vacuous.
          fnaCreatedBuckets.push(name);
          if (fnaStorageErrors.createBucket) {
            return { error: { message: fnaStorageErrors.createBucket } };
          }
          fnaExistingBuckets.add(name);
          return { error: null };
        },
        from: (bucket: string) => ({
          upload: async (path: string) => {
            if (fnaStorageErrors.upload) {
              return { error: { message: fnaStorageErrors.upload } };
            }
            fnaStorageUploads.push({ bucket, path });
            return { error: null };
          },
          download: async () => ({ data: new Blob(['pdf']), error: null }),
          remove: async () => {
            if (fnaStorageErrors.remove) {
              return { error: { message: fnaStorageErrors.remove } };
            }
            return { error: null };
          },
          createSignedUrl: async (path: string) => {
            if (fnaStorageErrors.signedUrl) {
              return { data: null, error: { message: fnaStorageErrors.signedUrl } };
            }
            return {
              data: { signedUrl: `https://signed.test/${bucket}/${path}` },
              error: null,
            };
          },
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
