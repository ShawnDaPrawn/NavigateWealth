import { describe, expect, it } from 'vitest';
import { normalizeApplication, normalizeApplicationData } from '../utils';
import type { Application, ApplicationData } from '../types';

describe('applications utils normalization', () => {
  it('normalizes string and object multi-select values into arrays', () => {
    const normalized = normalizeApplicationData({
      accountReasons: 'Retirement Planning',
      existingProducts: { 'Life Cover': true, 'None of the above': false },
      externalProviders: 'Discovery',
      customProviders: 'Custom Broker',
    } as unknown as ApplicationData);

    expect(normalized.accountReasons).toEqual(['Retirement Planning']);
    expect(normalized.existingProducts).toEqual(['Life Cover']);
    expect(normalized.externalProviders).toEqual(['Discovery']);
    expect(normalized.customProviders).toEqual(['Custom Broker']);
  });

  it('normalizes API application records before the UI consumes them', () => {
    const application = normalizeApplication({
      id: 'app-1',
      user_id: 'user-1',
      status: 'submitted',
      created_at: '2026-05-13T08:00:00.000Z',
      updated_at: '2026-05-13T08:00:00.000Z',
      application_data: {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
        nationality: 'South African',
        emailAddress: 'jane@example.com',
        cellphoneNumber: '0820000000',
        residentialAddressLine1: '1 Main Rd',
        residentialCity: 'Cape Town',
        residentialProvince: 'Western Cape',
        residentialCountry: 'South Africa',
        employmentStatus: 'employed',
        financialGoals: 'Grow savings',
        accountReasons: 'Investment Planning',
        termsAccepted: true,
        popiaConsent: true,
        disclosureAcknowledged: true,
        existingProducts: 'Medical Aid',
      } as unknown as ApplicationData,
    } as Application);

    expect(application.application_data.accountReasons).toEqual(['Investment Planning']);
    expect(application.application_data.existingProducts).toEqual(['Medical Aid']);
  });
});
