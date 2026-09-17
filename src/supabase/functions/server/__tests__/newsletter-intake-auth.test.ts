/**
 * newsletter-intake-auth.ts — the Vault oracle client.
 *
 * Pins: an empty candidate never makes a round trip; `true` from the oracle
 * is the only accepting answer; an rpc error or a thrown client error reads
 * as "not verified" (the route falls through to its other branches instead
 * of failing the routine's hand-over with a 500); the client is lazy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ rpc })));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient }));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.stubGlobal('Deno', {
  env: {
    get: (name: string) =>
      ({ SUPABASE_URL: 'https://test', SUPABASE_SERVICE_ROLE_KEY: 'service-role' })[name] ?? '',
  },
});

import {
  NEWSLETTER_INTAKE_VAULT_SECRET,
  resetNewsletterIntakeAuthClient,
  verifyNewsletterIntakeToken,
} from '../newsletter-intake-auth.ts';

beforeEach(() => {
  vi.clearAllMocks();
  resetNewsletterIntakeAuthClient();
});

describe('verifyNewsletterIntakeToken', () => {
  it('names the Vault secret the migration provisions', () => {
    expect(NEWSLETTER_INTAKE_VAULT_SECRET).toBe('navigatewealth_newsletter_intake_token');
  });

  it('short-circuits an empty or whitespace candidate without a round trip', async () => {
    expect(await verifyNewsletterIntakeToken('')).toBe(false);
    expect(await verifyNewsletterIntakeToken('   ')).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('accepts only a literal true from the oracle, passing the trimmed candidate', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await verifyNewsletterIntakeToken('  tok  ')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('verify_newsletter_intake_token', { candidate: 'tok' });

    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await verifyNewsletterIntakeToken('tok')).toBe(false);

    rpc.mockResolvedValueOnce({ data: 'true', error: null });
    expect(await verifyNewsletterIntakeToken('tok')).toBe(false);
  });

  it('reads an rpc error or a thrown client error as not verified, never as a throw', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } });
    expect(await verifyNewsletterIntakeToken('tok')).toBe(false);

    rpc.mockRejectedValueOnce(new Error('network down'));
    await expect(verifyNewsletterIntakeToken('tok')).resolves.toBe(false);
  });

  it('builds the service-role client once and reuses it', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await verifyNewsletterIntakeToken('a');
    await verifyNewsletterIntakeToken('b');
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      'https://test',
      'service-role',
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
    );
  });
});
