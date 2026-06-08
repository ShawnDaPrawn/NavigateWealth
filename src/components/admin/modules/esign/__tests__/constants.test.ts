import { describe, it, expect } from 'vitest';
import {
  ENVELOPE_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
  ENVELOPE_STATUS_LABELS,
  ENVELOPE_STATUS_COLORS,
  SIGNER_STATUS_LABELS,
  SIGNER_STATUS_COLORS,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ICONS,
  FIELD_TYPE_COLORS,
  DEFAULT_EXPIRY_DAYS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_TYPES,
  DEFAULT_FIELD_WIDTH,
  DEFAULT_FIELD_HEIGHT,
  DEFAULT_SIGNATURE_HEIGHT,
  DEFAULT_CHECKBOX_SIZE,
  DEFAULT_FILTERS,
  QUERY_STALE_TIME,
  QUERY_GC_TIME,
  EXPIRING_SOON_DAYS,
  MAX_SIGNERS_PER_ENVELOPE,
  MAX_FIELDS_PER_ENVELOPE,
  SIGNER_ROLES,
  SIGNER_COLORS,
  CURRENT_MAX_SIGNERS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  INFO_MESSAGES,
  EMAIL_REGEX,
  MIN_TITLE_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_REJECTION_REASON_LENGTH,
} from '../constants';

describe('ENVELOPE_STATUS_CONFIG', () => {
  it('covers all envelope statuses including draft, sent, completed, and voided', () => {
    expect(ENVELOPE_STATUS_CONFIG.draft).toBeDefined();
    expect(ENVELOPE_STATUS_CONFIG.sent).toBeDefined();
    expect(ENVELOPE_STATUS_CONFIG.completed).toBeDefined();
    expect(ENVELOPE_STATUS_CONFIG.voided).toBeDefined();
  });

  it('every status has label, badgeClass, dotClass, and icon', () => {
    Object.values(ENVELOPE_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
      expect(cfg.icon).toBeDefined();
    });
  });

  it('completed has green badge, declined has red badge', () => {
    expect(ENVELOPE_STATUS_CONFIG.completed.badgeClass).toContain('green');
    expect(ENVELOPE_STATUS_CONFIG.declined.badgeClass).toContain('red');
  });
});

describe('SIGNER_STATUS_CONFIG', () => {
  it('covers pending, sent, signed, and declined statuses', () => {
    expect(SIGNER_STATUS_CONFIG.pending).toBeDefined();
    expect(SIGNER_STATUS_CONFIG.sent).toBeDefined();
    expect(SIGNER_STATUS_CONFIG.signed).toBeDefined();
    expect(SIGNER_STATUS_CONFIG.declined).toBeDefined();
  });

  it('signed status has green badge', () => {
    expect(SIGNER_STATUS_CONFIG.signed.badgeClass).toContain('green');
  });
});

describe('derived label and color maps', () => {
  it('ENVELOPE_STATUS_LABELS matches config labels', () => {
    expect(ENVELOPE_STATUS_LABELS.draft).toBe(ENVELOPE_STATUS_CONFIG.draft.label);
    expect(ENVELOPE_STATUS_LABELS.completed).toBe(ENVELOPE_STATUS_CONFIG.completed.label);
  });

  it('ENVELOPE_STATUS_COLORS matches config badgeClass values', () => {
    expect(ENVELOPE_STATUS_COLORS.draft).toBe(ENVELOPE_STATUS_CONFIG.draft.badgeClass);
  });

  it('SIGNER_STATUS_LABELS and SIGNER_STATUS_COLORS are non-empty', () => {
    expect(Object.keys(SIGNER_STATUS_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(SIGNER_STATUS_COLORS).length).toBeGreaterThan(0);
  });
});

describe('FIELD_TYPE constants', () => {
  it('FIELD_TYPE_LABELS covers signature, initials, text, date, checkbox, attachment', () => {
    expect(FIELD_TYPE_LABELS.signature).toBeTruthy();
    expect(FIELD_TYPE_LABELS.initials).toBeTruthy();
    expect(FIELD_TYPE_LABELS.text).toBeTruthy();
    expect(FIELD_TYPE_LABELS.date).toBeTruthy();
    expect(FIELD_TYPE_LABELS.checkbox).toBeTruthy();
    expect(FIELD_TYPE_LABELS.attachment).toBeTruthy();
  });

  it('FIELD_TYPE_ICONS is non-empty with string values', () => {
    Object.values(FIELD_TYPE_ICONS).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('FIELD_TYPE_COLORS is non-empty with string values', () => {
    Object.values(FIELD_TYPE_COLORS).forEach((v) => expect(v.length).toBeGreaterThan(0));
  });
});

describe('numeric defaults', () => {
  it('DEFAULT_EXPIRY_DAYS is a positive number', () => {
    expect(DEFAULT_EXPIRY_DAYS).toBeGreaterThan(0);
  });

  it('DEFAULT_PAGE_SIZE is a positive integer', () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_PAGE_SIZE)).toBe(true);
  });

  it('DEFAULT_OTP_LENGTH and OTP_EXPIRY_MINUTES are positive', () => {
    expect(DEFAULT_OTP_LENGTH).toBeGreaterThan(0);
    expect(OTP_EXPIRY_MINUTES).toBeGreaterThan(0);
  });

  it('MAX_FILE_SIZE_BYTES equals MAX_FILE_SIZE_MB * 1024 * 1024', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(MAX_FILE_SIZE_MB * 1024 * 1024);
  });

  it('field dimension defaults are positive', () => {
    expect(DEFAULT_FIELD_WIDTH).toBeGreaterThan(0);
    expect(DEFAULT_FIELD_HEIGHT).toBeGreaterThan(0);
    expect(DEFAULT_SIGNATURE_HEIGHT).toBeGreaterThan(DEFAULT_FIELD_HEIGHT);
    expect(DEFAULT_CHECKBOX_SIZE).toBeGreaterThan(0);
  });

  it('QUERY_GC_TIME > QUERY_STALE_TIME', () => {
    expect(QUERY_GC_TIME).toBeGreaterThan(QUERY_STALE_TIME);
  });

  it('EXPIRING_SOON_DAYS is a positive integer', () => {
    expect(EXPIRING_SOON_DAYS).toBeGreaterThan(0);
    expect(Number.isInteger(EXPIRING_SOON_DAYS)).toBe(true);
  });

  it('MAX_SIGNERS_PER_ENVELOPE and MAX_FIELDS_PER_ENVELOPE are positive', () => {
    expect(MAX_SIGNERS_PER_ENVELOPE).toBeGreaterThan(0);
    expect(MAX_FIELDS_PER_ENVELOPE).toBeGreaterThan(MAX_SIGNERS_PER_ENVELOPE);
  });
});

