import { describe, expect, it } from 'vitest';
import {
  getFnaDomainTitle,
  getFnaTitleForService,
  quoteServiceIdToFnaDomain,
} from '@/shared/fna-intake/service-fna-mapping';

describe('service-fna-mapping', () => {
  it('maps each quote service to the correct FNA domain', () => {
    expect(quoteServiceIdToFnaDomain('risk-management')).toBe('risk');
    expect(quoteServiceIdToFnaDomain('medical-aid')).toBe('medical');
    expect(quoteServiceIdToFnaDomain('retirement-planning')).toBe('retirement');
    expect(quoteServiceIdToFnaDomain('investment-management')).toBe('investment');
    expect(quoteServiceIdToFnaDomain('tax-planning')).toBe('tax');
    expect(quoteServiceIdToFnaDomain('estate-planning')).toBe('estate');
  });

  it('returns undefined for employee benefits', () => {
    expect(quoteServiceIdToFnaDomain('employee-benefits')).toBeUndefined();
  });

  it('returns human-readable titles', () => {
    expect(getFnaDomainTitle('risk')).toBe('Risk Planning FNA');
    expect(getFnaTitleForService('medical-aid')).toBe('Medical Aid FNA');
  });
});
