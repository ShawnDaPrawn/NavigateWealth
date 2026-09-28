import { describe, expect, it } from 'vitest';
import { FNA_STATUS_CONFIG, FNA_BADGE_SIZE_CLASSES, FNA_QUERY_KEYS } from '../constants';

describe('fna/constants', () => {
  it('FNA_STATUS_CONFIG has published, archived, and draft entries', () => {
    expect(FNA_STATUS_CONFIG.published.label).toBe('Published');
    expect(FNA_STATUS_CONFIG.archived.label).toBe('Archived');
    expect(FNA_STATUS_CONFIG.draft.label).toBe('Draft');
  });

  it('FNA_STATUS_CONFIG entries have iconSlug and badgeClass', () => {
    Object.values(FNA_STATUS_CONFIG).forEach((config) => {
      expect(typeof config.iconSlug).toBe('string');
      expect(typeof config.badgeClass).toBe('string');
    });
  });

  it('FNA_BADGE_SIZE_CLASSES has sm, md, and lg sizes', () => {
    expect(FNA_BADGE_SIZE_CLASSES.sm).toBeDefined();
    expect(FNA_BADGE_SIZE_CLASSES.md).toBeDefined();
    expect(FNA_BADGE_SIZE_CLASSES.lg).toBeDefined();
  });

  it('FNA_QUERY_KEYS is defined', () => {
    expect(FNA_QUERY_KEYS).toBeDefined();
  });
});
