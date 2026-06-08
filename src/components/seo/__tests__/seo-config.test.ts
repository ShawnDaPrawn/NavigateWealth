import { describe, it, expect, vi } from 'vitest';
import {
  getSEOData,
  getQuoteServiceContactSEO,
  commonFAQs,
  riskManagementFAQs,
  medicalAidFAQs,
  investmentManagementFAQs,
  retirementPlanningFAQs,
  taxPlanningFAQs,
  estatePlanningFAQs,
  employeeBenefitsFAQs,
  financialPlanningFAQs,
} from '../seo-config';

vi.mock('@/utils/siteOrigin', () => ({
  SITE_ORIGIN: 'https://navigatewealth.co',
}));

vi.mock('../../pages/quote/constants', () => ({
  getServiceConfig: (id: string) => ({
    label: `${id} Service`,
    heroDescription:
      'A financial planning service that helps you achieve your goals with expert guidance.',
  }),
}));

describe('getSEOData', () => {
  it('returns SEO data for the home page', () => {
    const data = getSEOData('home');
    expect(data.title).toContain('Navigate Wealth');
    expect(data.canonicalUrl).toBe('https://navigatewealth.co');
    expect(data.ogType).toBe('website');
  });

  it('returns SEO data for the about page', () => {
    const data = getSEOData('about');
    expect(data.title).toContain('About');
    expect(data.canonicalUrl).toContain('/about');
  });

  it('returns SEO data for the contact page', () => {
    const data = getSEOData('contact');
    expect(data.title).toContain('Contact');
  });

  it('falls back to home page data for unknown pages', () => {
    const data = getSEOData('nonexistent-page-xyz');
    expect(data.title).toContain('Navigate Wealth');
  });

  it('returns SEO data for the services page', () => {
    const data = getSEOData('services');
    expect(data.title).toBeTruthy();
  });

  it('returns an object with all required fields', () => {
    const data = getSEOData('home');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('keywords');
    expect(data).toHaveProperty('canonicalUrl');
    expect(data).toHaveProperty('ogType');
  });
});

describe('getQuoteServiceContactSEO', () => {
  it('returns SEO data for a quote service', () => {
    const data = getQuoteServiceContactSEO('risk_planning' as never);
    expect(data.title).toContain('Quote');
    expect(data.canonicalUrl).toContain('/get-quote/');
    expect(data.ogType).toBe('website');
  });

  it('includes the service label in the title', () => {
    const data = getQuoteServiceContactSEO('medical_aid' as never);
    expect(data.title).toContain('medical_aid Service');
  });

  it('truncates description longer than 155 characters', () => {
    vi.doMock('../../pages/quote/constants', () => ({
      getServiceConfig: () => ({
        label: 'Long Service',
        heroDescription: 'A'.repeat(200),
      }),
    }));
    const data = getQuoteServiceContactSEO('risk_planning' as never);
    expect(data.description.length).toBeLessThanOrEqual(155);
  });

  it('uses description as-is when 155 characters or less', () => {
    const data = getQuoteServiceContactSEO('risk_planning' as never);
    expect(data.description.length).toBeLessThanOrEqual(155);
  });
});

describe('FAQ arrays', () => {
  it('commonFAQs is non-empty and has question/answer pairs', () => {
    expect(commonFAQs.length).toBeGreaterThan(0);
    expect(commonFAQs[0]).toHaveProperty('question');
    expect(commonFAQs[0]).toHaveProperty('answer');
  });

  it('riskManagementFAQs has entries', () => {
    expect(riskManagementFAQs.length).toBeGreaterThan(0);
  });

  it('medicalAidFAQs has entries', () => {
    expect(medicalAidFAQs.length).toBeGreaterThan(0);
  });

  it('investmentManagementFAQs has entries', () => {
    expect(investmentManagementFAQs.length).toBeGreaterThan(0);
  });

  it('retirementPlanningFAQs has entries', () => {
    expect(retirementPlanningFAQs.length).toBeGreaterThan(0);
  });

  it('taxPlanningFAQs has entries', () => {
    expect(taxPlanningFAQs.length).toBeGreaterThan(0);
  });

  it('estatePlanningFAQs has entries', () => {
    expect(estatePlanningFAQs.length).toBeGreaterThan(0);
  });

  it('employeeBenefitsFAQs has entries', () => {
    expect(employeeBenefitsFAQs.length).toBeGreaterThan(0);
  });

  it('financialPlanningFAQs has entries', () => {
    expect(financialPlanningFAQs.length).toBeGreaterThan(0);
  });

  it('all FAQ entries have non-empty question and answer', () => {
    const allFaqs = [
      ...commonFAQs,
      ...riskManagementFAQs,
      ...medicalAidFAQs,
      ...investmentManagementFAQs,
    ];
    allFaqs.forEach((faq) => {
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    });
  });
});
