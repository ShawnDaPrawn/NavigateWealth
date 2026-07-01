/**
 * SEO Configuration
 *
 * Centralised SEO metadata for all public-facing pages.
 * Each entry provides the title, description, keywords, canonical URL,
 * and Open Graph type used by the SEO component.
 */

import { getServiceConfig } from '../pages/quote/constants';
import type { QuoteServiceId } from '../pages/quote/types';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import faqData from './faqs.json';

const BASE_URL = SITE_ORIGIN;

export interface SEOPageData {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: string;
}

export const seoPages: Record<string, SEOPageData> = {
  home: {
    title: 'Independent Financial Advisors SA | Navigate Wealth',
    description:
      'Navigate Wealth provides independent financial planning, investment management, retirement planning, risk management, tax planning and estate planning services across South Africa.',
    keywords:
      'financial advisor, wealth management, investment planning, retirement planning, risk management, tax planning, estate planning, South Africa, independent financial advisor',
    canonicalUrl: BASE_URL,
    ogType: 'website',
  },
  about: {
    title: 'About Us | Navigate Wealth',
    description:
      'Learn about Navigate Wealth, our mission, values, and the experienced team of independent financial advisors committed to helping you achieve financial independence.',
    keywords:
      'about navigate wealth, financial advisors team, independent financial planning, South Africa wealth management',
    canonicalUrl: `${BASE_URL}/about`,
    ogType: 'website',
  },
  contact: {
    title: 'Contact Us | Navigate Wealth',
    description:
      'Get in touch with Navigate Wealth for a free consultation. Our independent financial advisors are ready to help you plan your financial future.',
    keywords:
      'contact navigate wealth, financial advisor consultation, free consultation, South Africa financial planning',
    canonicalUrl: `${BASE_URL}/contact`,
    ogType: 'website',
  },
  'risk-management': {
    title: 'Risk Management | Life & Disability Cover | Navigate Wealth',
    description:
      'Independent risk management advice in South Africa. Life cover, disability, severe illness & income protection from leading insurers.',
    keywords:
      'risk management South Africa, life cover, disability insurance, income protection, severe illness cover, business insurance, buy and sell agreement, key person insurance, life insurance South Africa, independent insurance advisor, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/risk-management`,
    ogType: 'website',
  },
  'medical-aid': {
    title: 'Medical Aid & Health Insurance | Navigate Wealth',
    description:
      'Independent medical aid advice for individuals and businesses in South Africa. Comprehensive plans, hospital plans, savings plans, group schemes, and corporate wellness from leading medical schemes.',
    keywords:
      'medical aid South Africa, health insurance, hospital plan, medical savings, gap cover, group medical scheme, corporate wellness, Discovery Health, Momentum Health, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/medical-aid`,
    ogType: 'website',
  },
  'investment-management': {
    title: 'Investment Management | Navigate Wealth',
    description:
      'Professional investment management in South Africa. Unit trusts, tax-free savings, offshore investments & corporate fund solutions.',
    keywords:
      'investment management South Africa, unit trusts, tax free savings account, offshore investments, endowments, corporate investments, wealth management, Allan Gray, Sygnia, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/investment-management`,
    ogType: 'website',
  },
  'retirement-planning': {
    title: 'Retirement Planning | Annuities & Pensions | Navigate Wealth',
    description:
      'Comprehensive retirement planning in South Africa. Retirement annuities, preservation funds, living annuities & pension funds from leading providers.',
    keywords:
      'retirement planning South Africa, retirement annuity, living annuity, pension fund, provident fund, preservation fund, retirement savings, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/retirement-planning`,
    ogType: 'website',
  },
  'tax-planning': {
    title: 'Tax Planning & Optimisation | Navigate Wealth',
    description:
      'Expert tax planning and optimisation for individuals and businesses in South Africa. Tax-efficient structures, estate duty planning, capital gains management, and corporate tax strategies.',
    keywords:
      'tax planning South Africa, tax optimisation, estate duty, capital gains tax, corporate tax, tax-free savings, tax deductions, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/tax-planning`,
    ogType: 'website',
  },
  'estate-planning': {
    title: 'Estate Planning | Wills & Trusts | Navigate Wealth',
    description:
      'Comprehensive estate planning for individuals and businesses in South Africa. Wills, trusts, succession planning, estate duty optimisation, and business continuity from accredited specialists.',
    keywords:
      'estate planning South Africa, wills, trusts, succession planning, estate duty, inheritance, business succession, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/estate-planning`,
    ogType: 'website',
  },
  'employee-benefits': {
    title: 'Employee Benefits | Group Risk & Health | Navigate Wealth',
    description:
      'Tailored employee benefits for businesses in South Africa. Group risk cover, retirement funds, medical aid & wellness programmes.',
    keywords:
      'employee benefits South Africa, group risk cover, group retirement fund, group medical aid, corporate wellness, employee wellness, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/employee-benefits`,
    ogType: 'website',
  },
  'financial-planning': {
    title: 'Financial Planning | Wealth Strategy | Navigate Wealth',
    description:
      'Independent financial planning in South Africa. Strategies covering investments, retirement, tax, estate planning & debt management.',
    keywords:
      'financial planning South Africa, comprehensive financial plan, wealth strategy, retirement planning, investment strategy, tax planning, estate planning, debt management, certified financial planner, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/financial-planning`,
    ogType: 'website',
  },
  press: {
    title: 'Press & Media | Navigate Wealth',
    description:
      'Navigate Wealth press releases, media coverage, and company announcements. Access our media kit, brand assets, and the latest news from our financial advisory firm.',
    keywords:
      'Navigate Wealth press, media coverage, financial advisor news, press releases, media kit, South Africa financial services news',
    canonicalUrl: `${BASE_URL}/press`,
    ogType: 'website',
  },
  careers: {
    title: 'Careers | Join Our Team | Navigate Wealth',
    description:
      'Explore career opportunities at Navigate Wealth. Join a dynamic team of independent financial advisors committed to helping South Africans achieve financial independence.',
    keywords:
      'Navigate Wealth careers, financial advisor jobs, wealth management careers, financial planning jobs South Africa, independent financial advisor vacancy',
    canonicalUrl: `${BASE_URL}/careers`,
    ogType: 'website',
  },
  team: {
    title: 'Our Team | Meet the Advisors | Navigate Wealth',
    description:
      'Meet the experienced team of independent financial advisors at Navigate Wealth. Qualified professionals dedicated to your financial success across South Africa.',
    keywords:
      'Navigate Wealth team, financial advisors, certified financial planner, wealth management team, South Africa financial advisors',
    canonicalUrl: `${BASE_URL}/team`,
    ogType: 'website',
  },
  'why-us': {
    title: 'Why Choose Navigate Wealth | Independent Financial Advisory',
    description:
      'Discover why Navigate Wealth is the trusted choice for independent financial advice in South Africa. Our independence, personalised approach, and commitment to long-term relationships set us apart.',
    keywords:
      'why Navigate Wealth, independent financial advisor, best financial planner South Africa, trusted wealth management, personalised financial advice',
    canonicalUrl: `${BASE_URL}/why-us`,
    ogType: 'website',
  },
  'get-quote': {
    title: 'Get a Free Quote | Navigate Wealth',
    description:
      'Request a free, no-obligation quote for financial planning, insurance, investments, retirement, or medical aid. Our independent advisors compare the market to find the best solution for you.',
    keywords:
      'free financial quote, insurance quote South Africa, investment quote, retirement planning quote, medical aid quote, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/get-quote`,
    ogType: 'website',
  },
  legal: {
    title: 'Legal & Compliance | Navigate Wealth',
    description:
      'Navigate Wealth legal documents, privacy policy, terms and conditions, POPIA compliance, FAIS disclosure, and regulatory information for our financial advisory services.',
    keywords:
      'Navigate Wealth legal, privacy policy, terms and conditions, POPIA, FAIS disclosure, financial services compliance, South Africa',
    canonicalUrl: `${BASE_URL}/legal`,
    ogType: 'website',
  },
  'for-individuals': {
    title: 'Financial Planning for Individuals | Navigate Wealth',
    description:
      'Personal financial planning services for individuals in South Africa. Risk management, investments, retirement planning, tax optimisation, estate planning, and medical aid from independent advisors.',
    keywords:
      'personal financial planning, individual wealth management, personal insurance, investment advice, retirement planning individual, South Africa, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/solutions/individuals`,
    ogType: 'website',
  },
  'for-businesses': {
    title: 'Financial Solutions for Businesses | Navigate Wealth',
    description:
      'Corporate financial services for businesses in South Africa. Employee benefits, group risk cover, business insurance, corporate investments, and tax planning from independent advisors.',
    keywords:
      'business financial planning, corporate wealth management, employee benefits, group risk cover, business insurance, corporate investments, South Africa, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/solutions/businesses`,
    ogType: 'website',
  },
  'for-advisers': {
    title: 'For Financial Advisers | Partner with Navigate Wealth',
    description:
      'Join Navigate Wealth as an independent financial adviser. Access our technology platform, compliance support, product range, and collaborative network across South Africa.',
    keywords:
      'financial adviser partnership, independent adviser network, financial services franchise, adviser support platform, Navigate Wealth partnership, South Africa',
    canonicalUrl: `${BASE_URL}/solutions/advisers`,
    ogType: 'website',
  },
  'get-started': {
    title: 'Get Started | Create Your Account | Navigate Wealth',
    description:
      'Create your Navigate Wealth account to access personalised financial planning, portfolio management, and independent advisory services across South Africa.',
    keywords:
      'Navigate Wealth sign up, create account, financial planning account, wealth management portal, South Africa',
    canonicalUrl: `${BASE_URL}/get-started`,
    ogType: 'website',
  },
  resources: {
    title: 'Resources & Insights | Navigate Wealth',
    description:
      'Financial planning articles, market insights, and educational resources from Navigate Wealth. Stay informed with expert commentary on investments, retirement, tax, and more.',
    keywords:
      'financial planning articles, investment insights, retirement planning resources, tax planning guides, market commentary, Navigate Wealth blog, South Africa',
    canonicalUrl: `${BASE_URL}/resources`,
    ogType: 'website',
  },
  'ask-vasco': {
    title: 'Ask Vasco | AI Financial Navigator | Navigate Wealth',
    description:
      'Ask Vasco, Navigate Wealth’s public AI financial navigator, for general South African financial guidance on retirement, tax, risk cover, investing, and estate planning.',
    keywords:
      'AI financial navigator South Africa, financial planning chatbot, retirement questions, tax planning guidance, Navigate Wealth Vasco',
    canonicalUrl: `${BASE_URL}/ask-vasco`,
    ogType: 'website',
  },
};

