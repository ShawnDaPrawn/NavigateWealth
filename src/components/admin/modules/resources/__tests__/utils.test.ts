import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  getCategoryIcon,
  getCategoryColor,
  getDifficultyColor,
  formatDuration,
  getStarRating,
  formatViewCount,
  getRelativeTime,
  validateFormName,
  sanitizeFormData,
  generatePreviewData,
  hasRequiredFields,
  countFormFields,
  estimateCompletionTime,
} from '../utils';

describe('formatFileSize', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('formats bytes correctly', () => {
    expect(formatFileSize(500)).toContain('Bytes');
  });

  it('formats KB correctly', () => {
    expect(formatFileSize(1024)).toContain('KB');
  });

  it('formats MB correctly', () => {
    expect(formatFileSize(1024 * 1024)).toContain('MB');
  });

  it('formats GB correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toContain('GB');
  });
});

describe('getCategoryIcon', () => {
  it('returns an icon for known categories', () => {
    expect(getCategoryIcon('Forms').length).toBeGreaterThan(0);
    expect(getCategoryIcon('Legal').length).toBeGreaterThan(0);
    expect(getCategoryIcon('Letters').length).toBeGreaterThan(0);
  });

  it('returns a fallback icon for unknown categories', () => {
    const fallback = getCategoryIcon('Unknown Category');
    expect(fallback.length).toBeGreaterThan(0);
  });
});

describe('getCategoryColor', () => {
  it('returns a CSS class string for known categories', () => {
    expect(getCategoryColor('Forms')).toContain('blue');
    expect(getCategoryColor('Legal')).toContain('amber');
    expect(getCategoryColor('Letters')).toContain('violet');
  });

  it('returns a fallback gray class for unknown categories', () => {
    expect(getCategoryColor('Unknown')).toContain('gray');
  });
});

describe('getDifficultyColor', () => {
  it('returns green for Beginner, yellow for Intermediate, red for Advanced', () => {
    expect(getDifficultyColor('Beginner')).toContain('green');
    expect(getDifficultyColor('Intermediate')).toContain('yellow');
    expect(getDifficultyColor('Advanced')).toContain('red');
  });

  it('returns fallback gray for unknown difficulty', () => {
    expect(getDifficultyColor('Unknown')).toContain('gray');
  });
});

describe('formatDuration', () => {
  it('formats minutes less than 60 as "N min"', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats exactly 60 minutes as "1 hour"', () => {
    expect(formatDuration(60)).toBe('1 hour');
  });

  it('formats exactly 120 minutes as "2 hours"', () => {
    expect(formatDuration(120)).toBe('2 hours');
  });

  it('formats 90 minutes as "1h 30m"', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });
});

describe('getStarRating', () => {
  it('returns a non-empty string', () => {
    expect(getStarRating(3).length).toBeGreaterThan(0);
    expect(getStarRating(5).length).toBeGreaterThan(0);
  });

  it('produces longer string for higher ratings', () => {
    expect(getStarRating(5).length).toBeGreaterThanOrEqual(getStarRating(1).length);
  });
});

describe('formatViewCount', () => {
  it('returns raw number for < 1000', () => {
    expect(formatViewCount(500)).toBe('500');
    expect(formatViewCount(0)).toBe('0');
  });

  it('adds K suffix for thousands', () => {
    expect(formatViewCount(1500)).toContain('K');
    expect(formatViewCount(1500)).toContain('1.5');
  });

  it('adds M suffix for millions', () => {
    expect(formatViewCount(2_500_000)).toContain('M');
    expect(formatViewCount(2_500_000)).toContain('2.5');
  });
});

describe('getRelativeTime', () => {
  it('returns "Today" for today\'s date', () => {
    expect(getRelativeTime(new Date().toISOString())).toBe('Today');
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(getRelativeTime(yesterday)).toBe('Yesterday');
  });

  it('returns "N days ago" for recent dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(getRelativeTime(threeDaysAgo)).toContain('days ago');
  });

  it('returns "N weeks ago" for dates 2+ weeks back', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    expect(getRelativeTime(twoWeeksAgo)).toContain('weeks ago');
  });

  it('returns "N months ago" for dates 2+ months back', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    expect(getRelativeTime(twoMonthsAgo)).toContain('months ago');
  });

  it('returns "N years ago" for old dates', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString();
    expect(getRelativeTime(twoYearsAgo)).toContain('years ago');
  });
});

