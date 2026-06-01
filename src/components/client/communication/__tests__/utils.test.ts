/**
 * client/communication/utils — unit tests (Phase 4 coverage push).
 *
 * HTML helpers (detect / strip / DOMPurify-sanitize), relative + full date
 * formatting, and the search/category/date-range filter + inbox-stat
 * derivations. DATE_RANGE_DAYS is mocked so the date-range branch is testable.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../constants', () => ({ DATE_RANGE_DAYS: { '7days': 7, '30days': 30 } }));

import {
  isHtmlContent,
  stripHtml,
  sanitizeHtml,
  formatRelativeDate,
  formatFullDate,
  filterCommunications,
  deriveInboxStats,
  countActiveChannels,
} from '../utils';
import type { Communication } from '../types';

function comm(over: Record<string, unknown> = {}): Communication {
  return {
    id: 'c1',
    subject: 'Hello',
    message: 'Plain body',
    from: 'admin@nw.co',
    category: 'General',
    timestamp: new Date(),
    read: false,
    priority: 'normal',
    ...over,
  } as unknown as Communication;
}

describe('HTML helpers', () => {
  it('isHtmlContent detects markup', () => {
    expect(isHtmlContent('<p>hi</p>')).toBe(true);
    expect(isHtmlContent('just text')).toBe(false);
  });
  it('stripHtml produces a clean text excerpt', () => {
    expect(stripHtml('<p>Hello</p><br>world &amp; co')).toBe('Hello world & co');
  });
  it('sanitizeHtml removes scripts but keeps safe formatting', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('ok');
    expect(out.toLowerCase()).not.toContain('<script');
  });
});

describe('date formatting', () => {
  const hoursAgo = (h: number) => new Date(Date.now() - (h * 3600 + 60) * 1000);
  it('formatRelativeDate renders relative buckets', () => {
    expect(formatRelativeDate(new Date())).toBe('Just now');
    expect(formatRelativeDate(hoursAgo(1))).toBe('1 hour ago');
    expect(formatRelativeDate(hoursAgo(3))).toBe('3 hours ago');
    expect(formatRelativeDate(hoursAgo(25))).toBe('Yesterday');
    expect(formatRelativeDate(hoursAgo(73))).toBe('3 days ago');
  });
  it('formatRelativeDate falls back to an absolute date past a week', () => {
    expect(formatRelativeDate(hoursAgo(240))).not.toMatch(/ago|yesterday|just now/i);
  });
  it('formatFullDate includes the year', () => {
    expect(formatFullDate(new Date('2026-05-07T10:30:00Z'))).toContain('2026');
  });
});

describe('filterCommunications', () => {
  const base = [
    comm({ id: 'a', subject: 'Policy update', from: 'x@y.co', timestamp: new Date('2026-05-01') }),
    comm({
      id: 'b',
      subject: 'Invoice',
      message: '<p>Your <b>premium</b> is due</p>',
      timestamp: new Date('2026-05-03'),
    }),
  ];

  it('searches subject, (stripped) message and sender', () => {
    expect(
      filterCommunications(base, { search: 'premium', category: 'all', dateRange: 'all' }).map(
        (c) => c.id,
      ),
    ).toEqual(['b']);
    expect(
      filterCommunications(base, { search: 'x@y', category: 'all', dateRange: 'all' }).map(
        (c) => c.id,
      ),
    ).toEqual(['a']);
  });
  it('filters by category', () => {
    const items = [
      comm({ id: 'a', category: 'Important' }),
      comm({ id: 'b', category: 'General' }),
    ];
    expect(
      filterCommunications(items, { search: '', category: 'Important', dateRange: 'all' }).map(
        (c) => c.id,
      ),
    ).toEqual(['a']);
  });
  it('filters by date range and sorts newest first', () => {
    const items = [
      comm({ id: 'old', timestamp: new Date(Date.now() - 20 * 24 * 3600 * 1000) }),
      comm({ id: 'new', timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000) }),
    ];
    const res = filterCommunications(items, { search: '', category: 'all', dateRange: '7days' });
    expect(res.map((c) => c.id)).toEqual(['new']);
  });
});

describe('stats', () => {
  it('deriveInboxStats counts total / unread / important', () => {
    const items = [
      comm({ read: false, category: 'Important' }),
      comm({ read: true, priority: 'urgent' }),
      comm({ read: true, category: 'General', priority: 'normal' }),
    ];
    expect(deriveInboxStats(items)).toEqual({ total: 3, unread: 1, important: 2 });
  });
  it('countActiveChannels counts enabled channels', () => {
    expect(
      countActiveChannels({
        transactional: { email: true, sms: false },
        marketing: { email: true, sms: true },
      }),
    ).toBe(3);
  });
});
