import { describe, it, expect } from 'vitest';
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PRIORITY_BG_COLORS,
  PRIORITY_ICON_COLORS,
  PRIORITY_VALUES,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ICON_COLORS,
  STATUS_COLUMN_COLORS,
  CATEGORY_LABELS,
} from '../constants';

describe('task priority constants', () => {
  it('PRIORITY_LABELS covers all four priority levels', () => {
    expect(PRIORITY_LABELS.critical).toBeTruthy();
    expect(PRIORITY_LABELS.high).toBeTruthy();
    expect(PRIORITY_LABELS.medium).toBeTruthy();
    expect(PRIORITY_LABELS.low).toBeTruthy();
  });

  it('PRIORITY_VALUES orders critical > high > medium > low', () => {
    expect(PRIORITY_VALUES.critical).toBeGreaterThan(PRIORITY_VALUES.high);
    expect(PRIORITY_VALUES.high).toBeGreaterThan(PRIORITY_VALUES.medium);
    expect(PRIORITY_VALUES.medium).toBeGreaterThan(PRIORITY_VALUES.low);
  });

  it('color constants are non-empty strings', () => {
    Object.values(PRIORITY_COLORS).forEach((v) => expect(v.length).toBeGreaterThan(0));
    Object.values(PRIORITY_BG_COLORS).forEach((v) => expect(v.length).toBeGreaterThan(0));
    Object.values(PRIORITY_ICON_COLORS).forEach((v) => expect(v.length).toBeGreaterThan(0));
  });
});

describe('task status constants', () => {
  it('STATUS_LABELS covers core statuses', () => {
    expect(STATUS_LABELS.new).toBeTruthy();
    expect(STATUS_LABELS.in_progress).toBeTruthy();
    expect(STATUS_LABELS.completed).toBeTruthy();
  });

  it('STATUS_COLORS has entries for core statuses', () => {
    expect(STATUS_COLORS.new).toBeTruthy();
    expect(STATUS_COLORS.completed).toBeTruthy();
  });

  it('STATUS_ICON_COLORS and STATUS_COLUMN_COLORS are non-empty', () => {
    expect(Object.keys(STATUS_ICON_COLORS).length).toBeGreaterThan(0);
    expect(Object.keys(STATUS_COLUMN_COLORS).length).toBeGreaterThan(0);
  });
});

describe('task category labels', () => {
  it('CATEGORY_LABELS is a non-empty record', () => {
    expect(Object.keys(CATEGORY_LABELS).length).toBeGreaterThan(0);
    Object.values(CATEGORY_LABELS).forEach((v) => expect(typeof v).toBe('string'));
  });
});
