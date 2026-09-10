import { describe, it, expect } from 'vitest';
import {
  countChannel,
  formatSlot,
  formatWeekLabel,
  groupAssetsByChannel,
  isoWeekKey,
  isoWeekRange,
  parseSlotsText,
  postingWeekKey,
  slotsToText,
  sortAssets,
  summarizeRunReport,
} from '../assetsModel';
import type { SocialAsset } from '../assetsTypes';

function asset(overrides: Partial<SocialAsset>): SocialAsset {
  return {
    id: 'a',
    batch_id: 'b',
    week_key: '2026-W38',
    channel: 'linkedin',
    title: 't',
    body: 'b',
    first_comment: null,
    hashtags: [],
    link_url: null,
    link_title: null,
    source_article_ids: [],
    source_summary: null,
    image_brief: null,
    image_style: null,
    image_status: 'none',
    image_url: null,
    image_storage_path: null,
    image_alt_text: null,
    image_error: null,
    state: 'generated',
    selection_rank: null,
    selection_rationale: null,
    scheduled_for: null,
    buffer_post_id: null,
    buffer_status: null,
    buffer_error: null,
    published_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-12T04:00:00Z',
    updated_at: '2026-09-12T04:00:00Z',
    ...overrides,
  };
}

describe('ISO weeks', () => {
  it('computes the week key across year boundaries', () => {
    expect(isoWeekKey(new Date(2026, 8, 10))).toBe('2026-W37'); // Thu 10 Sep 2026
    expect(isoWeekKey(new Date(2026, 8, 14))).toBe('2026-W38'); // Mon 14 Sep 2026
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53'); // Fri 1 Jan 2027 belongs to 2026-W53
    expect(isoWeekKey(new Date(2024, 11, 30))).toBe('2025-W01'); // Mon 30 Dec 2024 is 2025-W01
  });

  it('posting week is the current week on weekdays and next week on the weekend — the playbook rule', () => {
    expect(postingWeekKey(new Date(2026, 8, 10))).toBe('2026-W37'); // Thursday
    expect(postingWeekKey(new Date(2026, 8, 12))).toBe('2026-W38'); // Saturday
    expect(postingWeekKey(new Date(2026, 8, 13))).toBe('2026-W38'); // Sunday
    expect(postingWeekKey(new Date(2026, 8, 14))).toBe('2026-W38'); // Monday
  });

  it('resolves a week key to its Monday–Sunday range and a label', () => {
    const range = isoWeekRange('2026-W38')!;
    expect(range.start.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(formatWeekLabel('2026-W38')).toMatch(/^Week 38 · 14 – 20 Sept? 2026$/);
    expect(formatWeekLabel('2026-W40')).toMatch(/^Week 40 · 28 Sept? – 04 Oct 2026$/);
    expect(formatWeekLabel('nonsense')).toBe('nonsense');
    expect(isoWeekRange('nonsense')).toBeNull();
  });
});

describe('slots', () => {
  it('formats a slot in the posting timezone', () => {
    expect(formatSlot('2026-09-15T05:30:00Z', 'Africa/Johannesburg')).toMatch(
      /^Tue, 15 Sept?, 07:30$/,
    );
    expect(formatSlot(null, 'Africa/Johannesburg')).toBe('—');
    expect(formatSlot('not a date', 'Africa/Johannesburg')).toBe('—');
  });

  it('round-trips slot text and reports the first invalid line', () => {
    expect(slotsToText(['tue 07:30', 'thu 17:30'])).toBe('tue 07:30\nthu 17:30');
    expect(parseSlotsText('Tue 07:30\n\nthu 17:30, fri 8:00')).toEqual({
      slots: ['tue 07:30', 'thu 17:30', 'fri 8:00'],
      invalid: null,
    });
    expect(parseSlotsText('tue 07:30\nmonday 9am')).toEqual({ slots: [], invalid: 'monday 9am' });
  });
});

describe('grouping and counting', () => {
  it('sorts live assets first by rank, then candidates by creation, then the removed', () => {
    const sorted = sortAssets([
      asset({ id: 'rej', state: 'rejected' }),
      asset({ id: 'gen2', state: 'generated', created_at: '2026-09-12T05:00:00Z' }),
      asset({ id: 'sch2', state: 'scheduled', selection_rank: 2 }),
      asset({ id: 'gen1', state: 'generated', created_at: '2026-09-12T04:00:00Z' }),
      asset({ id: 'pub', state: 'published', selection_rank: 1 }),
      asset({ id: 'sch1', state: 'scheduled', selection_rank: 1 }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['pub', 'sch1', 'sch2', 'gen1', 'gen2', 'rej']);
  });

  it('groups by channel and counts lifecycle buckets', () => {
    const groups = groupAssetsByChannel([
      asset({ id: '1', channel: 'x', state: 'generated' }),
      asset({ id: '2', channel: 'x', state: 'scheduled' }),
      asset({ id: '3', channel: 'instagram', state: 'published' }),
      asset({ id: '4', channel: 'instagram', state: 'rejected' }),
    ]);
    expect(groups.linkedin).toEqual([]);
    expect(groups.x.map((a) => a.id)).toEqual(['2', '1']);
    expect(countChannel(groups.x)).toEqual({ total: 2, candidates: 1, live: 1, published: 0 });
    expect(countChannel(groups.instagram)).toEqual({
      total: 2,
      candidates: 0,
      live: 1,
      published: 1,
    });
  });
});

describe('run report summary', () => {
  it('turns the routines’ report JSON into readable lines', () => {
    expect(
      summarizeRunReport({
        generation: { articles_considered: 32, articles_used: 7, notes: 'Two evergreen topics' },
        selection: {
          scheduled: { linkedin: 2, instagram: 1 },
          skipped: { x: 'channel not connected' },
          failures: ['Budget post: token expired'],
          context_notes: 'Repo rate held',
        },
      }),
    ).toEqual([
      'Articles: 7 used of 32 considered',
      'Generation: Two evergreen topics',
      'Scheduled: LinkedIn 2, Instagram 1',
      'Skipped X: channel not connected',
      'Failures: Budget post: token expired',
      'Context: Repo rate held',
    ]);
    expect(summarizeRunReport(null)).toEqual([]);
    expect(summarizeRunReport({})).toEqual([]);
  });
});
