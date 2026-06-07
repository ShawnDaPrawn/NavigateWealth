import { describe, it, expect } from 'vitest';
import {
  LIFE_COVER,
  DISABILITY_COVER,
  SEVERE_ILLNESS_COVER,
  INCOME_PROTECTION,
  OVERRIDE_CLASSIFICATIONS,
  COMPLIANCE_DISCLAIMERS,
  SYSTEM_VERSION,
  DEFAULT_FORM_VALUES,
  EMPLOYMENT_TYPE_LABELS,
  RELATIONSHIP_OPTIONS,
  VALIDATION_RULES,
  WIZARD_STEPS,
  QUERY_KEYS,
} from '../constants';

describe('LIFE_COVER', () => {
  it('has FUNERAL_FINAL_EXPENSES and ESTATE_COSTS_PERCENTAGE', () => {
    expect(LIFE_COVER.FUNERAL_FINAL_EXPENSES).toBeGreaterThan(0);
    expect(LIFE_COVER.ESTATE_COSTS_PERCENTAGE).toBeGreaterThan(0);
  });

  it('MULTIPLES has values for all household types', () => {
    expect(LIFE_COVER.MULTIPLES.SINGLE_NO_DEPENDANTS).toBeGreaterThan(0);
    expect(LIFE_COVER.MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE).toBeGreaterThan(0);
    expect(LIFE_COVER.MULTIPLES.SINGLE_INCOME_HOUSEHOLD_BASE).toBeGreaterThan(0);
    expect(LIFE_COVER.MULTIPLES.ADDITIONAL_PER_DEPENDANT).toBe(1);
  });

  it('single-income household base > married with young children > single no dependants', () => {
    expect(LIFE_COVER.MULTIPLES.SINGLE_INCOME_HOUSEHOLD_BASE).toBeGreaterThan(
      LIFE_COVER.MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE,
    );
    expect(LIFE_COVER.MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE).toBeGreaterThan(
      LIFE_COVER.MULTIPLES.SINGLE_NO_DEPENDANTS,
    );
  });
});

describe('DISABILITY_COVER', () => {
  it('has VEHICLE_ADAPTATION, MEDICAL_EQUIPMENT, ONCE_OFF_CARE_COSTS defaults', () => {
    expect(DISABILITY_COVER.VEHICLE_ADAPTATION).toBeGreaterThan(0);
    expect(DISABILITY_COVER.MEDICAL_EQUIPMENT).toBeGreaterThan(0);
    expect(DISABILITY_COVER.ONCE_OFF_CARE_COSTS).toBeGreaterThan(0);
  });

  it('MULTIPLES increase with number of dependants', () => {
    expect(DISABILITY_COVER.MULTIPLES.TWO_TO_FOUR_DEPENDANTS).toBeGreaterThan(
      DISABILITY_COVER.MULTIPLES.ONE_DEPENDANT,
    );
    expect(DISABILITY_COVER.MULTIPLES.FIVE_PLUS_DEPENDANTS).toBeGreaterThan(
      DISABILITY_COVER.MULTIPLES.TWO_TO_FOUR_DEPENDANTS,
    );
  });
});

describe('SEVERE_ILLNESS_COVER', () => {
  it('BANDS is a non-empty array with income ranges and multiples', () => {
    expect(SEVERE_ILLNESS_COVER.BANDS.length).toBeGreaterThan(0);
    SEVERE_ILLNESS_COVER.BANDS.forEach((band) => {
      expect(band.multiple).toBeGreaterThan(0);
      expect(band.label.length).toBeGreaterThan(0);
    });
  });

  it('higher income bands have higher multiples', () => {
    const multiples = [...SEVERE_ILLNESS_COVER.BANDS].map((b) => b.multiple);
    for (let i = 1; i < multiples.length; i++) {
      expect(multiples[i]).toBeGreaterThanOrEqual(multiples[i - 1]);
    }
  });
});

describe('INCOME_PROTECTION', () => {
  it('has NET_INCOME_PERCENTAGE of 1.0 (100%)', () => {
    expect(INCOME_PROTECTION.NET_INCOME_PERCENTAGE).toBe(1.0);
  });

  it('DEFAULT_INSURABLE_MAXIMUM_MONTHLY is a positive number', () => {
    expect(INCOME_PROTECTION.DEFAULT_INSURABLE_MAXIMUM_MONTHLY).toBeGreaterThan(0);
  });

  it('BENEFIT_PERIODS is a non-empty array with value and label', () => {
    expect(INCOME_PROTECTION.BENEFIT_PERIODS.length).toBeGreaterThan(0);
    INCOME_PROTECTION.BENEFIT_PERIODS.forEach((bp) => {
      expect(bp.value.length).toBeGreaterThan(0);
      expect(bp.label.length).toBeGreaterThan(0);
    });
  });

  it('ESCALATION_OPTIONS includes cpi-linked', () => {
    const values = INCOME_PROTECTION.ESCALATION_OPTIONS.map((o) => o.value);
    expect(values).toContain('cpi-linked');
  });
});

