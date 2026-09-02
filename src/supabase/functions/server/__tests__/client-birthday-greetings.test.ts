/**
 * Client birthday greetings — POST /client-birthdays/send-greetings
 * ================================================================
 *
 * Unlike the advisor digest, this route mails CLIENTS. The thing worth pinning
 * is therefore not the copy but the gates: a bug here does not produce a
 * missing summary, it produces unwanted mail to someone who declined.
 *
 * So these tests fix the clock and assert exactly who is mailed, who is only
 * counted, and the cases where the route refuses to send anything at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test' } });

const getAllClients = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn(async () => true));
const listSubscribers = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
const getEmailTemplate = vi.hoisted(() => vi.fn());

vi.mock('../communication-business-logic.ts', () => ({
  getAllClients: (...a: unknown[]) => getAllClients(...a),
}));

vi.mock('../email-service.tsx', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  createEmailTemplate: (html: string) => html,
  getFooterSettings: async () => ({}),
  getEmailTemplate: (...a: unknown[]) => getEmailTemplate(...a),
  createPlainTextEmail: (content: string, unsub?: string) =>
    unsub ? `${content}\n\nUnsubscribe: ${unsub}` : content,
}));

vi.mock('../newsletter-service.ts', () => ({
  listSubscribers: (...a: unknown[]) => listSubscribers(...a),
}));

// The guard has its own suite; here it must simply not block.
vi.mock('../cron-auth.ts', () => ({
  requireCronAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  isAuthorizedCronRequest: async () => true,
  CRON_AUTH_HEADER: 'x-nw-cron-auth',
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: () => ({}) }));

const app = (await import('../client-birthday-routes.ts')).default;

const TEMPLATE = {
  id: 'client_birthday',
  name: 'Client Birthday Greeting',
  enabled: true,
  subject: 'Happy Birthday, {{ .FirstName }}!',
  title: 'Happy Birthday',
  subtitle: 'From all of us at Navigate Wealth',
  greeting: 'Dear {{ .FirstName }},',
  bodyHtml: '<p>Wishing you a very happy birthday.</p>',
  buttonLabel: '',
  buttonUrl: '',
  footerNote: 'Navigate Wealth is an authorised financial services provider.',
};

/**
 * `hasEmailOptIn` is hard-coded `true` by the loader for every client, so it is
 * pinned true here and consent is expressed only through `_applicationMeta` —
 * the field the route actually gates on.
 */
function client(over: Record<string, unknown> = {}) {
  const { consent, dob, ...rest } = over as Record<string, unknown> & {
    consent?: boolean;
    dob?: string;
  };
  return {
    id: 'x',
    email: 'x@example.com',
    firstName: 'Thabo',
    lastName: 'Y',
    phone: '',
    netWorth: 0,
    products: [],
    status: 'active',
    category: '',
    hasEmailOptIn: true, // always true in production — never vary this
    hasWhatsAppOptIn: false,
    metadata: {},
    dateOfBirth: dob,
    profile: {
      personalInformation: { dateOfBirth: dob },
      _applicationMeta: consent === undefined ? {} : { communicationConsent: consent },
    },
    ...rest,
  };
}