describe('ALLOWED_FILE_TYPES', () => {
  it('contains application/pdf', () => {
    expect(Array.from(ALLOWED_FILE_TYPES)).toContain('application/pdf');
  });
});

describe('DEFAULT_FILTERS', () => {
  it('has status array and empty search string', () => {
    expect(Array.isArray(DEFAULT_FILTERS.status)).toBe(true);
    expect(DEFAULT_FILTERS.search).toBe('');
  });
});

describe('SIGNER_ROLES', () => {
  it('is a non-empty array with value and label fields', () => {
    expect(SIGNER_ROLES.length).toBeGreaterThan(0);
    SIGNER_ROLES.forEach((role) => {
      expect(role.value.length).toBeGreaterThan(0);
      expect(role.label.length).toBeGreaterThan(0);
    });
  });

  it('contains financial_adviser and witness roles', () => {
    const values = SIGNER_ROLES.map((r) => r.value);
    expect(values).toContain('financial_adviser');
    expect(values).toContain('witness');
  });
});

describe('SIGNER_COLORS', () => {
  it('is a non-empty array with bg, text, border, and hex fields', () => {
    expect(SIGNER_COLORS.length).toBeGreaterThan(0);
    SIGNER_COLORS.forEach((color) => {
      expect(color.bg.length).toBeGreaterThan(0);
      expect(color.text.length).toBeGreaterThan(0);
      expect(color.border.length).toBeGreaterThan(0);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('CURRENT_MAX_SIGNERS', () => {
  it('is a positive integer not exceeding MAX_SIGNERS_PER_ENVELOPE', () => {
    expect(CURRENT_MAX_SIGNERS).toBeGreaterThan(0);
    expect(CURRENT_MAX_SIGNERS).toBeLessThanOrEqual(MAX_SIGNERS_PER_ENVELOPE);
  });
});

describe('UI message constants', () => {
  it('SUCCESS_MESSAGES is non-empty with string values', () => {
    expect(Object.keys(SUCCESS_MESSAGES).length).toBeGreaterThan(0);
    Object.values(SUCCESS_MESSAGES).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('ERROR_MESSAGES is non-empty with string values', () => {
    expect(Object.keys(ERROR_MESSAGES).length).toBeGreaterThan(0);
    Object.values(ERROR_MESSAGES).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('INFO_MESSAGES is non-empty', () => {
    expect(Object.keys(INFO_MESSAGES).length).toBeGreaterThan(0);
  });
});

describe('validation constants', () => {
  it('EMAIL_REGEX matches a valid email and rejects an invalid one', () => {
    expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
    expect(EMAIL_REGEX.test('not-an-email')).toBe(false);
  });

  it('MAX_TITLE_LENGTH > MIN_TITLE_LENGTH', () => {
    expect(MAX_TITLE_LENGTH).toBeGreaterThan(MIN_TITLE_LENGTH);
  });

  it('MAX_MESSAGE_LENGTH > MAX_TITLE_LENGTH', () => {
    expect(MAX_MESSAGE_LENGTH).toBeGreaterThan(MAX_TITLE_LENGTH);
  });

  it('MAX_REJECTION_REASON_LENGTH is a positive integer', () => {
    expect(MAX_REJECTION_REASON_LENGTH).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_REJECTION_REASON_LENGTH)).toBe(true);
  });
});