/**
 * SEO for shareable quote contact landing pages: /get-quote/:service/contact
 */
export function getQuoteServiceContactSEO(serviceId: QuoteServiceId): SEOPageData {
  const cfg = getServiceConfig(serviceId)!;
  const description =
    cfg.heroDescription.length > 155
      ? `${cfg.heroDescription.slice(0, 152)}…`
      : cfg.heroDescription;
  return {
    title: `Request a ${cfg.label} Quote | Navigate Wealth`,
    description,
    keywords: `${cfg.label}, free quote, independent advisor, Navigate Wealth, South Africa`,
    canonicalUrl: `${BASE_URL}/get-quote/${serviceId}/contact`,
    ogType: 'website',
  };
}

/**
 * Retrieve SEO metadata for a given page identifier.
 * Falls back to the home page data when the key is not found.
 */
export function getSEOData(page: string): SEOPageData {
  return seoPages[page] || seoPages.home;
}

/** SERP-safe title length; mirrors SEO_TITLE_MAX in scripts/seo-static-data.mjs. */
export const SEO_TITLE_MAX = 60;
const TITLE_SUFFIX = ' | Navigate Wealth';

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Truncate to a word boundary within `max` chars, appending an ellipsis. */
function truncateAtWord(value: string, max: number): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[\s.,;:!?–—-]+$/, '')}…`;
}

/**
 * Build a SERP-safe article <title>. Keeps the brand suffix when the whole
 * tag fits, otherwise prefers the keyword-rich headline and drops/truncates
 * to stay within SEO_TITLE_MAX. Mirrors buildArticleTitle in
 * scripts/seo-static-data.mjs so the hydrated title matches the prerendered one.
 */
export function buildArticleTitle(rawHeadline: string | undefined): string {
  const headline = collapseWhitespace(rawHeadline ?? '') || 'Financial Planning Article';
  const withSuffix = `${headline}${TITLE_SUFFIX}`;
  if (withSuffix.length <= SEO_TITLE_MAX) return withSuffix;
  if (headline.length <= SEO_TITLE_MAX) return headline;
  return truncateAtWord(headline, SEO_TITLE_MAX);
}

/* -------------------------------------------------------------------------- */
/*  FAQ content                                                               */
/* -------------------------------------------------------------------------- */

export interface FAQEntry {
  question: string;
  answer: string;
}

/**
 * FAQ content lives in faqs.json — the single source of truth shared with the
 * build-time prerenderer (scripts/seo-static-data.mjs), so the visible FAQ
 * sections, the FAQPage JSON-LD, and the prerendered static HTML always agree.
 */
export const commonFAQs: FAQEntry[] = faqData['common'];
export const riskManagementFAQs: FAQEntry[] = faqData['risk-management'];
export const medicalAidFAQs: FAQEntry[] = faqData['medical-aid'];
export const investmentManagementFAQs: FAQEntry[] = faqData['investment-management'];
export const retirementPlanningFAQs: FAQEntry[] = faqData['retirement-planning'];
export const taxPlanningFAQs: FAQEntry[] = faqData['tax-planning'];
export const estatePlanningFAQs: FAQEntry[] = faqData['estate-planning'];
export const employeeBenefitsFAQs: FAQEntry[] = faqData['employee-benefits'];
export const financialPlanningFAQs: FAQEntry[] = faqData['financial-planning'];
