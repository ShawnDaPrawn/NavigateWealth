import { describe, it, expect } from 'vitest';
import {
  STEPS,
  TITLES,
  GENDERS,
  MARITAL_STATUSES,
  MARITAL_REGIMES,
  PROVINCES,
  PREFERRED_CONTACT_METHODS,
  BEST_TIMES_TO_CONTACT,
  INDUSTRIES,
  INCOME_RANGES,
  EXPENSE_RANGES,
  ACCOUNT_REASON_OPTIONS,
  URGENCY_OPTIONS,
  EXISTING_PRODUCTS,
  INITIAL_DATA,
} from '../constants';

describe('onboarding STEPS', () => {
  it('has 5 steps numbered 1 through 5', () => {
    expect(STEPS.length).toBe(5);
    STEPS.forEach((step, i) => {
      expect(step.number).toBe(i + 1);
    });
  });

  it('every step has title, subtitle, and icon', () => {
    STEPS.forEach((step) => {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.subtitle.length).toBeGreaterThan(0);
      expect(step.icon).toBeDefined();
    });
  });
});

describe('onboarding personal data lists', () => {
  it('TITLES contains Mr, Mrs, Dr', () => {
    expect(TITLES).toContain('Mr');
    expect(TITLES).toContain('Mrs');
    expect(TITLES).toContain('Dr');
  });

  it('GENDERS is a non-empty array', () => {
    expect(GENDERS.length).toBeGreaterThan(0);
  });

  it('MARITAL_STATUSES covers Single, Married, Divorced', () => {
    expect(MARITAL_STATUSES).toContain('Single');
    expect(MARITAL_STATUSES).toContain('Married');
    expect(MARITAL_STATUSES).toContain('Divorced');
  });

  it('MARITAL_REGIMES has 3 regimes', () => {
    expect(MARITAL_REGIMES.length).toBe(3);
  });

  it('PROVINCES has all 9 South African provinces', () => {
    expect(PROVINCES.length).toBe(9);
    expect(PROVINCES).toContain('Gauteng');
    expect(PROVINCES).toContain('Western Cape');
    expect(PROVINCES).toContain('KwaZulu-Natal');
  });

  it('PREFERRED_CONTACT_METHODS includes Email and WhatsApp', () => {
    expect(PREFERRED_CONTACT_METHODS).toContain('Email');
    expect(PREFERRED_CONTACT_METHODS).toContain('WhatsApp');
  });

  it('BEST_TIMES_TO_CONTACT is a non-empty array', () => {
    expect(BEST_TIMES_TO_CONTACT.length).toBeGreaterThan(0);
  });
});

describe('INDUSTRIES', () => {
  it('is a large non-empty array', () => {
    expect(INDUSTRIES.length).toBeGreaterThan(50);
  });

  it('contains Financial Services, Healthcare & Medical, and Other', () => {
    expect(INDUSTRIES).toContain('Financial Services');
    expect(INDUSTRIES).toContain('Healthcare & Medical');
    expect(INDUSTRIES).toContain('Other');
  });
});

describe('financial range lists', () => {
  it('INCOME_RANGES is a non-empty array starting with "Prefer not to say"', () => {
    expect(INCOME_RANGES.length).toBeGreaterThan(0);
    expect(INCOME_RANGES[0]).toBe('Prefer not to say');
  });

  it('EXPENSE_RANGES is a non-empty array', () => {
    expect(EXPENSE_RANGES.length).toBeGreaterThan(0);
  });
});

describe('ACCOUNT_REASON_OPTIONS', () => {
  it('is a non-empty array', () => {
    expect(ACCOUNT_REASON_OPTIONS.length).toBeGreaterThan(0);
  });

  it('includes Investment Management, Medical Aid, and Other', () => {
    expect(ACCOUNT_REASON_OPTIONS).toContain('Investment Management');
    expect(ACCOUNT_REASON_OPTIONS).toContain('Medical Aid');
    expect(ACCOUNT_REASON_OPTIONS).toContain('Other');
  });
});

describe('URGENCY_OPTIONS', () => {
  it('has 4 options each with value, label, and description', () => {
    expect(URGENCY_OPTIONS.length).toBe(4);
    URGENCY_OPTIONS.forEach((opt) => {
      expect(opt.value.length).toBeGreaterThan(0);
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
    });
  });

  it('contains immediately and exploring options', () => {
    const values = URGENCY_OPTIONS.map((o) => o.value);
    expect(values).toContain('immediately');
    expect(values).toContain('exploring');
  });
});

describe('EXISTING_PRODUCTS', () => {
  it('is a non-empty array containing common financial products', () => {
    expect(EXISTING_PRODUCTS.length).toBeGreaterThan(0);
    expect(EXISTING_PRODUCTS).toContain('Life Insurance');
    expect(EXISTING_PRODUCTS).toContain('Medical Aid');
    expect(EXISTING_PRODUCTS).toContain('None of the above');
  });
});

describe('INITIAL_DATA', () => {
  it('is an object with firstName, lastName, and emailAddress fields', () => {
    expect(typeof INITIAL_DATA).toBe('object');
    expect(INITIAL_DATA.firstName).toBe('');
    expect(INITIAL_DATA.lastName).toBe('');
    expect(INITIAL_DATA.emailAddress).toBe('');
  });

  it('has nationality defaulting to South African', () => {
    expect(INITIAL_DATA.nationality).toBe('South African');
  });

  it('has boolean consent fields defaulting to false', () => {
    expect(INITIAL_DATA.termsAccepted).toBe(false);
    expect(INITIAL_DATA.popiaConsent).toBe(false);
    expect(INITIAL_DATA.disclosureAcknowledged).toBe(false);
  });

  it('has accountReasons and existingProducts as empty arrays', () => {
    expect(Array.isArray(INITIAL_DATA.accountReasons)).toBe(true);
    expect(INITIAL_DATA.accountReasons.length).toBe(0);
    expect(Array.isArray(INITIAL_DATA.existingProducts)).toBe(true);
  });
});
