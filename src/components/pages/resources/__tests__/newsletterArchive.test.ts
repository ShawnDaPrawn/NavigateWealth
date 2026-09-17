/**
 * newsletterArchive.ts — the tab strip's arithmetic.
 *
 * The contract worth pinning is the rollover: the strip is derived from the
 * clock, so on 1 January the newest year must lead and everything must shift
 * by one with no stored config and no deploy. The rest guards the promises
 * made to the owner: only months that have a newsletter are listed, and
 * "Older" reaches back exactly five further years, no more.
 */
import { describe, it, expect } from 'vitest';
import {
  buildYearTabs,
  defaultYear,
  formatIssueMonth,
  formatPdfSize,
  groupByMonth,
  monthName,
  selectableYears,
  yearsWithNewsletters,
  type PublicNewsletter,
} from '../newsletterArchive';

const newsletter = (issueMonth: string, overrides: Partial<PublicNewsletter> = {}) => {
  const [year, month] = issueMonth.split('-').map(Number);
  return {
    slug: `${issueMonth}-issue`,
    title: `Issue ${issueMonth}`,
    description: 'What mattered.',
    issueMonth,
    year,
    month,
    pdfUrl: `https://cdn.test/${issueMonth}.pdf`,
    pdfFileName: `${issueMonth}.pdf`,
    pdfSizeBytes: 1024 * 1024,
    publishedAt: `${issueMonth}-05T09:00:00.000Z`,
    ...overrides,
  } satisfies PublicNewsletter;
};

describe('buildYearTabs', () => {
  it('offers the current year and the three before it, then five more under Older', () => {
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    const tabs = buildYearTabs(new Date('2026-06-15T00:00:00Z'), years);
    expect(tabs.primary).toEqual([2026, 2025, 2024, 2023]);
    expect(tabs.older).toEqual([2022, 2021, 2020, 2019, 2018]);
  });

  it('never lists a year beyond the Older window, however deep the archive goes', () => {
    const years = Array.from({ length: 20 }, (_, i) => 2026 - i);
    const tabs = buildYearTabs(new Date('2026-06-15T00:00:00Z'), years);
    expect(selectableYears(tabs)).toHaveLength(9);
    expect(Math.min(...selectableYears(tabs))).toBe(2018);
    expect(selectableYears(tabs)).not.toContain(2017);
  });

  it('shifts by one on 1 January with no stored configuration', () => {
    const years = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    const before = buildYearTabs(new Date('2026-12-31T23:59:00Z'), years);
    expect(before.primary).toEqual([2026, 2025, 2024, 2023]);
    expect(before.older).toEqual([2022, 2021, 2020, 2019, 2018]);

    const after = buildYearTabs(new Date('2027-01-01T00:01:00Z'), years);
    expect(after.primary).toEqual([2027, 2026, 2025, 2024]);
    expect(after.older).toEqual([2023, 2022, 2021, 2020, 2019]);
    expect(selectableYears(after)).not.toContain(2018);
  });

  it('lists only years that actually have a newsletter', () => {
    const tabs = buildYearTabs(new Date('2026-06-15T00:00:00Z'), [2026, 2024, 2020]);
    expect(tabs.primary).toEqual([2026, 2024]);
    expect(tabs.older).toEqual([2020]);
  });

  it('copes with a brand-new archive holding one month of one year', () => {
    const tabs = buildYearTabs(new Date('2026-01-10T00:00:00Z'), [2026]);
    expect(tabs.primary).toEqual([2026]);
    expect(tabs.older).toEqual([]);
    expect(defaultYear(tabs)).toBe(2026);
  });

  it('has no default year when nothing is published', () => {
    expect(defaultYear(buildYearTabs(new Date('2026-06-15T00:00:00Z'), []))).toBeNull();
  });

  it('lands on the newest reachable year even when the current year is empty', () => {
    const tabs = buildYearTabs(new Date('2026-02-01T00:00:00Z'), [2025, 2024]);
    expect(defaultYear(tabs)).toBe(2025);
  });
});

describe('groupByMonth', () => {
  it('lists newest month first and skips months with nothing in them', () => {
    const items = [newsletter('2026-01'), newsletter('2026-09'), newsletter('2026-05')];
    const groups = groupByMonth(items, 2026);
    expect(groups.map((g) => g.label)).toEqual(['September', 'May', 'January']);
    expect(groups).toHaveLength(3);
  });

  it('ignores other years', () => {
    const groups = groupByMonth([newsletter('2026-09'), newsletter('2025-09')], 2026);
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].issueMonth).toBe('2026-09');
  });

  it('puts the most recently published first when one month has two issues', () => {
    const early = newsletter('2026-09', { slug: 'early', publishedAt: '2026-09-02T09:00:00.000Z' });
    const late = newsletter('2026-09', { slug: 'late', publishedAt: '2026-09-20T09:00:00.000Z' });
    const [group] = groupByMonth([early, late], 2026);
    expect(group.items.map((i) => i.slug)).toEqual(['late', 'early']);
  });

  it('returns nothing for a year with no newsletters', () => {
    expect(groupByMonth([newsletter('2026-09')], 2024)).toEqual([]);
  });
});

describe('small helpers', () => {
  it('lists the distinct years newest first', () => {
    const items = [newsletter('2024-03'), newsletter('2026-09'), newsletter('2026-01')];
    expect(yearsWithNewsletters(items)).toEqual([2026, 2024]);
  });

  it('names months and formats an issue month for display', () => {
    expect(monthName(1)).toBe('January');
    expect(monthName(12)).toBe('December');
    expect(formatIssueMonth('2026-09')).toBe('September 2026');
    expect(formatIssueMonth('nonsense')).toBe('nonsense');
  });

  it('formats a PDF size in the unit a reader expects', () => {
    expect(formatPdfSize(512 * 1024)).toBe('512 KB');
    expect(formatPdfSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatPdfSize(0)).toBe('');
  });
});
