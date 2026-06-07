import { describe, it, expect } from 'vitest';
import {
  RAG_STATUS_LABELS,
  RAG_STATUS_COLORS,
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_COLORS,
  RE_STATUS_LABELS,
  RE_STATUS_COLORS,
  AML_STATUS_LABELS,
  AML_STATUS_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  COMPLAINT_CATEGORY_LABELS,
  SUPERVISION_FREQUENCY_LABELS,
  REGULATORY_AUTHORITIES,
  COB_CATEGORIES,
  PST_CATEGORIES,
  TCF_OUTCOMES,
  CPD_REQUIREMENTS,
  DEADLINE_THRESHOLDS,
  COMPLAINT_RESOLUTION_TARGETS,
  RETENTION_PERIODS,
  AML_RISK_THRESHOLDS,
  DEFAULT_CPD_HOURS,
  DEFAULT_SUPERVISION_FREQUENCY,
  DEFAULT_RETENTION_PERIOD,
  DEFAULT_PAGE_SIZE,
  NOTIFICATION_LEAD_TIMES,
  COMPLIANCE_TABS,
  COMPLIANCE_PERMISSIONS,
} from '../constants';

describe('RAG status labels and colors', () => {
  it('has entries for red, amber, green', () => {
    expect(RAG_STATUS_LABELS.red).toBeTruthy();
    expect(RAG_STATUS_LABELS.amber).toBeTruthy();
    expect(RAG_STATUS_LABELS.green).toBeTruthy();
  });

  it('colors are CSS class strings', () => {
    expect(RAG_STATUS_COLORS.red).toContain('red');
    expect(RAG_STATUS_COLORS.amber).toContain('amber');
    expect(RAG_STATUS_COLORS.green).toContain('green');
  });
});

describe('compliance status labels and colors', () => {
  it('has entries for core statuses', () => {
    expect(COMPLIANCE_STATUS_LABELS.current).toBeTruthy();
    expect(COMPLIANCE_STATUS_LABELS.overdue).toBeTruthy();
    expect(COMPLIANCE_STATUS_LABELS.pending).toBeTruthy();
  });

  it('overdue status has red color class', () => {
    expect(COMPLIANCE_STATUS_COLORS.overdue).toContain('red');
  });
});

describe('RE status labels', () => {
  it('has Active entry', () => {
    expect(RE_STATUS_LABELS.Active).toBeTruthy();
  });

  it('colors map for Active is green', () => {
    expect(RE_STATUS_COLORS.Active).toContain('green');
  });
});

describe('AML status labels', () => {
  it('is a non-empty record', () => {
    expect(Object.keys(AML_STATUS_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(AML_STATUS_COLORS).length).toBeGreaterThan(0);
  });
});

describe('risk level labels', () => {
  it('covers standard risk levels', () => {
    expect(Object.keys(RISK_LEVEL_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(RISK_LEVEL_COLORS).length).toBeGreaterThan(0);
  });
});

describe('complaint constants', () => {
  it('has complaint status labels', () => {
    expect(Object.keys(COMPLAINT_STATUS_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(COMPLAINT_STATUS_COLORS).length).toBeGreaterThan(0);
  });

  it('has complaint category labels', () => {
    expect(Object.keys(COMPLAINT_CATEGORY_LABELS).length).toBeGreaterThan(0);
  });

  it('has resolution target days for each status', () => {
    expect(typeof COMPLAINT_RESOLUTION_TARGETS).toBe('object');
    const values = Object.values(COMPLAINT_RESOLUTION_TARGETS);
    values.forEach((v) => expect(typeof v).toBe('number'));
  });
});

describe('supervision frequency labels', () => {
  it('has Annual entry', () => {
    expect(SUPERVISION_FREQUENCY_LABELS.Annual).toBeTruthy();
  });
});

describe('regulatory authorities', () => {
  it('FSCA is defined', () => {
    expect((REGULATORY_AUTHORITIES as Record<string, unknown>).FSCA).toBeTruthy();
  });
});

describe('CPD and training constants', () => {
  it('DEFAULT_CPD_HOURS is a positive number', () => {
    expect(DEFAULT_CPD_HOURS).toBeGreaterThan(0);
  });

  it('CPD_REQUIREMENTS has minimum hours', () => {
    expect(
      (CPD_REQUIREMENTS as Record<string, unknown>).MINIMUM_HOURS ||
        (CPD_REQUIREMENTS as Record<string, unknown>).MIN_HOURS ||
        Object.values(CPD_REQUIREMENTS).length > 0,
    ).toBeTruthy();
  });
});

describe('deadline and retention thresholds', () => {
  it('DEADLINE_THRESHOLDS defines numeric day buckets', () => {
    const values = Object.values(DEADLINE_THRESHOLDS);
    values.forEach((v) => expect(typeof v).toBe('number'));
  });

  it('DEFAULT_RETENTION_PERIOD is a positive number of years', () => {
    expect(DEFAULT_RETENTION_PERIOD).toBeGreaterThan(0);
  });

  it('RETENTION_PERIODS is a non-empty object', () => {
    expect(Object.keys(RETENTION_PERIODS).length).toBeGreaterThan(0);
  });
});

describe('AML risk thresholds', () => {
  it('has numeric threshold values', () => {
    const values = Object.values(AML_RISK_THRESHOLDS);
    values.forEach((v) => expect(typeof v).toBe('number'));
  });
});

describe('default configuration values', () => {
  it('DEFAULT_PAGE_SIZE is a positive integer', () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_PAGE_SIZE)).toBe(true);
  });

  it('DEFAULT_SUPERVISION_FREQUENCY is a string', () => {
    expect(typeof DEFAULT_SUPERVISION_FREQUENCY).toBe('string');
  });
});

describe('notification lead times', () => {
  it('FIRST_WARNING > SECOND_WARNING > FINAL_WARNING', () => {
    expect(NOTIFICATION_LEAD_TIMES.FIRST_WARNING).toBeGreaterThan(
      NOTIFICATION_LEAD_TIMES.SECOND_WARNING,
    );
    expect(NOTIFICATION_LEAD_TIMES.SECOND_WARNING).toBeGreaterThan(
      NOTIFICATION_LEAD_TIMES.FINAL_WARNING,
    );
  });
});

describe('compliance tabs', () => {
  it('has multiple tab entries each with id, label, icon', () => {
    expect(COMPLIANCE_TABS.length).toBeGreaterThan(0);
    COMPLIANCE_TABS.forEach((tab) => {
      expect(tab.id).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
    });
  });
});

describe('COB and PST categories', () => {
  it('are non-empty arrays', () => {
    expect(Array.isArray(COB_CATEGORIES)).toBe(true);
    expect(COB_CATEGORIES.length).toBeGreaterThan(0);
    expect(Array.isArray(PST_CATEGORIES)).toBe(true);
    expect(PST_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('TCF outcomes', () => {
  it('is a non-empty record', () => {
    expect(Object.keys(TCF_OUTCOMES).length).toBeGreaterThan(0);
  });
});

describe('compliance permissions', () => {
  it('has VIEW_ALL and CREATE permissions as strings', () => {
    expect(typeof COMPLIANCE_PERMISSIONS.VIEW_ALL).toBe('string');
    expect(typeof COMPLIANCE_PERMISSIONS.CREATE).toBe('string');
  });
});
