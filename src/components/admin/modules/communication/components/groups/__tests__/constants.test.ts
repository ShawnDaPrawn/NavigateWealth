import { describe, expect, it } from 'vitest';
import {
  MARITAL_STATUS_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  COUNTRY_OPTIONS,
  OCCUPATION_OPTIONS,
} from '../constants';

describe('communication/groups constants', () => {
  it('MARITAL_STATUS_OPTIONS is a non-empty array', () => {
    expect(MARITAL_STATUS_OPTIONS.length).toBeGreaterThan(0);
    expect(MARITAL_STATUS_OPTIONS).toContain('Single');
    expect(MARITAL_STATUS_OPTIONS).toContain('Married');
  });

  it('EMPLOYMENT_STATUS_OPTIONS has employed and retired', () => {
    expect(EMPLOYMENT_STATUS_OPTIONS).toContain('Employed');
    expect(EMPLOYMENT_STATUS_OPTIONS).toContain('Retired');
  });

  it('GENDER_OPTIONS has Male, Female, and Other', () => {
    expect(GENDER_OPTIONS).toContain('Male');
    expect(GENDER_OPTIONS).toContain('Female');
    expect(GENDER_OPTIONS).toContain('Other');
  });

  it('COUNTRY_OPTIONS includes South Africa', () => {
    expect(COUNTRY_OPTIONS).toContain('South Africa');
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(0);
  });

  it('OCCUPATION_OPTIONS has multiple professions', () => {
    expect(OCCUPATION_OPTIONS.length).toBeGreaterThan(5);
    expect(OCCUPATION_OPTIONS).toContain('Doctor');
    expect(OCCUPATION_OPTIONS).toContain('Accountant');
  });
});
