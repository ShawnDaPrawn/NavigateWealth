/**
 * onboarding/validateStep — unit tests (Phase 4 coverage push).
 *
 * The 5-step client-onboarding validator. One fully-valid ApplicationData
 * fixture per call, mutated to exercise each step's required-field and
 * conditional rules (SA-ID format, marital regime, employment branches,
 * service selection, and the digital-signature-must-match-name check).
 */
import { describe, expect, it } from 'vitest';
import { validateStep } from '../validation';
import type { ApplicationData } from '../types';

function valid(): ApplicationData {
  return {
    title: 'Mr',
    firstName: 'John',
    middleName: '',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    nationality: 'South African',
    idType: 'sa_id',
    idNumber: '9001015800087',
    maritalStatus: 'Single',
    maritalRegime: '',
    emailAddress: 'john@example.com',
    cellphoneNumber: '0821234567',
    residentialAddressLine1: '1 Main Rd',
    residentialCity: 'Cape Town',
    residentialProvince: 'Western Cape',
    residentialPostalCode: '8001',
    residentialCountry: 'South Africa',
    employmentStatus: 'employed',
    jobTitle: 'Engineer',
    employerName: 'Acme',
    industry: 'Technology',
    industryOther: '',
    selfEmployedIndustry: '',
    selfEmployedIndustryOther: '',
    selfEmployedDescription: '',
    accountReasons: ['Investment'],
    otherReason: '',
    urgency: 'soon',
    termsAccepted: true,
    popiaConsent: true,
    disclosureAcknowledged: true,
    faisAcknowledged: true,
    signatureFullName: 'John Doe',
  } as unknown as ApplicationData;
}

describe('validateStep — step 1 (identity)', () => {
  it('passes a complete identity step', () => {
    expect(validateStep(1, valid())).toEqual([]);
  });

  it('flags missing required identity fields', () => {
    const d = valid();
    d.firstName = '';
    d.dateOfBirth = '';
    const errs = validateStep(1, d);
    expect(errs).toContain('First name is required');
    expect(errs).toContain('Date of birth is required');
  });

  it('rejects an SA ID that is not 13 digits', () => {
    const d = valid();
    d.idNumber = '123';
    expect(validateStep(1, d)).toContain('SA ID number must be exactly 13 digits');
  });

  it('requires a marital regime for married applicants', () => {
    const d = valid();
    d.maritalStatus = 'Married';
    d.maritalRegime = '';
    expect(validateStep(1, d)).toContain('Please select your marital regime');
  });
});

describe('validateStep — step 2 (contact + address)', () => {
  it('passes a complete contact step', () => {
    expect(validateStep(2, valid())).toEqual([]);
  });

  it('rejects an invalid email', () => {
    const d = valid();
    d.emailAddress = 'not-an-email';
    expect(validateStep(2, d)).toContain('Please enter a valid email address');
  });

  it('flags a missing city', () => {
    const d = valid();
    d.residentialCity = '   ';
    expect(validateStep(2, d)).toContain('City is required');
  });
});

describe('validateStep — step 3 (employment)', () => {
  it('passes an employed applicant with full details', () => {
    expect(validateStep(3, valid())).toEqual([]);
  });

  it('requires job + employer + industry when employed', () => {
    const d = valid();
    d.jobTitle = '';
    d.employerName = '';
    const errs = validateStep(3, d);
    expect(errs).toContain('Job title is required');
    expect(errs).toContain('Employer name is required');
  });

  it('requires the "Other" industry to be specified', () => {
    const d = valid();
    d.industry = 'Other';
    d.industryOther = '';
    expect(validateStep(3, d)).toContain('Please specify your industry');
  });

  it('requires industry + description when self-employed', () => {
    const d = valid();
    d.employmentStatus = 'self-employed';
    d.selfEmployedIndustry = '';
    d.selfEmployedDescription = '';
    const errs = validateStep(3, d);
    expect(errs).toContain('Industry is required');
    expect(errs).toContain('Business description is required');
  });
});

describe('validateStep — step 4 (services)', () => {
  it('passes when a service and urgency are selected', () => {
    expect(validateStep(4, valid())).toEqual([]);
  });

  it('requires at least one service', () => {
    const d = valid();
    d.accountReasons = [];
    expect(validateStep(4, d)).toContain(
      'Please select at least one service you are interested in',
    );
  });

  it('requires the "Other" reason to be specified', () => {
    const d = valid();
    d.accountReasons = ['Other'];
    d.otherReason = '';
    expect(validateStep(4, d)).toContain('Please specify your reason');
  });
});

describe('validateStep — step 5 (consent + signature)', () => {
  it('passes when all consents are given and the signature matches', () => {
    expect(validateStep(5, valid())).toEqual([]);
  });

  it('requires every consent acknowledgement', () => {
    const d = valid();
    d.termsAccepted = false;
    d.popiaConsent = false;
    const errs = validateStep(5, d);
    expect(errs).toContain('You must accept the Terms and Conditions');
    expect(errs).toContain('You must provide POPIA consent');
  });

  it('requires the signature to match the full legal name', () => {
    const d = valid();
    d.signatureFullName = 'Johnny Doe';
    expect(validateStep(5, d)).toContain(
      'Your signature must exactly match your full name: John Doe',
    );
  });
});
