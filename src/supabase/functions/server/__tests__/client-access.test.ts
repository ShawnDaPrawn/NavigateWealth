import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => vi.fn());

vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: resolver,
}));

import { canAccessClient, requireClientAccess } from '../client-access.ts';

function context(userId: string, userRole: string) {
  return {
    get: (key: string) => ({ userId, userRole })[key as 'userId' | 'userRole'],
    json: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  } as never;
}

describe('client-scoped authorization', () => {
  beforeEach(() => resolver.mockReset());

  it('allows self access and platform administrators', async () => {
    await expect(canAccessClient(context('client-1', 'client'), 'client-1')).resolves.toBe(true);
    await expect(canAccessClient(context('admin-1', 'admin'), 'client-1')).resolves.toBe(true);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('allows only the adviser assigned by the server', async () => {
    resolver.mockResolvedValue('adviser-1');

    await expect(canAccessClient(context('adviser-1', 'adviser'), 'client-1')).resolves.toBe(true);
    await expect(canAccessClient(context('adviser-2', 'adviser'), 'client-1')).resolves.toBe(false);
  });

  it('denies unrelated authenticated personnel with a 403 response', async () => {
    const denied = await requireClientAccess(context('staff-1', 'staff'), 'client-1');

    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toMatchObject({ code: 'FORBIDDEN_CLIENT' });
    expect(resolver).not.toHaveBeenCalled();
  });
});
