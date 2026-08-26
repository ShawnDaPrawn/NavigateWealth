/**
 * publications-notification-state.ts — pure helper contracts
 * ==========================================================
 *
 * The constants and pure functions the notification job engine leans on. These
 * decide whether a failed send is retried or written off, whether a stalled job
 * shows as stuck on the admin dashboard, and how a job record read back from KV
 * is repaired when it predates a field. All are cheap to get subtly wrong and
 * expensive to notice.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  chunkArray,
  clampInteger,
  classifyDeliveryFailure,
  getJobLastProgressTimestamp,
  getJobPhase,
  inferPrepareCursorFromItems,
  isArticleNotificationJobStuck,
  isReadyToAttemptTrackingRecord,
  JOB_LOCK_TTL_MS,
  normalizeSendError,
  RETRYABLE_REQUEUE_DELAY_MS,
  STUCK_JOB_THRESHOLD_MS,
  withArticleNotificationJobDefaults,
} from '../publications-notification-state.ts';
import type {
  ArticleNotificationJob,
  ArticleNotificationJobItem,
} from '../publications-notification-types.ts';
import type {
  ArticleEmailDeliveryStatus,
  ArticleEmailTrackingRecord,
} from '../publications-email-engagement-service.ts';

const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();

const trackingRecord = (
  deliveryStatus: ArticleEmailDeliveryStatus,
  lastAttemptedAt: string | null = null,
): ArticleEmailTrackingRecord =>
  ({ token: 't', deliveryStatus, lastAttemptedAt }) as ArticleEmailTrackingRecord;

const item = (trackingToken: string | null = null): ArticleNotificationJobItem => ({
  email: 'a@example.com',
  firstName: 'A',
  name: 'A Person',
  trackingToken,
});

const job = (overrides: Partial<ArticleNotificationJob> = {}): ArticleNotificationJob =>
  ({
    id: 'job-1',
    articleId: 'art-1',
    kind: 'publish',
    source: 'publish',
    status: 'queued',
    items: [],
    recipientCount: 0,
    currentIndex: 0,
    prepareCursor: 0,
    createdAt: agoIso(0),
    updatedAt: agoIso(0),
    ...overrides,
  }) as ArticleNotificationJob;

describe('normalizeSendError', () => {
  it('prefers a real error message and falls back to a stable label', () => {
    expect(normalizeSendError(new Error('  provider refused  '))).toBe('provider refused');
    expect(normalizeSendError(new Error('   '))).toBe('Unknown error');
    expect(normalizeSendError('a bare string')).toBe('Unknown error');
    expect(normalizeSendError(undefined)).toBe('Unknown error');
  });
});

describe('classifyDeliveryFailure', () => {
  it.each([
    'Invalid email address supplied',
    'The message bounced',
    'Recipient is on the suppression list',
    'Forbidden',
    'Unauthorized',
    '400 Bad Request',
    'Domain not verified',
    'From address does not match the verified sender',
  ])('treats %j as terminal', (message) => {
    expect(classifyDeliveryFailure(new Error(message)).disposition).toBe('terminal');
  });

  it.each(['socket hang up', 'ETIMEDOUT', 'Service temporarily unavailable', 'rate limited'])(
    'treats %j as retryable',
    (message) => {
      expect(classifyDeliveryFailure(new Error(message)).disposition).toBe('retryable');
    },
  );

  it('matches the terminal patterns case-insensitively and keeps the original text', () => {
    expect(classifyDeliveryFailure(new Error('INVALID ADDRESS'))).toEqual({
      message: 'INVALID ADDRESS',
      disposition: 'terminal',
    });
  });

  it('defaults an unrecognisable throw to retryable', () => {
    // Better to try again than to write a recipient off on no evidence.
    expect(classifyDeliveryFailure(null)).toEqual({
      message: 'Unknown error',
      disposition: 'retryable',
    });
  });
});

describe('isReadyToAttemptTrackingRecord', () => {
  it('never re-attempts a record that already reached a terminal status', () => {
    expect(isReadyToAttemptTrackingRecord(trackingRecord('sent'))).toBe(false);
    expect(isReadyToAttemptTrackingRecord(trackingRecord('failed_terminal'))).toBe(false);
  });

  it('holds a "sending" record until its lock could plausibly have expired', () => {
    // A record mid-flight in another worker must not be picked up concurrently.
    expect(isReadyToAttemptTrackingRecord(trackingRecord('sending', agoIso(1_000)))).toBe(false);
    expect(
      isReadyToAttemptTrackingRecord(trackingRecord('sending', agoIso(JOB_LOCK_TTL_MS + 1_000))),
    ).toBe(true);
  });

  it('treats a "sending" record with no attempt timestamp as abandoned', () => {
    expect(isReadyToAttemptTrackingRecord(trackingRecord('sending'))).toBe(true);
  });

  it('backs a retryable failure off before trying again', () => {
    expect(isReadyToAttemptTrackingRecord(trackingRecord('failed_retryable', agoIso(1_000)))).toBe(
      false,
    );
    expect(
      isReadyToAttemptTrackingRecord(
        trackingRecord('failed_retryable', agoIso(RETRYABLE_REQUEUE_DELAY_MS + 1_000)),
      ),
    ).toBe(true);
    // The legacy 'failed' status normalizes to retryable, so it backs off too.
    expect(isReadyToAttemptTrackingRecord(trackingRecord('failed', agoIso(1_000)))).toBe(false);
  });

  it('takes a pending record immediately', () => {
    expect(isReadyToAttemptTrackingRecord(trackingRecord('pending'))).toBe(true);
  });
});

describe('clampInteger', () => {
  it('clamps into range and truncates toward zero', () => {
    expect(clampInteger(7, 0, 5)).toBe(5);
    expect(clampInteger(-7, 0, 5)).toBe(0);
    expect(clampInteger(3.9, 0, 5)).toBe(3);
  });

  it('falls back to the minimum for anything that is not a finite number', () => {
    expect(clampInteger('4', 1, 5)).toBe(1);
    expect(clampInteger(Number.NaN, 1, 5)).toBe(1);
    expect(clampInteger(Number.POSITIVE_INFINITY, 1, 5)).toBe(1);
    expect(clampInteger(undefined, 1, 5)).toBe(1);
  });
});

describe('chunkArray', () => {
  it('splits into fixed-size chunks with a short final chunk', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 3)).toEqual([]);
  });
});

describe('inferPrepareCursorFromItems', () => {
  it('counts the leading run of already-prepared publish items', () => {
    expect(
      inferPrepareCursorFromItems('publish', [item('t1'), item('t2'), item(), item('t4')]),
    ).toBe(2);
    expect(inferPrepareCursorFromItems('publish', [item(), item('t2')])).toBe(0);
  });

  it('treats a retry job as fully prepared, because its items arrive with tokens', () => {
    expect(inferPrepareCursorFromItems('retry_undelivered', [item(), item()])).toBe(2);
  });
});

describe('withArticleNotificationJobDefaults', () => {
  it('fills in a recipient count from the items when the stored one is missing', () => {
    const repaired = withArticleNotificationJobDefaults(
      job({ items: [item('t1'), item('t2')], recipientCount: undefined as unknown as number }),
    );

    expect(repaired.recipientCount).toBe(2);
  });

  it('clamps a currentIndex that overshoots the recipient count', () => {
    const repaired = withArticleNotificationJobDefaults(
      job({ items: [item('t1')], recipientCount: 1, currentIndex: 99 }),
    );

    expect(repaired.currentIndex).toBe(1);
  });

  it('infers the prepare cursor for a record written before the field existed', () => {
    const legacy = job({ items: [item('t1'), item()], recipientCount: 2 });
    delete (legacy as Partial<ArticleNotificationJob>).prepareCursor;

    expect(withArticleNotificationJobDefaults(legacy).prepareCursor).toBe(1);
  });

  it('repairs a non-array items field to an empty list', () => {
    const repaired = withArticleNotificationJobDefaults(
      job({ items: null as unknown as ArticleNotificationJobItem[] }),
    );

    expect(repaired.items).toEqual([]);
    expect(repaired.recipientCount).toBe(0);
  });

  it('falls back through updatedAt then createdAt for the progress timestamp', () => {
    const repaired = withArticleNotificationJobDefaults(
      job({ updatedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }),
    );

    expect(repaired.lastProgressAt).toBe('2026-01-02T00:00:00.000Z');
    expect(repaired.lockId).toBeNull();
    expect(repaired.lastError).toBeNull();
  });
});

describe('getJobLastProgressTimestamp', () => {
  it('walks the fallback chain and rejects an unparseable date', () => {
    expect(
      getJobLastProgressTimestamp({
        lastProgressAt: null,
        updatedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(
      getJobLastProgressTimestamp({
        lastProgressAt: 'not a date',
        updatedAt: null,
        createdAt: null,
      }),
    ).toBeNull();
  });
});

describe('getJobPhase', () => {
  it('reports a finished job as completed whatever the counts say', () => {
    expect(getJobPhase(job({ status: 'completed' }), 5, 5)).toBe('completed');
    expect(getJobPhase(job({ status: 'completed_with_failures' }), 5, 5)).toBe('completed');
  });

  it('reports a publish job with unprepared recipients as preparing', () => {
    expect(getJobPhase(job({ kind: 'publish' }), 3, 0)).toBe('preparing');
  });

  it('does not report a retry job as preparing, since its items arrive prepared', () => {
    expect(getJobPhase(job({ kind: 'retry_undelivered' }), 3, 0)).toBe('completed');
  });

  it('reports sending while any delivery is still outstanding', () => {
    expect(getJobPhase(job(), 0, 1)).toBe('sending');
    expect(getJobPhase(job(), 0, 0)).toBe('completed');
  });
});

describe('isArticleNotificationJobStuck', () => {
  it('flags an active job that has made no progress for the stall threshold', () => {
    expect(
      isArticleNotificationJobStuck(
        job({ status: 'processing', lastProgressAt: agoIso(STUCK_JOB_THRESHOLD_MS + 1_000) }),
        'sending',
      ),
    ).toBe(true);
  });

  it('does not flag a job that is still moving', () => {
    expect(
      isArticleNotificationJobStuck(
        job({ status: 'processing', lastProgressAt: agoIso(5_000) }),
        'sending',
      ),
    ).toBe(false);
  });

  it('never flags a completed job or a completed phase', () => {
    const stale = { lastProgressAt: agoIso(STUCK_JOB_THRESHOLD_MS + 1_000) };
    expect(isArticleNotificationJobStuck(job({ status: 'completed', ...stale }), 'sending')).toBe(
      false,
    );
    expect(
      isArticleNotificationJobStuck(job({ status: 'processing', ...stale }), 'completed'),
    ).toBe(false);
  });

  it('does not flag a job whose timestamps are unreadable', () => {
    // Unknown is not the same as stalled; flagging it would cry wolf on the
    // admin dashboard.
    expect(
      isArticleNotificationJobStuck(
        job({ status: 'queued', lastProgressAt: 'nonsense', updatedAt: '', createdAt: '' }),
        'sending',
      ),
    ).toBe(false);
  });
});
