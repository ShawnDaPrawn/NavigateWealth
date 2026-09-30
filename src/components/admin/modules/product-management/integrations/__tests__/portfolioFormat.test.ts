/**
 * portfolioFormat — how the Portfolio tab writes values, and how it searches
 * and sorts the book.
 */
import { describe, expect, it } from 'vitest';
import type { PortfolioColumn, PortfolioRow } from '@/shared/integrations/portfolio-table';
import {
  DEFAULT_PORTFOLIO_SORT,
  describeSyncSource,
  filterPortfolioRows,
  formatPortfolioDate,
  formatPortfolioDateTime,
  formatPortfolioValue,
  isNumericColumn,
  nextPortfolioSort,
  sortPortfolioRows,
} from '../portfolioFormat';

const column = (type: string, id = 'f'): PortfolioColumn => ({
  id,
  name: id,
  type,
  required: false,
  isPolicyNumber: false,
});

const row = (
  clientName: string,
  policyNumber: string,
  values: Record<string, unknown> = {},
  updatedAt = '2026-01-01T00:00:00.000Z',
): PortfolioRow => ({
  clientId: `c-${clientName}`,
  clientName,
  policyId: `p-${policyNumber}`,
  policyNumber,
  categoryId: 'retirement_pre',
  updatedAt,
  lockedFields: [],
  values,
  lastSync: null,
  policyPrint: null,
});

describe('formatPortfolioValue', () => {
  it('renders empties as a dash', () => {
    expect(formatPortfolioValue(column('currency'), null)).toBe('—');
    expect(formatPortfolioValue(column('text'), '')).toBe('—');
    expect(formatPortfolioValue(column('text'), undefined)).toBe('—');
  });

  it('writes money and numbers the way the rest of the app does, on any locale', () => {
    expect(formatPortfolioValue(column('currency'), 1234.5)).toBe('R1,234.50');
    expect(formatPortfolioValue(column('currency'), '551894.41')).toBe('R551,894.41');
    expect(formatPortfolioValue(column('number'), 1234)).toBe('1,234');
    expect(formatPortfolioValue(column('percentage'), '12')).toBe('12%');
    // A value that is not a number is shown as stored rather than as R0.00.
    expect(formatPortfolioValue(column('currency'), 'n/a')).toBe('n/a');
  });

  it('reads a stored ISO date as a calendar date and leaves other spellings alone', () => {
    expect(formatPortfolioValue(column('date'), '2070-11-26')).toBe('26 Nov 2070');
    expect(formatPortfolioValue(column('date'), '2018-07-02T00:00:00.000Z')).toBe('02 Jul 2018');
    expect(formatPortfolioValue(column('date'), '02 Jul 2018')).toBe('02 Jul 2018');
    expect(formatPortfolioValue(column('date'), '2018-13-02')).toBe('2018-13-02');
  });

  it('answers yes or no for booleans, stored either way', () => {
    expect(formatPortfolioValue(column('boolean'), true)).toBe('Yes');
    expect(formatPortfolioValue(column('boolean'), 'false')).toBe('No');
    expect(formatPortfolioValue(column('text'), 'Acme')).toBe('Acme');
    expect(formatPortfolioValue(column('text'), { a: 1 })).toBe('{"a":1}');
  });

  it('right-aligns only numeric columns', () => {
    expect(isNumericColumn(column('currency'))).toBe(true);
    expect(isNumericColumn(column('percentage'))).toBe(true);
    expect(isNumericColumn(column('date'))).toBe(false);
  });
});

describe('timestamps', () => {
  it('writes day, month name and year, never a numeric date a reader could misread', () => {
    expect(formatPortfolioDateTime('2026-09-05T10:52:00.000Z')).toMatch(
      /^\d{2} [A-Z][a-z]{2} 2026, \d{2}:\d{2}$/,
    );
    expect(formatPortfolioDate('2026-02-01T09:00:00.000Z')).toMatch(/^\d{2} [A-Z][a-z]{2} 2026$/);
    expect(formatPortfolioDateTime('')).toBe('—');
    expect(formatPortfolioDate(null)).toBe('—');
    expect(formatPortfolioDateTime('not a date')).toBe('not a date');
  });

  it('names where an automated change came from', () => {
    expect(describeSyncSource('portal')).toBe('Portal sync');
    expect(describeSyncSource('portfolio_table')).toBe('Portfolio table');
    expect(describeSyncSource('some_new_source')).toBe('some new source');
  });
});

