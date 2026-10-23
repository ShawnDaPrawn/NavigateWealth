/**
 * kv-cleanup-service.ts — what the nightly job is allowed to delete.
 *
 * `kv-cleanup-cron.contract.test.ts` stubs this module, so a change to the
 * purge rules would leave that route green while `kv-cleanup-nightly` deleted
 * a live public-form rate-limit bucket (resetting the limit) or a confirmed
 * newsletter subscriber. The consent records live under `newsletter:`, the
 * same prefix as an unconfirmed signup token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as { key: string; value: unknown }[],
  prefixes: [] as string[],
  readError: null as { message: string } | null,
}));

const kv = vi.hoisted(() => ({
  mdel: vi.fn(async (_keys: string[]) => undefined),
  set: vi.fn(async (_key: string, _value: unknown) => undefined),
  get: vi.fn(async (_key: string) => null as unknown),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'kv_store_91ed8379') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          like: async (_column: string, pattern: string) => {
            state.prefixes.push(pattern);
            if (state.readError) return { data: null, error: state.readError };
            const prefix = pattern.endsWith('%') ? pattern.slice(0, -1) : pattern;
            return {
              data: state.rows.filter((row) => row.key.startsWith(prefix)),
              error: null,
            };
          },
        }),
      };
    },
  }),
}));

vi.mock('../kv_store.tsx', () => kv);
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { getLastCleanupRun, runKvCleanup } from '../kv-cleanup-service.ts';

const NOW = Date.parse('2026-10-14T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const iso = (ms: number) => new Date(ms).toISOString();

function deletedKeys(): string[] {
  return kv.mdel.mock.calls.flatMap((call) => call[0] as string[]);
}

beforeEach(() => {
  state.rows = [];
  state.prefixes = [];
  state.readError = null;
  kv.mdel.mockClear();
  kv.mdel.mockResolvedValue(undefined);
  kv.set.mockReset();
  kv.set.mockResolvedValue(undefined);
  kv.get.mockReset();
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => (name === 'SUPABASE_URL' ? 'https://example.test' : 'service-role'),
    },
  });
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe('rate-limit buckets', () => {
  it('drops a bucket only once every timestamp is at least an hour old', async () => {
    state.rows = [
      {
        key: 'rate_limit:contact:a@example.com',
        value: { timestamps: [NOW - 2 * HOUR, NOW - HOUR + 1] },
      },
      {
        key: 'rate_limit:csp-report:1.1.1.1',
        value: { timestamps: [NOW - HOUR] },
      },
      {
        key: 'rate_limit:runtime-client:8.8.8.8',
        value: { timestamps: [NOW - HOUR + 1] },
      },
      {
        key: 'rate_limit:newsletter-unsubscribe:9.9.9.9',
        value: { timestamps: [] },
      },
      { key: 'rate_limit:quote:b@example.com', value: null },
      { key: 'rate_limit:submission:c@example.com', value: { timestamps: 'nope' } },
      { key: 'rate_limit:consultation:d@example.com', value: {} },
      {
        key: 'rate_limit:login:should-stay',
        value: { timestamps: [NOW - 5 * HOUR] },
      },
    ];

    const result = await runKvCleanup({ dryRun: false });

    expect(deletedKeys().sort()).toEqual(
      [
        'rate_limit:csp-report:1.1.1.1',
        'rate_limit:newsletter-unsubscribe:9.9.9.9',
        'rate_limit:quote:b@example.com',
        'rate_limit:submission:c@example.com',
        'rate_limit:consultation:d@example.com',
      ].sort(),
    );
    expect(result.categories.rateLimits.keysDeleted).toBe(5);
    expect(state.prefixes).toEqual(
      expect.arrayContaining([
        'rate_limit:contact:%',
        'rate_limit:quote:%',
        'rate_limit:submission:%',
        'rate_limit:consultation:%',
        'rate_limit:csp-report:%',
        'rate_limit:runtime-client:%',
        'rate_limit:newsletter-unsubscribe:%',
      ]),
    );
  });

  it('deletes in batches of 100', async () => {
    state.rows = Array.from({ length: 101 }, (_, i) => ({
      key: `rate_limit:contact:stale-${String(i).padStart(3, '0')}`,
      value: { timestamps: [NOW - 2 * HOUR] },
    }));

    const result = await runKvCleanup({ dryRun: false });

    expect(kv.mdel).toHaveBeenCalledTimes(2);
    expect(kv.mdel.mock.calls[0][0]).toHaveLength(100);
    expect(kv.mdel.mock.calls[1][0]).toEqual(['rate_limit:contact:stale-100']);
    expect(result.categories.rateLimits).toMatchObject({
      keysFound: 101,
      keysDeleted: 101,
      sampleKeys: state.rows.slice(0, 10).map((row) => row.key),
    });
  });
});

describe('newsletter consent records', () => {
  it('deletes an unconfirmed signup past 48 hours and leaves everyone else', async () => {
    state.rows = [
      {
        key: 'newsletter:thandi@example.com',
        value: {
          email: 'thandi@example.com',
          confirmed: true,
          active: true,
          subscribedAt: iso(NOW - 400 * DAY),
        },
      },
      {
        key: 'newsletter:gone@example.com',
        value: {
          email: 'gone@example.com',
          confirmed: true,
          active: false,
          subscribedAt: iso(NOW - 400 * DAY),
          unsubscribedAt: iso(NOW - 10 * DAY),
        },
      },
      {
        key: 'newsletter:group_backfill:legacy_subscribers',
        value: { completedAt: iso(NOW - 400 * DAY), subscriberCount: 10, batchCount: 1 },
      },
      {
        key: 'newsletter:pending-fresh@example.com',
        value: {
          email: 'pending-fresh@example.com',
          confirmed: false,
          active: false,
          subscribedAt: iso(NOW - 48 * HOUR),
          confirmToken: 'still-inside',
        },
      },
      {
        key: 'newsletter:pending-old@example.com',
        value: {
          email: 'pending-old@example.com',
          confirmed: false,
          active: false,
          subscribedAt: iso(NOW - 48 * HOUR - 1),
          confirmToken: 'expired',
        },
      },
      {
        key: 'newsletter:pending-undated@example.com',
        value: { email: 'pending-undated@example.com', confirmed: false, active: false },
      },
    ];

    await runKvCleanup({ dryRun: false });

    expect(deletedKeys()).toEqual(['newsletter:pending-old@example.com']);
  });
});

describe('form copies and the submissions mirror', () => {
  it('purges a raw copy strictly older than the retention window', async () => {
    const cutoff = NOW - 90 * DAY;
    state.rows = [
      { key: 'contact_form:old', value: { submittedAt: iso(cutoff - 1) } },
      { key: 'contact_form:on-cutoff', value: { submittedAt: iso(cutoff) } },
      { key: 'contact_form:recent', value: { submittedAt: iso(NOW - DAY) } },
      { key: 'contact_form:undated', value: { email: 'a@example.com' } },
      { key: 'contact_form:unreadable', value: { submittedAt: 'not-a-date' } },
      { key: 'contact_form:empty', value: null },
      { key: 'consultation:old', value: { submittedAt: iso(cutoff - 1) } },
      { key: 'quote_request:old', value: { submittedAt: iso(NOW - 100 * DAY) } },
      { key: 'quote_request:recent', value: { submittedAt: iso(NOW - DAY) } },
      {
        key: 'submission:sub_mirrored',
        value: { submittedAt: iso(NOW - 400 * DAY), type: 'contact' },
      },
    ];

    const result = await runKvCleanup({ dryRun: false });

    expect(deletedKeys().sort()).toEqual(
      ['contact_form:old', 'contact_form:empty', 'consultation:old', 'quote_request:old'].sort(),
    );
    expect(result.categories.oldContactForms.keysDeleted).toBe(3);
    expect(result.categories.oldQuoteRequests.keysDeleted).toBe(1);
  });

  it('uses the caller retention for forms and leaves the audit window alone', async () => {
    state.rows = [
      { key: 'contact_form:two-days', value: { submittedAt: iso(NOW - 2 * DAY) } },
      { key: 'contact_form:half-day', value: { submittedAt: iso(NOW - 12 * HOUR) } },
      {
        key: 'audit:suspension_attempt:two-days',
        value: { timestamp: iso(NOW - 2 * DAY) },
      },
    ];

    await runKvCleanup({ dryRun: false, retentionDays: 1, auditRetentionDays: 365 });

    expect(deletedKeys()).toEqual(['contact_form:two-days']);
  });
});

describe('audit entries', () => {
  it('dates every audit: key on the audit window and keeps one it cannot date', async () => {
    const cutoff = NOW - 365 * DAY;
    state.rows = [
      {
        key: 'audit:admin:old',
        value: { timestamp: iso(cutoff - 1), createdAt: iso(NOW) },
      },
      {
        key: 'audit:admin:recent-stamp',
        value: { timestamp: iso(NOW - DAY), createdAt: iso(cutoff - 1) },
      },
      {
        key: 'audit:suspension_attempt:created',
        value: { timestamp: '', createdAt: iso(cutoff - 1) },
      },
      { key: 'audit:admin:undated', value: { action: 'kv_cleanup_live' } },
      { key: 'audit:admin:blank', value: null },
      {
        key: 'audit:admin:on-cutoff',
        value: { timestamp: iso(cutoff) },
      },
    ];

    await runKvCleanup({ dryRun: false });

    expect(deletedKeys().sort()).toEqual(
      ['audit:admin:old', 'audit:suspension_attempt:created', 'audit:admin:blank'].sort(),
    );
  });
});

describe('dry run and last-run status', () => {
  beforeEach(() => {
    state.rows = [{ key: 'rate_limit:contact:stale', value: { timestamps: [NOW - 2 * HOUR] } }];
  });

  it('previews by default and writes nothing', async () => {
    const result = await runKvCleanup();

    expect(result.dryRun).toBe(true);
    expect(result.retentionDays).toBe(90);
    expect(result.auditRetentionDays).toBe(365);
    expect(result.totalKeysFound).toBe(1);
    expect(result.totalKeysDeleted).toBe(0);
    expect(kv.mdel).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('records a live run, and a failed status write still returns the result', async () => {
    kv.set.mockRejectedValueOnce(new Error('persist down'));

    const result = await runKvCleanup({ dryRun: false });

    expect(result.totalKeysDeleted).toBe(1);
    expect(deletedKeys()).toEqual(['rate_limit:contact:stale']);
    expect(kv.set).toHaveBeenCalledWith('system:kv_cleanup:last_run', {
      timestamp: result.timestamp,
      totalKeysFound: 1,
      totalKeysDeleted: 1,
      durationMs: result.durationMs,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
  });

  it('deletes nothing when a prefix read fails', async () => {
    state.readError = { message: 'statement timeout' };

    await expect(runKvCleanup({ dryRun: false })).rejects.toThrow(
      /KV fetch failed for prefix ".*": statement timeout/,
    );
    expect(kv.mdel).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });
});

describe('getLastCleanupRun', () => {
  it('returns the stored summary, and null when the read fails or is empty', async () => {
    const summary = {
      timestamp: iso(NOW),
      totalKeysFound: 4,
      totalKeysDeleted: 4,
      durationMs: 12,
      retentionDays: 90,
      auditRetentionDays: 365,
    };
    kv.get.mockResolvedValueOnce(summary);
    await expect(getLastCleanupRun()).resolves.toEqual(summary);

    kv.get.mockResolvedValueOnce(null);
    await expect(getLastCleanupRun()).resolves.toBeNull();

    kv.get.mockRejectedValueOnce(new Error('kv down'));
    await expect(getLastCleanupRun()).resolves.toBeNull();
  });
});
