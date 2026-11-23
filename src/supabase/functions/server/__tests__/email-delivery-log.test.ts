/**
 * email-delivery-log.ts — the record of every email the platform sends.
 *
 * Pinned here:
 *   1. What is stored: recipient lower-cased, links stripped from the preview,
 *      NO preview at all for sensitive kinds (codes, reset links), the route
 *      and request id of the request that sent it.
 *   2. Recording never throws — the email has already gone.
 *   3. Without SUPABASE_URL (unit tests, local) it is a silent no-op.
 *   4. The read side asks for the right rows: campaigns and individual
 *      messages excluded (History shows them through their own rows), a
 *      send's key resolved to its batch or its single row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMap = vi.hoisted(() => new Map<string, string>());
vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => envMap.get(key) },
  };
});

const db = vi.hoisted(() => {
  const state = {
    insert: vi.fn(async (_row: unknown) => ({ error: null as unknown })),
    rpc: vi.fn(async (_fn: string, _args: unknown) => ({
      data: [] as unknown[],
      error: null as unknown,
    })),
    selectResult: { data: [] as unknown[], error: null as unknown },
    calls: [] as Array<[string, ...unknown[]]>,
  };
  const chain = {
    select: (...a: unknown[]) => (state.calls.push(['select', ...a]), chain),
    eq: (...a: unknown[]) => (state.calls.push(['eq', ...a]), chain),
    order: (...a: unknown[]) => (state.calls.push(['order', ...a]), chain),
    limit: async (...a: unknown[]) => (state.calls.push(['limit', ...a]), state.selectResult),
  };
  return {
    state,
    client: {
      from: (table: string) => {
        state.calls.push(['from', table]);
        return { insert: state.insert, ...chain };
      },
      rpc: state.rpc,
    },
  };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: () => db.client }));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const ctx = vi.hoisted(() => ({ current: undefined as undefined | Record<string, string> }));
vi.mock('../request-context.ts', () => ({ getRequestContext: () => ctx.current }));

import {
  buildEmailPreview,
  toDeliveryRow,
  recordEmailDelivery,
  listDeliveryGroups,
  listDeliveryKinds,
  listGroupDeliveries,
  listDeliveriesForRecipient,
  __resetEmailDeliveryLogForTests,
  type EmailDeliveryRecord,
} from '../email-delivery-log.ts';

const BASE: EmailDeliveryRecord = {
  kind: 'client_birthday',
  to: '  Michael@Example.COM ',
  subject: 'Happy Birthday, Michael!',
  html: '<p>Have a great day</p>',
  text: 'Have a great day. Unsubscribe: https://www.navigatewealth.co/newsletter/unsubscribe?email=x',
  status: 'sent',
  provider: 'sendgrid',
  providerMessageId: 'sg-1',
};

beforeEach(() => {
  envMap.clear();
  envMap.set('SUPABASE_URL', 'https://example.supabase.co');
  envMap.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  __resetEmailDeliveryLogForTests();
  db.state.insert.mockClear();
  db.state.insert.mockResolvedValue({ error: null });
  db.state.rpc.mockReset();
  db.state.rpc.mockResolvedValue({ data: [], error: null });
  db.state.selectResult = { data: [], error: null };
  db.state.calls = [];
  ctx.current = undefined;
});

describe('buildEmailPreview', () => {
  it('removes every link, so a token in a URL is never stored', () => {
    const preview = buildEmailPreview(
      'Sign here https://www.navigatewealth.co/sign?token=secret-abc and http://x.y/z',
      '',
    );
    expect(preview).toBe('Sign here [link] and [link]');
    expect(preview).not.toContain('secret-abc');
  });

  it('falls back to the HTML, without styles, scripts or tags', () => {
    const preview = buildEmailPreview(
      undefined,
      '<style>p{color:red}</style><script>x()</script><p>Hello&nbsp;there &amp; welcome</p>',
    );
    expect(preview).toBe('Hello there & welcome');
  });

  it('is capped', () => {
    expect(buildEmailPreview('a'.repeat(5000), '')).toHaveLength(400);
  });
});

describe('toDeliveryRow', () => {
  it('stores the recipient lower-cased with the request it came from', () => {
    ctx.current = { requestId: 'req-1', route: 'POST /x/client-birthdays/send-greetings' };
    const row = toDeliveryRow({ ...BASE, cc: [' Adviser@NW.co '], batchId: 'b-1' });
    expect(row).toMatchObject({
      kind: 'client_birthday',
      batch_id: 'b-1',
      recipient: 'michael@example.com',
      cc: ['adviser@nw.co'],
      subject: 'Happy Birthday, Michael!',
      status: 'sent',
      provider: 'sendgrid',
      provider_message_id: 'sg-1',
      error: null,
      route: 'POST /x/client-birthdays/send-greetings',
      request_id: 'req-1',
    });
    expect(row.preview).toBe('Have a great day. Unsubscribe: [link]');
  });

  it('keeps no preview at all for a sensitive kind', () => {
    const row = toDeliveryRow({
      ...BASE,
      kind: 'two_factor_code',
      text: 'Your code is 123456',
    });
    expect(row.preview).toBeNull();
  });

  it('caps a long provider error and nulls an empty cc', () => {
    const row = toDeliveryRow({ ...BASE, status: 'failed', error: 'e'.repeat(3000), cc: [] });
    expect((row.error as string).length).toBe(1000);
    expect(row.cc).toBeNull();
  });
});

describe('recordEmailDelivery', () => {
  it('inserts one row into email_delivery_log', async () => {
    await recordEmailDelivery(BASE);
    expect(db.state.calls[0]).toEqual(['from', 'email_delivery_log']);
    expect(db.state.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'client_birthday', recipient: 'michael@example.com' }),
    );
  });

  it('never throws: an insert error is logged and swallowed', async () => {
    db.state.insert.mockResolvedValue({ error: { message: 'relation does not exist' } });
    await expect(recordEmailDelivery(BASE)).resolves.toBeUndefined();
    db.state.insert.mockRejectedValue(new Error('network down'));
    await expect(recordEmailDelivery(BASE)).resolves.toBeUndefined();
  });

  it('is a no-op without Supabase configuration', async () => {
    envMap.clear();
    __resetEmailDeliveryLogForTests();
    await recordEmailDelivery(BASE);
    expect(db.state.insert).not.toHaveBeenCalled();
  });
});

describe('read side', () => {
  it('asks for a page of sends without campaigns or individual messages', async () => {
    db.state.rpc.mockResolvedValue({
      data: [
        {
          group_key: 'publication:a1',
          kind: 'publication_notification',
          batch_id: 'publication:a1',
          first_at: '2026-11-16T10:00:08Z',
          last_at: '2026-11-16T10:00:12Z',
          subject: 'New article: X',
          preview: null,
          recipient: 'a@example.com',
          cc: null,
          total: '199',
          sent: '197',
          failed: '2',
          status: 'partial',
          last_error: 'bounced',
          provider_message_id: null,
          total_count: '23',
        },
      ],
      error: null,
    });
    const result = await listDeliveryGroups({
      kinds: ['publication_notification'],
      status: 'partial',
      search: '  bonus ',
      recipientType: 'multiple',
      limit: 30,
      offset: 0,
    });
    expect(db.state.rpc).toHaveBeenCalledWith('email_history_page', {
      p_exclude_kinds: ['campaign', 'direct_message'],
      p_kinds: ['publication_notification'],
      p_status: 'partial',
      p_search: 'bonus',
      p_recipient_type: 'multiple',
      p_limit: 30,
      p_offset: 0,
    });
    expect(result.total).toBe(23);
    expect(result.groups[0]).toMatchObject({
      groupKey: 'publication:a1',
      total: 199,
      sent: 197,
      failed: 2,
      status: 'partial',
      lastError: 'bounced',
    });
  });

  it('passes nulls for absent filters and reports an empty page as total 0', async () => {
    const result = await listDeliveryGroups({ limit: 15, offset: 0 });
    expect(db.state.rpc).toHaveBeenCalledWith(
      'email_history_page',
      expect.objectContaining({
        p_kinds: null,
        p_status: null,
        p_search: null,
        p_recipient_type: null,
      }),
    );
    expect(result).toEqual({ groups: [], total: 0 });
  });

  it('surfaces a query error to the caller (History degrades on it)', async () => {
    db.state.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(listDeliveryGroups({ limit: 1, offset: 0 })).rejects.toThrow('boom');
    await expect(listDeliveryKinds()).rejects.toThrow('boom');
  });

  it('lists the kinds that have been sent', async () => {
    db.state.rpc.mockResolvedValue({
      data: [{ kind: 'newsletter', sends: '2' }],
      error: null,
    });
    await expect(listDeliveryKinds()).resolves.toEqual([{ kind: 'newsletter', sends: 2 }]);
    expect(db.state.rpc).toHaveBeenCalledWith('email_history_kinds', {
      p_exclude_kinds: ['campaign', 'direct_message'],
    });
  });

  it('reads a batch by batch_id and a single email by its id', async () => {
    db.state.selectResult = {
      data: [
        {
          id: 'r1',
          created_at: '2026-11-23T06:00:10Z',
          kind: 'client_birthday',
          recipient: 'michael@example.com',
          subject: 'Happy Birthday',
          status: 'failed',
          error: 'SendGrid 403: forbidden',
          provider_message_id: null,
        },
      ],
      error: null,
    };
    const rows = await listGroupDeliveries('newsletter:abc');
    expect(db.state.calls).toContainEqual(['eq', 'batch_id', 'newsletter:abc']);
    expect(rows[0]).toEqual({
      id: 'r1',
      createdAt: '2026-11-23T06:00:10Z',
      kind: 'client_birthday',
      recipient: 'michael@example.com',
      subject: 'Happy Birthday',
      status: 'failed',
      error: 'SendGrid 403: forbidden',
      providerMessageId: null,
    });

    db.state.calls = [];
    await listGroupDeliveries('0e8c1d1e-1111-4a4a-9a9a-222222222222');
    expect(db.state.calls).toContainEqual(['eq', 'id', '0e8c1d1e-1111-4a4a-9a9a-222222222222']);
  });

  it("reads one client's emails by their lower-cased address", async () => {
    await listDeliveriesForRecipient(' Michael@Example.com ');
    expect(db.state.calls).toContainEqual(['eq', 'recipient', 'michael@example.com']);
    db.state.calls = [];
    await expect(listDeliveriesForRecipient('   ')).resolves.toEqual([]);
    expect(db.state.calls).toEqual([]);
  });

  it('refuses to read without configuration rather than pretending nothing was sent', async () => {
    envMap.clear();
    __resetEmailDeliveryLogForTests();
    await expect(listDeliveryGroups({ limit: 1, offset: 0 })).rejects.toThrow('not configured');
  });
});
