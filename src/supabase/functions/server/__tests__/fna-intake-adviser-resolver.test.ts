import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as kv from '../kv_store.tsx';
import { resolveClientAdviserUserId } from '../fna-intake-adviser-resolver.ts';

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(),
}));

describe('resolveClientAdviserUserId', () => {
  beforeEach(() => {
    vi.mocked(kv.get).mockReset();
  });

  it('resolves adviser from application record', async () => {
    vi.mocked(kv.get).mockImplementation(async (key: string) => {
      if (key === 'user_profile:client-1:personal_info') {
        return { applicationId: 'app-1' };
      }
      if (key === 'application:app-1') {
        return { adviserId: 'adviser-99' };
      }
      return null;
    });

    await expect(resolveClientAdviserUserId('client-1')).resolves.toBe('adviser-99');
  });

  it('returns null when no adviser is assigned', async () => {
    vi.mocked(kv.get).mockResolvedValue(null);
    await expect(resolveClientAdviserUserId('client-1')).resolves.toBeNull();
  });
});
