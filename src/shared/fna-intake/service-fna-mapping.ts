import type { QuoteServiceId } from '@/components/pages/quote/types';
import type { FnaIntakeDomain } from '@/services/fna-intake-api';

const SERVICE_TO_FNA_DOMAIN: Partial<Record<QuoteServiceId, FnaIntakeDomain>> = {
  'risk-management': 'risk',
  'medical-aid': 'medical',
  'retirement-planning': 'retirement',
  'investment-management': 'investment',
  'tax-planning': 'tax',
  'estate-planning': 'estate',
};

const FNA_DOMAIN_TITLES: Record<FnaIntakeDomain, string> = {
  risk: 'Risk Planning FNA',
  medical: 'Medical Aid FNA',
  retirement: 'Retirement FNA',
  investment: 'Investment FNA',
  tax: 'Tax Planning FNA',
  estate: 'Estate Planning FNA',
};

export function quoteServiceIdToFnaDomain(serviceId: QuoteServiceId): FnaIntakeDomain | undefined {
  return SERVICE_TO_FNA_DOMAIN[serviceId];
}

export function getFnaDomainTitle(domain: FnaIntakeDomain): string {
  return FNA_DOMAIN_TITLES[domain];
}

export function getFnaTitleForService(serviceId: QuoteServiceId): string | undefined {
  const domain = quoteServiceIdToFnaDomain(serviceId);
  return domain ? getFnaDomainTitle(domain) : undefined;
}
