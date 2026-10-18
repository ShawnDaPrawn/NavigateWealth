/**
 * The shared enquiry client used by the Contact page and every service page's
 * "Let us call you back" form.
 *
 * Run: npx vitest run src/services/__tests__/contactEnquiry.test.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { splitFullName, submitContactEnquiry } from '../contactEnquiry';

vi.mock('../../utils/supabase/info', () => ({ projectId: 'proj', publicAnonKey: 'anon' }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('splitFullName', () => {
  it('splits first name from the rest', () => {
    expect(splitFullName('  Jane  van der Merwe ')).toEqual({
      firstName: 'Jane',
      lastName: 'van der Merwe',
    });
  });

  it('keeps a placeholder surname for a one-word name, which the endpoint requires', () => {
    expect(splitFullName('Thabo')).toEqual({ firstName: 'Thabo', lastName: '-' });
  });

  it('returns empty names for blank input', () => {
    expect(splitFullName('   ')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('submitContactEnquiry', () => {
  const enquiry = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '082 000 0000',
  };

  it('posts to the contact-form endpoint and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitContactEnquiry(enquiry)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(enquiry);
  });

  it("surfaces the server's error message when the submission is rejected", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many submissions.' }) }),
    );

    await expect(submitContactEnquiry(enquiry)).resolves.toEqual({
      ok: false,
      error: 'Too many submissions.',
    });
  });

  it('reports a network failure instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await submitContactEnquiry(enquiry);
    expect(result.ok).toBe(false);
  });
});
