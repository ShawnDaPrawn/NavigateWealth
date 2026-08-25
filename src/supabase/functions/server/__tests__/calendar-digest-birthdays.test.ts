/**
 * Client birthday digest — POST /calendar-digest/send-birthdays
 * =============================================================
 *
 * The `client-birthday-digest` cron had been answering 404 since it was created,
 * because this route did not exist. Nothing reported it: pg_cron marks
 * net.http_post succeeded as soon as the request is enqueued.
 *
 * The logic worth pinning is not the HTML — it is the date matching. A digest
 * that silently matches the wrong day, or drops clients whose profile lacks a
 * birth date, looks exactly like a quiet day. So these tests fix the clock and
 * assert who is selected, in what order, and when nothing is sent at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test' } });

const CLIENTS: Array<Record<string, unknown>> = [];
const getAllClients = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn(async () => true));

vi.mock('../communication-business-logic.ts', () => ({
  getAllClients: (...a: unknown[]) => getAllClients(...a),
}));

vi.mock('../email-service.tsx', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  createEmailTemplate: (html: string) => html,
  getFooterSettings: async () => ({}),
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

const app = (await import('../calendar-digest-routes.ts')).default;

/**
 * Mirrors what `getAllClients` really returns. Two details matter and both were
 * wrong in the first version of these tests, which is why review caught bugs
 * the suite could not:
 *
 *   - `hasEmailOptIn` is HARD-CODED `true` by the loader for every client, so a
 *     fixture that varies it tests a state production never produces. It is
 *     pinned to `true` here on purpose, and consent is asserted through
 *     `profile._applicationMeta` instead.
 *   - `dateOfBirth` is only populated from the NESTED profile shape. Clients
 *     approved through the application flow have a flat profile and arrive with
 *     it undefined, carrying the date at `profile.dateOfBirth`.
 */
function client(over: Record<string, unknown>) {
  return {
    id: 'x',
    email: 'x@example.com',
    firstName: 'X',
    lastName: 'Y',
    phone: '',
    netWorth: 0,
    products: [],
    status: 'active',
    category: '',
    hasEmailOptIn: true, // always true in production — never vary this
    hasWhatsAppOptIn: false,
    metadata: {},
    profile: {},
    ...over,
  };
}

/** Admin-entered shape: nested under personalInformation. */
function nestedShape(dob: string, over: Record<string, unknown> = {}) {
  return client({
    dateOfBirth: dob, // what getAllClients maps from personalInformation
    profile: { personalInformation: { dateOfBirth: dob } },
    ...over,
  });
}

/** Self-service shape from buildClientProfileFromApplication: flat root. */
function flatShape(dob: string, consent = false, over: Record<string, unknown> = {}) {
  return client({
    dateOfBirth: undefined, // the loader cannot see it in this shape
    profile: { dateOfBirth: dob, _applicationMeta: { communicationConsent: consent } },
    ...over,
  });
}

async function run() {
  const res = await app.request('/send-birthdays', { method: 'POST' });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  getAllClients.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  CLIENTS.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('who gets selected', () => {
  it('includes a client whose birthday is today and reports the age they turn', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-06-15' }),
    ]);

    const { body } = await run();

    expect(body).toMatchObject({ success: true, sent: true, birthday_count: 1 });
    const mail = sendEmail.mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toContain('(1)');
    expect(mail.text).toContain('Ada Lovelace (turning 36)');
  });

  it('excludes a birthday on a different day', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dateOfBirth: '1990-06-16' })]);

    const { body } = await run();

    expect(body).toMatchObject({ sent: false, reason: 'no_birthdays', birthday_count: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not match the same day in a different month', async () => {
    // Added after mutation testing: dropping the month check from the filter
    // passed every other test in this file. A client born 15 January would have
    // appeared in the 15 June digest, and the advisor would have had no way to
    // tell it was wrong.
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ firstName: 'JuneFifteen', dateOfBirth: '1990-06-15' }),
      client({ firstName: 'JanFifteen', dateOfBirth: '1990-01-15' }),
      client({ firstName: 'DecFifteen', dateOfBirth: '1990-12-15' }),
    ]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
    const mail = sendEmail.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain('JuneFifteen');
    expect(mail.text).not.toContain('JanFifteen');
    expect(mail.text).not.toContain('DecFifteen');
  });

  it('matches on month and day regardless of birth year', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ firstName: 'Old', dateOfBirth: '1940-06-15' }),
      client({ firstName: 'New', dateOfBirth: '2010-06-15' }),
    ]);

    const { body } = await run();

    expect(body.birthday_count).toBe(2);
  });

  it('drops clients with no birth date rather than guessing', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ firstName: 'Known', dateOfBirth: '1990-06-15' }),
      client({ firstName: 'Unknown', dateOfBirth: undefined }),
    ]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
  });

  it('survives an unparseable birth date instead of throwing', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dateOfBirth: 'not-a-date' })]);

    const { status, body } = await run();

    expect(status).toBe(200);
    expect(body).toMatchObject({ sent: false, reason: 'no_birthdays' });
  });
});

