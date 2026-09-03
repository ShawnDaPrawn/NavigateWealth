/**
 * Timeline presentation helpers.
 *
 * The two things worth pinning: month grouping must follow the order the
 * server sent (it is the sort, and re-sorting here would silently disagree
 * with it), and the analysed-coverage figure must not overstate how much of a
 * batch the AI actually read.
 */
import { describe, expect, it } from 'vitest';
import {
  analysedCoverage,
  formatSummaryDate,
  groupSummariesByPeriod,
  linesToList,
  listToLines,
  timelinePeriod,
  toEditDraft,
} from '../summaryFormat';
import type { DocumentSummary } from '../summaryTypes';

function makeSummary(over: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'doc_1',
    clientId: 'client-1',
    scope: 'document',
    title: 'Consent form',
    documentDate: '2026-05-25T00:00:00.000Z',
    documents: [{ id: 'doc_1', title: 'Consent form', productCategory: 'General', analysed: true }],
    documentCount: 1,
    productCategories: ['General'],
    headline: 'Client consent captured',
    summary: 'The client signed the advice consent form.',
    highlights: [],
    followUps: [],
    status: 'generated',
    source: 'manual',
    generatedAt: '2026-05-25T00:00:00.000Z',
    generatedBy: 'admin-1',
    edited: false,
    ...over,
  };
}

describe('dates', () => {
  it('formats a timeline date the way the rest of the Documents tab does', () => {
    expect(formatSummaryDate('2026-05-25T00:00:00.000Z')).toBe('25 May 2026');
  });

  it('does not render "Invalid Date" for junk', () => {
    expect(formatSummaryDate('not-a-date')).toBe('Unknown date');
    expect(timelinePeriod('')).toBe('Undated');
  });
});

describe('grouping by period', () => {
  it('keeps the server order and starts a new heading on each month change', () => {
    const grouped = groupSummariesByPeriod([
      makeSummary({ id: 'a', documentDate: '2026-05-25T00:00:00.000Z' }),
      makeSummary({ id: 'b', documentDate: '2026-05-13T00:00:00.000Z' }),
      makeSummary({ id: 'c', documentDate: '2026-01-30T00:00:00.000Z' }),
    ]);

    expect(grouped.map((g) => g.period)).toEqual(['May 2026', 'January 2026']);
    expect(grouped[0].summaries.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('reopens a month that recurs rather than merging it out of order', () => {
    // Re-grouping by month name would put a stray older entry back under an
    // earlier heading and quietly reorder the client's history.
    const grouped = groupSummariesByPeriod([
      makeSummary({ id: 'a', documentDate: '2026-05-25T00:00:00.000Z' }),
      makeSummary({ id: 'b', documentDate: '2026-01-30T00:00:00.000Z' }),
      makeSummary({ id: 'c', documentDate: '2026-05-01T00:00:00.000Z' }),
    ]);

    expect(grouped.map((g) => g.period)).toEqual(['May 2026', 'January 2026', 'May 2026']);
  });
});

describe('analysed coverage', () => {
  it('reports a partial read when some files were metadata only', () => {
    const coverage = analysedCoverage(
      makeSummary({
        documentCount: 3,
        documents: [
          { id: '1', title: 'a', productCategory: 'Life', analysed: true },
          { id: '2', title: 'b', productCategory: 'Life', analysed: false },
          { id: '3', title: 'c', productCategory: 'Life', analysed: false },
        ],
      }),
    );

    expect(coverage).toEqual({ analysed: 1, total: 3, partial: true });
  });

  it('is not partial when everything was read', () => {
    expect(analysedCoverage(makeSummary()).partial).toBe(false);
  });
});

describe('bullet editing', () => {
  it('drops blank lines and leading bullet characters', () => {
    expect(linesToList('- one\n\n• two\n   \n* three')).toEqual(['one', 'two', 'three']);
  });

  it('round-trips through the textarea representation', () => {
    const list = ['one', 'two'];
    expect(linesToList(listToLines(list))).toEqual(list);
  });

  it('copies the arrays so editing a draft cannot mutate the stored summary', () => {
    const summary = makeSummary({ highlights: ['original'] });
    const draft = toEditDraft(summary);
    draft.highlights.push('added');

    expect(summary.highlights).toEqual(['original']);
  });
});