describe('OVERRIDE_CLASSIFICATIONS', () => {
  it('is a non-empty array of strings', () => {
    expect(OVERRIDE_CLASSIFICATIONS.length).toBeGreaterThan(0);
    OVERRIDE_CLASSIFICATIONS.forEach((cls) => expect(typeof cls).toBe('string'));
  });

  it('includes Affordability Constraint and Other', () => {
    expect(OVERRIDE_CLASSIFICATIONS).toContain('Affordability Constraint');
    expect(OVERRIDE_CLASSIFICATIONS).toContain('Other');
  });
});

describe('COMPLIANCE_DISCLAIMERS', () => {
  it('is a non-empty array of strings', () => {
    expect(COMPLIANCE_DISCLAIMERS.length).toBeGreaterThan(0);
    COMPLIANCE_DISCLAIMERS.forEach((d) => expect(typeof d).toBe('string'));
  });
});

describe('SYSTEM_VERSION', () => {
  it('is a non-empty version string', () => {
    expect(typeof SYSTEM_VERSION).toBe('string');
    expect(SYSTEM_VERSION.length).toBeGreaterThan(0);
  });
});

describe('DEFAULT_FORM_VALUES', () => {
  it('has retirementAge defaulting to 65', () => {
    expect(DEFAULT_FORM_VALUES.retirementAge).toBe('65');
  });

  it('has incomeEscalationAssumption defaulting to 6', () => {
    expect(DEFAULT_FORM_VALUES.incomeEscalationAssumption).toBe('6');
  });

  it('all existing cover fields default to 0', () => {
    expect(DEFAULT_FORM_VALUES.existingCoverLifePersonal).toBe('0');
    expect(DEFAULT_FORM_VALUES.existingCoverDisabilityPersonal).toBe('0');
    expect(DEFAULT_FORM_VALUES.existingCoverSevereIllnessPersonal).toBe('0');
  });

  it('ipPermanentEscalation defaults to cpi-linked', () => {
    expect(DEFAULT_FORM_VALUES.ipPermanentEscalation).toBe('cpi-linked');
  });
});

describe('EMPLOYMENT_TYPE_LABELS', () => {
  it('has employed and self-employed labels', () => {
    expect(EMPLOYMENT_TYPE_LABELS.employed).toBe('Employed');
    expect(EMPLOYMENT_TYPE_LABELS['self-employed']).toBe('Self-Employed');
  });
});

describe('RELATIONSHIP_OPTIONS', () => {
  it('is a non-empty array containing Child, Spouse, and Other', () => {
    expect(RELATIONSHIP_OPTIONS.length).toBeGreaterThan(0);
    expect(RELATIONSHIP_OPTIONS).toContain('Child');
    expect(RELATIONSHIP_OPTIONS).toContain('Spouse');
    expect(RELATIONSHIP_OPTIONS).toContain('Other');
  });
});

describe('VALIDATION_RULES', () => {
  it('MIN_AGE < MAX_AGE and MIN_RETIREMENT_AGE < MAX_RETIREMENT_AGE', () => {
    expect(VALIDATION_RULES.MIN_AGE).toBeLessThan(VALIDATION_RULES.MAX_AGE);
    expect(VALIDATION_RULES.MIN_RETIREMENT_AGE).toBeLessThan(VALIDATION_RULES.MAX_RETIREMENT_AGE);
  });

  it('MAX_INCOME_ESCALATION is 100 (percentage ceiling)', () => {
    expect(VALIDATION_RULES.MAX_INCOME_ESCALATION).toBe(100);
  });
});

describe('WIZARD_STEPS', () => {
  it('has 4 steps in sequential order', () => {
    expect(WIZARD_STEPS.length).toBe(4);
    WIZARD_STEPS.forEach((s, i) => {
      expect(s.step).toBe(i + 1);
      expect(s.title.length).toBeGreaterThan(0);
    });
  });
});

describe('QUERY_KEYS', () => {
  it('CLIENT_KEYS returns an array containing the clientId', () => {
    const keys = QUERY_KEYS.CLIENT_KEYS('client-1');
    expect(Array.isArray(keys)).toBe(true);
    expect(keys).toContain('client-1');
  });

  it('FNA_DETAIL returns an array containing the fna id', () => {
    const keys = QUERY_KEYS.FNA_DETAIL('fna-42');
    expect(keys).toContain('fna-42');
  });

  it('FNA_ALL is a static array', () => {
    expect(Array.isArray(QUERY_KEYS.FNA_ALL)).toBe(true);
  });
});