async function run() {
  const res = await app.request('/send-greetings', { method: 'POST' });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  getAllClients.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  listSubscribers.mockReset();
  listSubscribers.mockResolvedValue([]);
  getEmailTemplate.mockReset();
  getEmailTemplate.mockResolvedValue({ ...TEMPLATE });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the consent gate', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-06-10T08:00:00Z')));

  it('mails a client who consented', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    const { body } = await run();
    expect(body.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does NOT mail a client whose birthday it is but who never consented', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: false })]);
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(body.skipped_no_consent).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('treats a missing consent flag as no consent, not as permission', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10' })]);
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(body.skipped_no_consent).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('ignores the loader hard-coded hasEmailOptIn flag', async () => {
    getAllClients.mockResolvedValue([
      client({ dob: '1980-06-10', consent: false, hasEmailOptIn: true }),
    ]);
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('the unsubscribe gate', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-06-10T08:00:00Z')));

  it('skips a consenting client who has unsubscribed', async () => {
    getAllClients.mockResolvedValue([
      client({ dob: '1980-06-10', consent: true, email: 'gone@example.com' }),
    ]);
    listSubscribers.mockResolvedValue([{ email: 'GONE@example.com', active: false }]);
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(body.skipped_unsubscribed).toBe(1);
  });

  it('still mails someone who is on the list but active', async () => {
    getAllClients.mockResolvedValue([
      client({ dob: '1980-06-10', consent: true, email: 'here@example.com' }),
    ]);
    listSubscribers.mockResolvedValue([{ email: 'here@example.com', active: true }]);
    const { body } = await run();
    expect(body.sent).toBe(1);
  });

  it('sends NOTHING rather than mailing opt-outs when the list cannot be read', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    listSubscribers.mockRejectedValue(new Error('kv down'));
    const { status } = await run();
    expect(status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('date matching', () => {
  it('matches on month and day regardless of birth year', async () => {
    vi.setSystemTime(new Date('2026-06-10T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1954-06-10', consent: true })]);
    expect((await run()).body.sent).toBe(1);
  });

  it('does not match the same day in a different month', async () => {
    vi.setSystemTime(new Date('2026-06-10T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1980-07-10', consent: true })]);
    expect((await run()).body.sent).toBe(0);
  });

  it('uses the SAST date, not the UTC date, near midnight', async () => {
    // 23:30 UTC on the 9th is already 01:30 on the 10th in SAST.
    vi.setSystemTime(new Date('2026-06-09T23:30:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    expect((await run()).body.sent).toBe(1);
  });

  it('greets a 29 February birthday on the 28th in a non-leap year', async () => {
    vi.setSystemTime(new Date('2026-02-28T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1980-02-29', consent: true })]);
    expect((await run()).body.sent).toBe(1);
  });

  it('does NOT greet them early on the 28th in a leap year', async () => {
    vi.setSystemTime(new Date('2028-02-28T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1980-02-29', consent: true })]);
    expect((await run()).body.sent).toBe(0);
  });

  it('greets them on the day itself in a leap year', async () => {
    vi.setSystemTime(new Date('2028-02-29T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dob: '1980-02-29', consent: true })]);
    expect((await run()).body.sent).toBe(1);
  });

  it('survives an unparseable birth date instead of throwing', async () => {
    vi.setSystemTime(new Date('2026-06-10T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ dob: 'not-a-date', consent: true }),
      client({ dob: '1980-06-10', consent: true, id: 'ok' }),
    ]);
    const { status, body } = await run();
    expect(status).toBe(200);
    expect(body.sent).toBe(1);
  });
});

describe('what the client receives', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-06-10T08:00:00Z')));

  it('addresses them by first name in the subject', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    await run();
    expect(sendEmail.mock.calls[0][0].subject).toBe('Happy Birthday, Thabo!');
  });

  it('falls back to a neutral greeting when no first name is stored', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true, firstName: '' })]);
    await run();
    expect(sendEmail.mock.calls[0][0].subject).toBe('Happy Birthday, there!');
  });

  it('derives the plain-text part from the template body, not a second copy', async () => {
    getEmailTemplate.mockResolvedValue({
      ...TEMPLATE,
      bodyHtml: '<p>Edited in the admin UI.</p><p>Second line.</p>',
    });
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    await run();
    const text = sendEmail.mock.calls[0][0].text as string;
    expect(text).toContain('Edited in the admin UI.');
    expect(text).toContain('Second line.');
    expect(text).not.toContain('<p>');
  });

  it('carries a working unsubscribe link for that specific address', async () => {
    getAllClients.mockResolvedValue([
      client({ dob: '1980-06-10', consent: true, email: 'a+b@example.com' }),
    ]);
    await run();
    expect(sendEmail.mock.calls[0][0].text).toContain(
      'newsletter/unsubscribe?email=a%2Bb%40example.com',
    );
  });
});

describe('failure handling', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-06-10T08:00:00Z')));

  it('returns 500 rather than a false all-clear when clients cannot be loaded', async () => {
    getAllClients.mockRejectedValue(new Error('kv down'));
    const { status } = await run();
    expect(status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends nothing when the template has been disabled in the admin UI', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true })]);
    getEmailTemplate.mockResolvedValue({ ...TEMPLATE, enabled: false });
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(body.reason).toBe('template_disabled');
  });

  it('keeps going and counts the failure when one send fails', async () => {
    getAllClients.mockResolvedValue([
      client({ dob: '1980-06-10', consent: true, id: 'a', email: 'a@example.com' }),
      client({ dob: '1980-06-10', consent: true, id: 'b', email: 'b@example.com' }),
    ]);
    sendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { body } = await run();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });

  it('skips a client with no email address on file', async () => {
    getAllClients.mockResolvedValue([client({ dob: '1980-06-10', consent: true, email: '' })]);
    const { body } = await run();
    expect(body.sent).toBe(0);
    expect(body.skipped_no_email).toBe(1);
  });
});
