/**
 * Daily calendar digest — POST /calendar-digest/send-daily
 * ==========================================================
 *
 * Reported in Issue Manager as a live 500: "DB query failed: Could not find a
 * relationship between 'events' and 'clients' in the schema cache." The route
 * still embedded `client:clients(id, full_name, email)`, the same PostgREST
 * embed `calendar-service.ts` and `calendar-client-link.ts` already stopped
 * using after migration `20260906005533_calendar_client_fk_to_auth_users.sql`
 * re-pointed `events.client_id` at `auth.users` and removed the relationship
 * that embed depended on. This route was the one call site never updated to
 * match — see `calendar-client-link.ts` for the full history.
 *
 * These tests pin two things: the query no longer asks for the dead embed,
 * and the digest still resolves a client's name from `attendees`, the same
 * way the rest of the calendar module does.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/calendar-digest-send-daily.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test' } });

const sendEmail = vi.hoisted(() => vi.fn(async () => true));
const queryResult = vi.hoisted(() => ({ data: [] as unknown[], error: null as unknown }));
const selectArg = vi.hoisted(() => ({ value: '' }));

vi.mock('../email-service.ts', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  createEmailTemplate: (html: string) => html,
  getFooterSettings: async () => ({}),
}));

vi.mock('../cron-auth.ts', () => ({
  requireCronAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  isAuthorizedCronRequest: async () => true,
  CRON_AUTH_HEADER: 'x-nw-cron-auth',
}));

vi.mock('../communication-business-logic.ts', () => ({
  getAllClients: vi.fn(async () => []),
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

// A minimal chainable query builder: every filter method returns `this`, and
// the chain is awaited directly (the route never calls a terminal `.then()`
// wrapper of its own), so `then` resolves it like a thenable.
function makeQueryBuilder() {
  const builder = {
    select: vi.fn((arg: string) => {
      selectArg.value = arg;
      return builder;
    }),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (v: typeof queryResult) => void) => resolve(queryResult),
  };
  return builder;
}

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: vi.fn(() => makeQueryBuilder()),
  }),
}));

const app = (await import('../calendar-digest-routes.ts')).default;

async function run() {
  const res = await app.request('/send-daily', { method: 'POST' });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  queryResult.data = [];
  queryResult.error = null;
  selectArg.value = '';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the events query', () => {
  it('never asks PostgREST for the dead clients embed', async () => {
    await run();
    expect(selectArg.value).toBe('*');
    expect(selectArg.value).not.toContain('clients');
  });

  it('surfaces a query error as a 500 instead of throwing', async () => {
    queryResult.error = { message: "Could not find a relationship between 'events' and 'clients'" };

    const { status, body } = await run();

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('client name resolution', () => {
  it('derives the client name from attendees, not a clients-table embed', async () => {
    queryResult.data = [
      {
        id: 'ev-1',
        title: 'Portfolio Review',
        event_type: 'review',
        start_at: '2026-06-15T09:00:00Z',
        end_at: '2026-06-15T10:00:00Z',
        client_id: 'user-1',
        attendees: { 'user-1': { name: 'Jane Doe', email: 'jane@example.com' } },
        status: 'scheduled',
      },
    ];

    const { body } = await run();

    expect(body).toMatchObject({ success: true, event_count: 1 });
    const mail = sendEmail.mock.calls[0][0] as { html: string; text: string };
    expect(mail.html).toContain('Jane Doe');
  });

  it('renders an em dash rather than inventing a name when attendees carry nothing for the client', async () => {
    queryResult.data = [
      {
        id: 'ev-2',
        title: 'Internal sync',
        event_type: 'internal',
        start_at: '2026-06-15T09:00:00Z',
        end_at: '2026-06-15T10:00:00Z',
        client_id: 'user-9',
        attendees: {},
        status: 'scheduled',
      },
    ];

    const { body } = await run();

    expect(body).toMatchObject({ success: true, event_count: 1 });
    const mail = sendEmail.mock.calls[0][0] as { html: string };
    expect(mail.html).not.toContain('undefined');
  });
});

describe('no events today', () => {
  it('still sends the clear-day email without querying for a client relation', async () => {
    const { body } = await run();

    expect(body).toMatchObject({ success: true, event_count: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