describe('filterPortfolioRows', () => {
  const rows = [row('Zoë Botha', 'EB-001'), row('John Smith', 'AGRA 678002')];

  it('finds a client by name without regard to case or accents', () => {
    expect(filterPortfolioRows(rows, 'zoe').map((r) => r.clientName)).toEqual(['Zoë Botha']);
    expect(filterPortfolioRows(rows, '  SMITH ').map((r) => r.clientName)).toEqual(['John Smith']);
  });

  it('finds a policy number without regard to spaces or dashes', () => {
    expect(filterPortfolioRows(rows, 'eb001').map((r) => r.clientName)).toEqual(['Zoë Botha']);
    expect(filterPortfolioRows(rows, 'agra678').map((r) => r.clientName)).toEqual(['John Smith']);
  });

  it('returns every row for an empty query', () => {
    expect(filterPortfolioRows(rows, '')).toHaveLength(2);
    expect(filterPortfolioRows(rows, ' - ')).toHaveLength(2);
    expect(filterPortfolioRows(rows, 'nobody')).toHaveLength(0);
  });
});

describe('sortPortfolioRows', () => {
  const columns = [column('currency', 'value'), column('date', 'start'), column('text', 'notes')];
  const rows = [
    row('Bongani', 'P1', { value: 500, start: '2018-07-02', notes: 'b' }, '2026-03-01T00:00:00Z'),
    row('Anele', 'P2', { value: null, start: '02 Jul 2010' }, '2026-01-01T00:00:00Z'),
    row('Carla', 'P3', { value: 90, start: '', notes: 'a' }, '2026-02-01T00:00:00Z'),
  ];
  const names = (sorted: PortfolioRow[]) => sorted.map((r) => r.clientName);

  it('sorts by client name by default', () => {
    expect(names(sortPortfolioRows(rows, columns, DEFAULT_PORTFOLIO_SORT))).toEqual([
      'Anele',
      'Bongani',
      'Carla',
    ]);
  });

  it('sorts money by amount, with empty cells last in either direction', () => {
    expect(names(sortPortfolioRows(rows, columns, { key: 'value', direction: 'asc' }))).toEqual([
      'Carla',
      'Bongani',
      'Anele',
    ]);
    expect(names(sortPortfolioRows(rows, columns, { key: 'value', direction: 'desc' }))).toEqual([
      'Bongani',
      'Carla',
      'Anele',
    ]);
  });

  it('sorts dates chronologically, whichever way they were stored', () => {
    expect(names(sortPortfolioRows(rows, columns, { key: 'start', direction: 'asc' }))).toEqual([
      'Anele',
      'Bongani',
      'Carla',
    ]);
  });

  it('sorts by when the record was last updated', () => {
    expect(names(sortPortfolioRows(rows, columns, { key: 'updatedAt', direction: 'asc' }))).toEqual(
      ['Anele', 'Carla', 'Bongani'],
    );
  });

  it('keeps the incoming order for ties and does not mutate its input', () => {
    const tied = [row('B', '1', { notes: 'x' }), row('A', '2', { notes: 'x' })];
    expect(names(sortPortfolioRows(tied, columns, { key: 'notes', direction: 'desc' }))).toEqual([
      'B',
      'A',
    ]);
    expect(names(tied)).toEqual(['B', 'A']);
  });

  it('toggles direction on the same header and starts ascending on a new one', () => {
    const byValue = nextPortfolioSort(DEFAULT_PORTFOLIO_SORT, 'value');
    expect(byValue).toEqual({ key: 'value', direction: 'asc' });
    expect(nextPortfolioSort(byValue, 'value')).toEqual({ key: 'value', direction: 'desc' });
    expect(nextPortfolioSort({ key: 'value', direction: 'desc' }, 'value').direction).toBe('asc');
  });
});
