/**
 * Tests for the refund-cluster entity form helpers (pure functions).
 */

import { describe, expect, it } from 'vitest';
import {
  buildEntityPayload,
  emptyEntityForm,
  entityDisplayName,
  entityMatchesSearch,
  formFromEntity,
  validateEntityForm,
} from '../formState';
import type { RefundEntity } from '../types';

function makeEntity(overrides: Partial<RefundEntity> = {}): RefundEntity {
  return {
    id: 'e1',
    clusterId: 'c1',
    entityType: 'sole_proprietor',
    personalDetails: { name: 'Thabo', surname: 'Nkosi', physicalAddress: '1 Main Rd' },
    bankingDetails: {
      primary: {
        bankName: 'FNB',
        accountHolder: 'T Nkosi',
        accountNumber: '123',
        branchCode: '250655',
        accountType: 'Savings',
        onlineUsername: 'tnkosi',
        hasOnlinePassword: true,
      },
      secondary: {
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        branchCode: '',
        accountType: '',
        onlineUsername: '',
        hasOnlinePassword: false,
      },
    },
    taxDetails: {
      efilingUsername: 'thabo123',
      hasEfilingPassword: true,
      currentPeriodVat: 'R100',
      previousPeriodVat: 'R90',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  };
}

const companyEntity = makeEntity({
  entityType: 'company',
  personalDetails: undefined,
  businessDetails: {
    companyName: 'Acme (Pty) Ltd',
    registrationNumber: '2020/123456/07',
    tradingName: 'Acme',
    registeredAddress: '2 Long St',
    physicalBusinessAddress: '2 Long St',
    contactPerson: 'Jane',
    contactPersonEmail: 'jane@acme.co.za',
    contactPersonPhone: '0820000000',
  },
});

describe('emptyEntityForm', () => {
  it('creates a blank form for the chosen type', () => {
    const form = emptyEntityForm('company');
    expect(form.entityType).toBe('company');
    expect(form.businessDetails.companyName).toBe('');
    expect(form.primaryAccount.bankName).toBe('');
    expect(form.efilingPassword).toBe('');
    expect(form.currentPeriodVat).toBe('');
  });
});

describe('formFromEntity', () => {
  it('hydrates the form and never carries a password', () => {
    const form = formFromEntity(makeEntity());
    expect(form.personalDetails.name).toBe('Thabo');
    expect(form.primaryAccount.bankName).toBe('FNB');
    expect(form.currentPeriodVat).toBe('R100');
    expect(form.efilingPassword).toBe('');
  });
});

describe('validateEntityForm', () => {
  it('requires name and surname for sole proprietors', () => {
    const form = emptyEntityForm('sole_proprietor');
    expect(validateEntityForm(form)).toBe('Name is required');
    form.personalDetails.name = 'Thabo';
    expect(validateEntityForm(form)).toBe('Surname is required');
    form.personalDetails.surname = 'Nkosi';
    expect(validateEntityForm(form)).toBeNull();
  });

  it('requires company name and registration number for companies', () => {
    const form = emptyEntityForm('company');
    expect(validateEntityForm(form)).toBe('Company name is required');
    form.businessDetails.companyName = 'Acme';
    expect(validateEntityForm(form)).toBe('Registration number is required');
    form.businessDetails.registrationNumber = '2020/123456/07';
    expect(validateEntityForm(form)).toBeNull();
  });

  it('rejects an invalid contact email but allows an empty one', () => {
    const form = emptyEntityForm('company');
    form.businessDetails.companyName = 'Acme';
    form.businessDetails.registrationNumber = '2020/1/07';
    form.businessDetails.contactPersonEmail = 'not-an-email';
    expect(validateEntityForm(form)).toBe('Contact person email is invalid');
    form.businessDetails.contactPersonEmail = '';
    expect(validateEntityForm(form)).toBeNull();
  });
});

describe('buildEntityPayload', () => {
  it('omits the password when the field is empty (edit must not clear it)', () => {
    const form = formFromEntity(makeEntity());
    const payload = buildEntityPayload(form);
    expect(payload.taxDetails?.efilingPassword).toBeUndefined();
    expect(payload.taxDetails?.efilingUsername).toBe('thabo123');
  });

  it('includes the password only when typed', () => {
    const form = formFromEntity(makeEntity());
    form.efilingPassword = 's3cret';
    expect(buildEntityPayload(form).taxDetails?.efilingPassword).toBe('s3cret');
  });

  it('sends personalDetails for sole proprietors and businessDetails for companies', () => {
    const sole = buildEntityPayload(formFromEntity(makeEntity()));
    expect(sole.personalDetails?.name).toBe('Thabo');
    expect(sole.businessDetails).toBeUndefined();

    const company = buildEntityPayload(formFromEntity(companyEntity));
    expect(company.businessDetails?.companyName).toBe('Acme (Pty) Ltd');
    expect(company.personalDetails).toBeUndefined();
  });

  it('carries the assigned manager id, or null when unassigned', () => {
    const unassigned = buildEntityPayload(formFromEntity(makeEntity()));
    expect(unassigned.managerId).toBeNull();

    const assigned = buildEntityPayload(formFromEntity(makeEntity({ managerId: 'm1' })));
    expect(assigned.managerId).toBe('m1');
  });

  it('sends the online-banking username but omits the password unless typed', () => {
    const form = formFromEntity(makeEntity());
    const payload = buildEntityPayload(form);
    expect(payload.bankingDetails?.primary.onlineUsername).toBe('tnkosi');
    expect(payload.bankingDetails?.primary.onlinePassword).toBeUndefined();

    form.primaryAccount.onlinePassword = 'bank-pw';
    expect(buildEntityPayload(form).bankingDetails?.primary.onlinePassword).toBe('bank-pw');
  });

  it('hydrates the stored-password flag without carrying the password', () => {
    const form = formFromEntity(makeEntity());
    expect(form.primaryAccount.hasOnlinePassword).toBe(true);
    expect(form.primaryAccount.onlinePassword).toBe('');
    expect(form.secondaryAccount.hasOnlinePassword).toBe(false);
  });
});

describe('entityDisplayName', () => {
  it('uses name + surname for sole proprietors', () => {
    expect(entityDisplayName(makeEntity())).toBe('Thabo Nkosi');
  });

  it('uses the company name for companies', () => {
    expect(entityDisplayName(companyEntity)).toBe('Acme (Pty) Ltd');
  });

  it('falls back to a placeholder when empty', () => {
    const blank = makeEntity({
      personalDetails: { name: '', surname: '', physicalAddress: '' },
    });
    expect(entityDisplayName(blank)).toBe('Unnamed sole proprietor');
  });
});

describe('entityMatchesSearch', () => {
  it('matches on name, surname, company name and registration number', () => {
    expect(entityMatchesSearch(makeEntity(), 'thabo')).toBe(true);
    expect(entityMatchesSearch(makeEntity(), 'nkosi')).toBe(true);
    expect(entityMatchesSearch(makeEntity(), 'acme')).toBe(false);
    expect(entityMatchesSearch(companyEntity, 'acme')).toBe(true);
    expect(entityMatchesSearch(companyEntity, '2020/123456')).toBe(true);
  });

  it('matches everything when the search is blank', () => {
    expect(entityMatchesSearch(makeEntity(), '  ')).toBe(true);
  });
});
