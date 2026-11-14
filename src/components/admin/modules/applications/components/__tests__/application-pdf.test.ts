/** The application PDF holds every section of the review page. */
import { describe, it, expect } from 'vitest';
import type { Application } from '../../types';
import { applicationPdfFileName, applicationPdfSections } from '../application-pdf';

const app = {
  id: 'app-1',
  user_id: 'u-1',
  status: 'approved',
  created_at: '2026-07-09T09:00:00Z',
  updated_at: '2026-07-09T09:10:00Z',
  submitted_at: '2026-07-09T09:01:00Z',
  application_number: 'APP-2026-0190',
  origin: 'admin_import',
  review_notes: 'Called client to confirm spouse details.',
  application_data: {
    title: 'Mrs',
    firstName: 'Nadia',
    lastName: 'Hendricks',
    dateOfBirth: '1980-03-25',
    gender: 'Female',
    nationality: 'South Africa',
    idType: 'sa_id',
    idNumber: '8003255000082',
    emailAddress: 'nadia.h@example.com',
    cellphoneNumber: '',
    residentialAddressLine1: '1 Main Rd',
    residentialCity: 'Cape Town',
    residentialProvince: 'Western Cape',
    residentialCountry: 'South Africa',
    employmentStatus: 'self_employed',
    accountReasons: ['retirement_planning', 'investments'],
    financialGoals: 'Retire at 60',
    externalProviders: ['Old Mutual'],
    customProviders: ['Sanlam'],
    termsAccepted: true,
    popiaConsent: true,
    disclosureAcknowledged: true,
  },
} as unknown as Application;

describe('applicationPdfSections', () => {
  it('covers every review section and the review notes', () => {
    const titles = applicationPdfSections(app).map((s) => s.title);
    expect(titles).toEqual([
      'Application',
      'Personal information',
      'Identification',
      'Marital status',
      'Contact information',
      'Residential address',
      'Employment',
      'Financial overview',
      'Services & interests',
      'External providers (FSPs)',
      'External financial products',
      'Consent & agreements',
      'Review notes',
    ]);
  });

  it('fills values, hides most of the ID number and marks gaps', () => {
    const sections = Object.fromEntries(
      applicationPdfSections(app).map((s) => [s.title, Object.fromEntries(s.rows)]),
    );
    expect(sections['Personal information']['Full name']).toBe('Mrs Nadia Hendricks');
    expect(sections['Identification']['ID / passport number']).toBe('800325••••82');
    expect(sections['Contact information']['Cellphone']).toBe('Not provided');
    expect(sections['Application']['Status']).toBe('Approved');
    expect(sections['Application']['Origin']).toBe('Import');
    expect(sections['External providers (FSPs)']['Providers']).toBe('Old Mutual, Sanlam');
    expect(sections['Consent & agreements']['POPIA consent']).toBe('Accepted');
    expect(sections['Services & interests']['Services requested']).toBe(
      'Retirement planning, Investments',
    );
  });

  it('names the file after the application number', () => {
    expect(applicationPdfFileName(app)).toBe('Navigate_Wealth_Application_APP-2026-0190.pdf');
  });
});
