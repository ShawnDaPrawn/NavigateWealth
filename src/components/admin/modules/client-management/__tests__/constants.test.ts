import { describe, it, expect } from 'vitest';
import {
  ENDPOINTS,
  CONFIG,
  PERSONNEL_ROLES,
  ACCOUNT_STATUS_CONFIG,
  ACCOUNT_STATUS_FILTER_OPTIONS,
  HEALTH_SUB_SCORE_CONFIG,
  KPI_DEFINITIONS,
  KPI_STATUS_CONFIG,
} from '../constants';

describe('client-management ENDPOINTS', () => {
  it('has static string endpoints', () => {
    expect(typeof ENDPOINTS.ALL_USERS).toBe('string');
    expect(typeof ENDPOINTS.PERSONAL_INFO).toBe('string');
  });

  it('USER_METADATA returns a URL containing the userId', () => {
    expect(ENDPOINTS.USER_METADATA('user-123')).toContain('user-123');
  });
});

describe('CONFIG', () => {
  it('has SUPER_ADMIN_EMAIL defined', () => {
    expect(CONFIG.SUPER_ADMIN_EMAIL).toBeDefined();
  });
});

describe('PERSONNEL_ROLES', () => {
  it('is a non-empty array', () => {
    expect(PERSONNEL_ROLES.length).toBeGreaterThan(0);
  });

  it('includes super_admin, admin, adviser, and compliance', () => {
    expect(PERSONNEL_ROLES).toContain('super_admin');
    expect(PERSONNEL_ROLES).toContain('admin');
    expect(PERSONNEL_ROLES).toContain('adviser');
    expect(PERSONNEL_ROLES).toContain('compliance');
  });
});

describe('ACCOUNT_STATUS_CONFIG', () => {
  it('covers active, suspended, and closed statuses', () => {
    expect(ACCOUNT_STATUS_CONFIG.active).toBeDefined();
    expect(ACCOUNT_STATUS_CONFIG.suspended).toBeDefined();
    expect(ACCOUNT_STATUS_CONFIG.closed).toBeDefined();
  });

  it('active has green badge, closed has red badge', () => {
    expect(ACCOUNT_STATUS_CONFIG.active.badgeClass).toContain('green');
    expect(ACCOUNT_STATUS_CONFIG.closed.badgeClass).toContain('red');
  });

  it('every status has label, badgeClass, and dotClass', () => {
    Object.values(ACCOUNT_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
    });
  });
});

describe('ACCOUNT_STATUS_FILTER_OPTIONS', () => {
  it('has an "all" option and status-specific options', () => {
    const values = ACCOUNT_STATUS_FILTER_OPTIONS.map((o) => o.value);
    expect(values).toContain('all');
    expect(values).toContain('active');
    expect(values).toContain('suspended');
  });
});

describe('HEALTH_SUB_SCORE_CONFIG', () => {
  it('covers all 5 pillars: risk, medicalAid, retirement, investments, estatePlanning', () => {
    expect(HEALTH_SUB_SCORE_CONFIG.risk).toBeDefined();
    expect(HEALTH_SUB_SCORE_CONFIG.medicalAid).toBeDefined();
    expect(HEALTH_SUB_SCORE_CONFIG.retirement).toBeDefined();
    expect(HEALTH_SUB_SCORE_CONFIG.investments).toBeDefined();
    expect(HEALTH_SUB_SCORE_CONFIG.estatePlanning).toBeDefined();
  });

  it('every pillar has label, description, color, bgClass, and textClass', () => {
    Object.values(HEALTH_SUB_SCORE_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.description.length).toBeGreaterThan(0);
      expect(cfg.color.length).toBeGreaterThan(0);
      expect(cfg.bgClass.length).toBeGreaterThan(0);
      expect(cfg.textClass.length).toBeGreaterThan(0);
    });
  });
});

describe('KPI_DEFINITIONS', () => {
  it('is a non-empty array', () => {
    expect(KPI_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('every KPI has id, label, description, format, targetText, and iconSlug', () => {
    KPI_DEFINITIONS.forEach((kpi) => {
      expect(kpi.id.length).toBeGreaterThan(0);
      expect(kpi.label.length).toBeGreaterThan(0);
      expect(kpi.description.length).toBeGreaterThan(0);
      expect(['currency', 'percentage', 'months', 'ratio']).toContain(kpi.format);
      expect(kpi.targetText.length).toBeGreaterThan(0);
      expect(kpi.iconSlug.length).toBeGreaterThan(0);
    });
  });

  it('contains net_worth, dti, and retirement_progress KPIs', () => {
    const ids = KPI_DEFINITIONS.map((k) => k.id);
    expect(ids).toContain('net_worth');
    expect(ids).toContain('dti');
    expect(ids).toContain('retirement_progress');
  });
});

describe('KPI_STATUS_CONFIG', () => {
  it('covers good, caution, gap, and no-data statuses', () => {
    expect(KPI_STATUS_CONFIG.good).toBeDefined();
    expect(KPI_STATUS_CONFIG.caution).toBeDefined();
    expect(KPI_STATUS_CONFIG.gap).toBeDefined();
    expect(KPI_STATUS_CONFIG['no-data']).toBeDefined();
  });

  it('good has green styling, gap has red styling', () => {
    expect(KPI_STATUS_CONFIG.good.badgeClass).toContain('green');
    expect(KPI_STATUS_CONFIG.gap.badgeClass).toContain('red');
  });

  it('every status has label, badgeClass, dotClass, and textClass', () => {
    Object.values(KPI_STATUS_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
      expect(cfg.textClass.length).toBeGreaterThan(0);
    });
  });
});
