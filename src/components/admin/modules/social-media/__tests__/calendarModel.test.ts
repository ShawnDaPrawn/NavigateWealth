import { describe, it, expect } from 'vitest';
import { covers, sameRange, startOfWeek, unionRange, visibleWindow } from '../calendarModel';

describe('calendarModel', () => {
  it('starts the week on Monday without mutating the input', () => {
    const sunday = new Date(2026, 8, 13, 15, 0);
    const monday = startOfWeek(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(7);
    expect(sunday.getDate()).toBe(13);
  });

  it('computes the visible window per view', () => {
    const date = new Date(2026, 8, 10); // Thu 10 Sep 2026
    const month = visibleWindow(date, 'month');
    expect(month.start.getTime()).toBe(new Date(2026, 7, 25).getTime()); // 1 Sep - 7 days
    expect(month.end.getTime()).toBe(new Date(2026, 9, 8).getTime()); // 30 Sep + 8 days
    const week = visibleWindow(date, 'week');
    expect(week.start.getTime()).toBe(new Date(2026, 8, 7).getTime());
    expect(week.end.getTime()).toBe(new Date(2026, 8, 14).getTime());
    const day = visibleWindow(date, 'day');
    expect(day.start.getTime()).toBe(new Date(2026, 8, 10).getTime());
    expect(day.end.getTime()).toBe(new Date(2026, 8, 11).getTime());
  });

  it('unions ranges so the query window only grows, and knows when it already covers a view', () => {
    const a = { start: new Date(2026, 8, 1), end: new Date(2026, 9, 1) };
    const b = { start: new Date(2026, 7, 1), end: new Date(2026, 8, 15) };
    const u = unionRange(a, b);
    expect(u.start.getTime()).toBe(b.start.getTime());
    expect(u.end.getTime()).toBe(a.end.getTime());
    expect(sameRange(u, unionRange(u, a))).toBe(true);
    expect(covers(u, a)).toBe(true);
    expect(covers(a, b)).toBe(false);
  });
});