describe('both stored profile shapes', () => {
  // Review of #232 found the route read only the nested shape. Every client
  // approved through the self-service application flow has the flat shape, so
  // the digest reported a quiet day for that entire population.
  it('sees a birthday carried on the nested profile shape', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([nestedShape('1990-06-15')]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
  });

  it('sees a birthday carried at the flat profile root, where the loader cannot', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([flatShape('1990-06-15')]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
  });

  it('also accepts the snake_case root variant', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ dateOfBirth: undefined, profile: { date_of_birth: '1990-06-15' } }),
    ]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
  });

  it('still reports no birthdays when neither shape carries a date', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ dateOfBirth: undefined, profile: { personalInformation: {} } }),
    ]);

    const { body } = await run();

    expect(body).toMatchObject({ sent: false, reason: 'no_birthdays' });
  });
});

describe('the SAST boundary', () => {
  // The advisor is in Africa/Johannesburg. A run just before midnight UTC is
  // already the next day there, and must use the South African date.
  it('uses the SAST date, not the UTC date, near midnight', async () => {
    vi.setSystemTime(new Date('2026-06-14T23:00:00Z')); // = 15 June 01:00 SAST
    getAllClients.mockResolvedValue([
      client({ firstName: 'Fifteenth', dateOfBirth: '1990-06-15' }),
      client({ firstName: 'Fourteenth', dateOfBirth: '1990-06-14' }),
    ]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
    const mail = sendEmail.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain('Fifteenth');
    expect(mail.text).not.toContain('Fourteenth');
  });
});

describe('the documented leap-day gap', () => {
  // Pinned deliberately. Rounding a 29 Feb birthday to the 28th or the 1st is a
  // product decision, so the code does neither and this test records that,
  // rather than leaving the behaviour to be discovered in four years.
  it('does not match a 29 February birthday in a non-leap year', async () => {
    vi.setSystemTime(new Date('2026-03-01T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dateOfBirth: '2000-02-29' })]);

    const { body } = await run();

    expect(body).toMatchObject({ sent: false, reason: 'no_birthdays' });
  });

  it('does match it in a leap year', async () => {
    vi.setSystemTime(new Date('2028-02-29T08:00:00Z'));
    getAllClients.mockResolvedValue([client({ dateOfBirth: '2000-02-29' })]);

    const { body } = await run();

    expect(body.birthday_count).toBe(1);
  });
});

describe('what the advisor is told', () => {
  it('sorts by name so the list is stable between runs', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      client({ firstName: 'Zara', lastName: '', dateOfBirth: '1990-06-15' }),
      client({ firstName: 'Adam', lastName: '', dateOfBirth: '1991-06-15' }),
    ]);

    await run();

    const mail = sendEmail.mock.calls[0][0] as { text: string };
    expect(mail.text.indexOf('Adam')).toBeLessThan(mail.text.indexOf('Zara'));
  });

  it('reports marketing consent from _applicationMeta, not the hard-coded opt-in flag', async () => {
    // The bug this pins: the loader sets hasEmailOptIn: true for everyone, so
    // rendering it told the advisor every client was contactable — including
    // those who declined. Both fixtures below carry hasEmailOptIn: true.
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockResolvedValue([
      flatShape('1990-06-15', false, { firstName: 'Declined', lastName: '' }),
      flatShape('1991-06-15', true, { firstName: 'Consented', lastName: '' }),
    ]);

    await run();

    const mail = sendEmail.mock.calls[0][0] as { html: string; text: string };
    expect(mail.text).toContain('Declined');
    expect(mail.text).toContain('[no marketing consent]');
    expect(mail.html).toContain('No marketing consent');
    // The consenting client must NOT be flagged.
    expect(mail.text).toMatch(/Consented \(turning 35\) — x@example\.com$/m);
  });
});

describe('failure handling', () => {
  it('returns 500 rather than a false all-clear when clients cannot be loaded', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
    getAllClients.mockRejectedValue(new Error('KV unavailable'));

    const { status, body } = await run();

    // The distinction that matters: a load failure must not look like
    // "no birthdays today", or a real outage reads as a quiet day.
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
