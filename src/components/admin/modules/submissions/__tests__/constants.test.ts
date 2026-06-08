import { describe, it, expect } from 'vitest';
import {
  SITE_BASE_URL,
  SUBMISSION_STATUS_CONFIG,
  SUBMISSION_TYPE_CONFIG,
  SOURCE_CHANNEL_LABELS,
  SUBMISSION_COLUMNS,
  BOARD_COLUMNS,
  SUBMISSION_INVITE_TYPES,
} from '../constants';

describe('SITE_BASE_URL', () => {
  it('is a defined string', () => {
    expect(typeof SITE_BASE_URL).toBe('string');
  });
});

describe('SUBMISSION_STATUS_CONFIG', () => {
  it('covers new, pending, completed, and archived statuses', () => {
    expect(SUBMISSION_STATUS_CONFIG.new).toBeDefined();
    expect(SUBMISSION_STATUS_CONFIG.pending).toBeDefined();
    expect(SUBMISSION_STATUS_CONFIG.completed).toBeDefined();
    expect(SUBMISSION_STATUS_CONFIG.archived).toBeDefined();
  });

  it('every status has label, badgeClass, dotClass, and columnHeaderClass', () => {
    Object.values(SUBMISSION_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
      expect(cfg.columnHeaderClass.length).toBeGreaterThan(0);
    });
  });

  it('new has blue badge, completed has green badge, archived has gray badge', () => {
    expect(SUBMISSION_STATUS_CONFIG.new.badgeClass).toContain('blue');
    expect(SUBMISSION_STATUS_CONFIG.completed.badgeClass).toContain('green');
    expect(SUBMISSION_STATUS_CONFIG.archived.badgeClass).toContain('gray');
  });
});

describe('SUBMISSION_TYPE_CONFIG', () => {
  it('covers quote, will_draft, tax_planning, consultation, contact, client_signup, change_request', () => {
    expect(SUBMISSION_TYPE_CONFIG.quote).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.will_draft).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.tax_planning).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.consultation).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.contact).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.client_signup).toBeDefined();
    expect(SUBMISSION_TYPE_CONFIG.change_request).toBeDefined();
  });

  it('every type has label, shortLabel, and iconName', () => {
    Object.values(SUBMISSION_TYPE_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.shortLabel.length).toBeGreaterThan(0);
      expect(cfg.iconName.length).toBeGreaterThan(0);
    });
  });
});

describe('SOURCE_CHANNEL_LABELS', () => {
  it('is a non-empty object with string values', () => {
    expect(Object.keys(SOURCE_CHANNEL_LABELS).length).toBeGreaterThan(0);
    Object.values(SOURCE_CHANNEL_LABELS).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('contains website_form, admin, and client_portal channels', () => {
    expect(SOURCE_CHANNEL_LABELS.website_form).toBeTruthy();
    expect(SOURCE_CHANNEL_LABELS.admin).toBeTruthy();
    expect(SOURCE_CHANNEL_LABELS.client_portal).toBeTruthy();
  });
});

describe('SUBMISSION_COLUMNS', () => {
  it('has columns for new, pending, completed, and archived', () => {
    const ids = SUBMISSION_COLUMNS.map((c) => c.id);
    expect(ids).toContain('new');
    expect(ids).toContain('pending');
    expect(ids).toContain('completed');
    expect(ids).toContain('archived');
  });

  it('every column has id, label, and description', () => {
    SUBMISSION_COLUMNS.forEach((col) => {
      expect(col.id.length).toBeGreaterThan(0);
      expect(col.label.length).toBeGreaterThan(0);
      expect(col.description.length).toBeGreaterThan(0);
    });
  });
});

describe('BOARD_COLUMNS', () => {
  it('excludes archived column (board view only shows active columns)', () => {
    const ids = BOARD_COLUMNS.map((c) => c.id);
    expect(ids).not.toContain('archived');
    expect(ids).toContain('new');
    expect(ids).toContain('pending');
    expect(ids).toContain('completed');
  });

  it('has fewer columns than SUBMISSION_COLUMNS', () => {
    expect(BOARD_COLUMNS.length).toBeLessThan(SUBMISSION_COLUMNS.length);
  });
});

describe('SUBMISSION_INVITE_TYPES', () => {
  it('is a non-empty array', () => {
    expect(SUBMISSION_INVITE_TYPES.length).toBeGreaterThan(0);
  });

  it('every invite type has required fields', () => {
    SUBMISSION_INVITE_TYPES.forEach((invite) => {
      expect(invite.id.length).toBeGreaterThan(0);
      expect(invite.label.length).toBeGreaterThan(0);
      expect(invite.description.length).toBeGreaterThan(0);
      expect(invite.path.length).toBeGreaterThan(0);
      expect(invite.emailSubject.length).toBeGreaterThan(0);
      expect(invite.emailButtonLabel.length).toBeGreaterThan(0);
    });
  });

  it('contains get-quote and schedule-consultation invite types', () => {
    const ids = SUBMISSION_INVITE_TYPES.map((t) => t.id);
    expect(ids).toContain('get-quote');
    expect(ids).toContain('schedule-consultation');
  });

  it('every invite type has accent and icon color classes', () => {
    SUBMISSION_INVITE_TYPES.forEach((invite) => {
      expect(invite.accentClass.length).toBeGreaterThan(0);
      expect(invite.iconBgClass.length).toBeGreaterThan(0);
      expect(invite.iconTextClass.length).toBeGreaterThan(0);
    });
  });
});
