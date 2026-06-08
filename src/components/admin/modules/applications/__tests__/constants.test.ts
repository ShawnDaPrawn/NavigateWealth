import { describe, it, expect } from 'vitest';
import {
  ENDPOINTS,
  STATUS_MAP,
  APPLICATION_PROFILE_FIELD_MAP,
  SYNCED_FIELDS,
  FIELD_MAP_BY_SECTION,
  EXTERNAL_PRODUCT_CATEGORIES,
  PRODUCT_LABEL_MAP,
  SA_FINANCIAL_PROVIDERS,
  SA_PROVIDER_MAP,
  SECTION_LABELS,
} from '../constants';

describe('applications ENDPOINTS', () => {
  it('has static string endpoints', () => {
    expect(typeof ENDPOINTS.APPLICATIONS).toBe('string');
    expect(typeof ENDPOINTS.STATS).toBe('string');
    expect(typeof ENDPOINTS.INVITE).toBe('string');
  });

  it('APPLICATION_DETAIL returns a URL containing the id', () => {
    expect(ENDPOINTS.APPLICATION_DETAIL('abc123')).toContain('abc123');
  });

  it('APPROVE and DECLINE return URLs with /approve and /decline suffixes', () => {
    expect(ENDPOINTS.APPROVE('xyz')).toContain('/approve');
    expect(ENDPOINTS.DECLINE('xyz')).toContain('/decline');
  });
});

describe('STATUS_MAP', () => {
  it('maps pending, approved, rejected, invited, and incomplete statuses', () => {
    expect(STATUS_MAP.pending).toBeTruthy();
    expect(STATUS_MAP.approved).toBeTruthy();
    expect(STATUS_MAP.rejected).toBeTruthy();
    expect(STATUS_MAP.invited).toBeTruthy();
    expect(STATUS_MAP.incomplete).toBeTruthy();
  });
});

describe('APPLICATION_PROFILE_FIELD_MAP', () => {
  it('is a non-empty array', () => {
    expect(APPLICATION_PROFILE_FIELD_MAP.length).toBeGreaterThan(0);
  });

  it('every entry has applicationField, profileField, label, and section', () => {
    APPLICATION_PROFILE_FIELD_MAP.forEach((m) => {
      expect(m.applicationField.length).toBeGreaterThan(0);
      expect(m.profileField.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.section.length).toBeGreaterThan(0);
    });
  });

  it('covers personal, contact, address, and employment sections', () => {
    const sections = new Set(APPLICATION_PROFILE_FIELD_MAP.map((m) => m.section));
    expect(sections.has('personal')).toBe(true);
    expect(sections.has('contact')).toBe(true);
    expect(sections.has('address')).toBe(true);
    expect(sections.has('employment')).toBe(true);
  });

  it('includes firstName and emailAddress mappings', () => {
    const appFields = APPLICATION_PROFILE_FIELD_MAP.map((m) => m.applicationField);
    expect(appFields).toContain('firstName');
    expect(appFields).toContain('emailAddress');
  });
});

describe('SYNCED_FIELDS', () => {
  it('is a Set containing all applicationField values from the map', () => {
    expect(SYNCED_FIELDS instanceof Set).toBe(true);
    expect(SYNCED_FIELDS.has('firstName')).toBe(true);
    expect(SYNCED_FIELDS.has('emailAddress')).toBe(true);
  });

  it('does not contain fields not in the map', () => {
    expect(SYNCED_FIELDS.has('nonExistentField')).toBe(false);
  });
});

describe('FIELD_MAP_BY_SECTION', () => {
  it('is an object with section keys', () => {
    expect(typeof FIELD_MAP_BY_SECTION).toBe('object');
    expect(FIELD_MAP_BY_SECTION.personal).toBeDefined();
    expect(Array.isArray(FIELD_MAP_BY_SECTION.personal)).toBe(true);
  });

  it('personal section contains firstName mapping', () => {
    const personalFields = FIELD_MAP_BY_SECTION.personal.map((m) => m.applicationField);
    expect(personalFields).toContain('firstName');
  });
});

describe('EXTERNAL_PRODUCT_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(EXTERNAL_PRODUCT_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('every category has id, label, icon, and description', () => {
    EXTERNAL_PRODUCT_CATEGORIES.forEach((cat) => {
      expect(cat.id.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.icon.length).toBeGreaterThan(0);
      expect(cat.description.length).toBeGreaterThan(0);
    });
  });

  it('contains life_insurance and medical_aid categories', () => {
    const ids = EXTERNAL_PRODUCT_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('life_insurance');
    expect(ids).toContain('medical_aid');
  });
});

describe('PRODUCT_LABEL_MAP', () => {
  it('is a non-empty object mapping label strings to category IDs', () => {
    expect(Object.keys(PRODUCT_LABEL_MAP).length).toBeGreaterThan(0);
  });

  it('Life Insurance maps to life_insurance', () => {
    expect(PRODUCT_LABEL_MAP['Life Insurance']).toBe('life_insurance');
  });

  it('Medical Aid maps to medical_aid', () => {
    expect(PRODUCT_LABEL_MAP['Medical Aid']).toBe('medical_aid');
  });
});

describe('SA_FINANCIAL_PROVIDERS', () => {
  it('is a non-empty array with id, name, and category fields', () => {
    expect(SA_FINANCIAL_PROVIDERS.length).toBeGreaterThan(0);
    SA_FINANCIAL_PROVIDERS.forEach((p) => {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.category.length).toBeGreaterThan(0);
    });
  });

  it('contains old_mutual, discovery, and sanlam providers', () => {
    const ids = SA_FINANCIAL_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('old_mutual');
    expect(ids).toContain('discovery');
    expect(ids).toContain('sanlam');
  });
});

describe('SA_PROVIDER_MAP', () => {
  it('is derived from SA_FINANCIAL_PROVIDERS with all provider IDs', () => {
    SA_FINANCIAL_PROVIDERS.forEach((p) => {
      expect(SA_PROVIDER_MAP[p.id]).toBeDefined();
      expect(SA_PROVIDER_MAP[p.id].name).toBe(p.name);
    });
  });
});

describe('SECTION_LABELS', () => {
  it('has string labels for personal, identification, contact, address, employment', () => {
    expect(typeof SECTION_LABELS.personal).toBe('string');
    expect(typeof SECTION_LABELS.identification).toBe('string');
    expect(typeof SECTION_LABELS.contact).toBe('string');
    expect(typeof SECTION_LABELS.address).toBe('string');
    expect(typeof SECTION_LABELS.employment).toBe('string');
  });
});
