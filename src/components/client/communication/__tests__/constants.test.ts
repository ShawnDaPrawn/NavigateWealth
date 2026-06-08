import { describe, expect, it } from 'vitest';
import {
  CATEGORY_CONFIG,
  ALL_CATEGORIES,
  DATE_RANGE_OPTIONS,
  DATE_RANGE_DAYS,
  ITEMS_PER_PAGE,
  CONTACT,
  MESSAGE_RETENTION_DAYS,
  TRANSACTIONAL_EXAMPLES,
  MARKETING_EXAMPLES,
  DEFAULT_PREFERENCES,
} from '../constants';

describe('client/communication constants', () => {
  it('CATEGORY_CONFIG has all six categories', () => {
    expect(CATEGORY_CONFIG['Policy Update']).toBeDefined();
    expect(CATEGORY_CONFIG['Document Required']).toBeDefined();
    expect(CATEGORY_CONFIG.Appointment).toBeDefined();
    expect(CATEGORY_CONFIG.Important).toBeDefined();
    expect(CATEGORY_CONFIG['FNA Available']).toBeDefined();
    expect(CATEGORY_CONFIG.General).toBeDefined();
  });

  it('each category config has label, iconColor, bgColor, and badgeClass', () => {
    Object.values(CATEGORY_CONFIG).forEach((cfg) => {
      expect(typeof cfg.label).toBe('string');
      expect(typeof cfg.iconColor).toBe('string');
      expect(typeof cfg.bgColor).toBe('string');
      expect(typeof cfg.badgeClass).toBe('string');
    });
  });

  it('ALL_CATEGORIES contains all six categories', () => {
    expect(ALL_CATEGORIES.length).toBe(6);
    expect(ALL_CATEGORIES).toContain('General');
    expect(ALL_CATEGORIES).toContain('Appointment');
  });

  it('DATE_RANGE_OPTIONS has all, week, and month entries', () => {
    const values = DATE_RANGE_OPTIONS.map((o) => o.value);
    expect(values).toContain('all');
    expect(values).toContain('week');
    expect(values).toContain('month');
  });

  it('DATE_RANGE_DAYS maps week to 7 and month to 30', () => {
    expect(DATE_RANGE_DAYS.week).toBe(7);
    expect(DATE_RANGE_DAYS.month).toBe(30);
  });

  it('ITEMS_PER_PAGE is a positive number', () => {
    expect(typeof ITEMS_PER_PAGE).toBe('number');
    expect(ITEMS_PER_PAGE).toBeGreaterThan(0);
  });

  it('CONTACT has email and phone info', () => {
    expect(CONTACT.email).toMatch(/@/);
    expect(CONTACT.emailHref).toMatch(/^mailto:/);
    expect(CONTACT.phoneTel).toMatch(/^tel:/);
  });

  it('MESSAGE_RETENTION_DAYS is a positive number', () => {
    expect(MESSAGE_RETENTION_DAYS).toBeGreaterThan(0);
  });

  it('TRANSACTIONAL_EXAMPLES is a non-empty array of strings', () => {
    expect(TRANSACTIONAL_EXAMPLES.length).toBeGreaterThan(0);
    TRANSACTIONAL_EXAMPLES.forEach((ex) => expect(typeof ex).toBe('string'));
  });

  it('MARKETING_EXAMPLES is a non-empty array of strings', () => {
    expect(MARKETING_EXAMPLES.length).toBeGreaterThan(0);
    MARKETING_EXAMPLES.forEach((ex) => expect(typeof ex).toBe('string'));
  });

  it('DEFAULT_PREFERENCES has transactional and marketing settings', () => {
    expect(typeof DEFAULT_PREFERENCES.transactional.email).toBe('boolean');
    expect(typeof DEFAULT_PREFERENCES.marketing.email).toBe('boolean');
    expect(DEFAULT_PREFERENCES.transactional.email).toBe(true);
    expect(DEFAULT_PREFERENCES.marketing.email).toBe(false);
  });
});