describe('validateFormName', () => {
  it('rejects empty name', () => {
    expect(validateFormName('').valid).toBe(false);
    expect(validateFormName('   ').valid).toBe(false);
  });

  it('rejects name shorter than 3 characters', () => {
    const result = validateFormName('AB');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects name longer than 100 characters', () => {
    const result = validateFormName('A'.repeat(101));
    expect(result.valid).toBe(false);
  });

  it('accepts a valid name', () => {
    expect(validateFormName('Client Consent Form').valid).toBe(true);
  });
});

describe('sanitizeFormData', () => {
  it('removes _internal and __typename fields', () => {
    const data = { name: 'test', _internal: 'hidden', __typename: 'Form' };
    const result = sanitizeFormData(data);
    expect(result._internal).toBeUndefined();
    expect(result.__typename).toBeUndefined();
    expect(result.name).toBe('test');
  });

  it('ensures client, personalInformation, and adviser objects exist', () => {
    const result = sanitizeFormData({});
    expect(result.client).toBeDefined();
    expect(result.personalInformation).toBeDefined();
    expect(result.adviser).toBeDefined();
  });
});

describe('generatePreviewData', () => {
  it('returns an object with date and nested client/adviser fields', () => {
    const data = generatePreviewData();
    expect(typeof data.date).toBe('string');
    expect(data.client).toBeDefined();
    expect(data.adviser).toBeDefined();
  });

  it('populates client name from firstName and lastName', () => {
    const data = generatePreviewData(
      { firstName: 'John', lastName: 'Doe' },
      { name: 'Jane Adviser' },
    );
    expect((data.client as Record<string, unknown>).name).toContain('John');
    expect((data.client as Record<string, unknown>).name).toContain('Doe');
  });

  it('falls back to empty strings when no client provided', () => {
    const data = generatePreviewData();
    expect((data.client as Record<string, unknown>).idNumber).toBe('');
  });
});

describe('hasRequiredFields', () => {
  it('returns false for empty blocks array', () => {
    expect(hasRequiredFields([])).toBe(false);
  });

  it('returns true when blocks contain a field_grid block', () => {
    expect(hasRequiredFields([{ id: '1', type: 'field_grid', data: {} }])).toBe(true);
  });

  it('returns true when blocks contain a signature block', () => {
    expect(hasRequiredFields([{ id: '1', type: 'signature', data: {} }])).toBe(true);
  });

  it('returns false when blocks contain only non-data blocks', () => {
    expect(hasRequiredFields([{ id: '1', type: 'section_header', data: {} }])).toBe(false);
  });
});

describe('countFormFields', () => {
  it('returns 0 for null/undefined input', () => {
    expect(countFormFields(null as unknown as [])).toBe(0);
    expect(countFormFields([])).toBe(0);
  });

  it('counts fields in field_grid blocks', () => {
    const blocks = [
      {
        id: '1',
        type: 'field_grid',
        data: { fields: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
      },
    ];
    expect(countFormFields(blocks as unknown as import('../builder/types').FormBlock[])).toBe(3);
  });

  it('counts signatories in signature blocks', () => {
    const blocks = [
      {
        id: '1',
        type: 'signature',
        data: { signatories: [{ key: 'client' }, { key: 'adviser' }] },
      },
    ];
    expect(countFormFields(blocks as unknown as import('../builder/types').FormBlock[])).toBe(2);
  });
});

describe('estimateCompletionTime', () => {
  it('returns at least 5 minutes for any input', () => {
    expect(estimateCompletionTime([])).toBeGreaterThanOrEqual(5);
  });

  it('returns more time for forms with more fields', () => {
    const manyFieldBlocks = [
      {
        id: '1',
        type: 'field_grid',
        data: { fields: Array.from({ length: 20 }, (_, i) => ({ key: `f${i}` })) },
      },
    ];
    const fewFieldBlocks = [{ id: '1', type: 'field_grid', data: { fields: [{ key: 'a' }] } }];
    expect(
      estimateCompletionTime(manyFieldBlocks as unknown as import('../builder/types').FormBlock[]),
    ).toBeGreaterThan(
      estimateCompletionTime(fewFieldBlocks as unknown as import('../builder/types').FormBlock[]),
    );
  });
});
