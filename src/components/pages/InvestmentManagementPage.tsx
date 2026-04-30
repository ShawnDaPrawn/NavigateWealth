/**
 * InvestmentManagementPage — Aligned to RiskManagementPage v3 template
 * via ServicePageTemplate.
 */

import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData, investmentManagementFAQs } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import {
  TrendingUp,
  PieChart,
  BarChart3,
  Target,
  Globe,
  Building,
  Shield,
  Briefcase,
  Search,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  allanGrayLogo,
  sygniaLogo,
  discoveryLogo,
  libertyLogo,
  stanlibLogo,
  inn8Logo,
  oldMutualLogo,
  sanlamLogo,
  momentumLogo,
  justLogo,
} from '../shared/assets/provider-logos';

// Product images
import investmentGrowthImage from 'figma:asset/7f39ab25c8d51c8647ca73dc5c9126b4df46a0c6.png';
import unitTrustImage from 'figma:asset/6c666aace2acbb23684f35d02f79057dd364f5c6.png';
import taxFreeSavingsImage from 'figma:asset/05476d116bd826bed8f620f9ca8ef63eeaa74a6f.png';
import offshoreUnitTrustsImage from 'figma:asset/3a20bd72e539d6d53bb18a444a908939ce9db465.png';
import endowmentsImage from 'figma:asset/735ec93e5649f0d2d281ac7aa06355a572058b48.png';
import offshoreEndowmentsImage from 'figma:asset/cdaed82d69fb87a2a9ba8ab94b6ed69c92ae131f.png';
import corporateImage from 'figma:asset/76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png';
import cashManagementImage from 'figma:asset/c9d654dd575becaa809d4d9ce31d124144ee1c67.png';
import treasuryImage from 'figma:asset/58e37d5523feb65e353e0ac15275fd8643fc65e9.png';

// ── Partner logos ─────────────────────────────────────────────────────────────

const partnerLogos = [
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo, est: '1973' },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo, est: '2003' },
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo, est: '1992' },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo, est: '1957' },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo, est: '1974' },
  { id: 'inn8', name: 'INN8', logo: inn8Logo, est: '2018' },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo, est: '1845' },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo, est: '1918' },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo, est: '1966' },
  { id: 'just', name: 'JUST', logo: justLogo, est: '2012' },
];

// ── Individual products ───────────────────────────────────────────────────────

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'unit-trust': PieChart,
  'tax-free-savings': Shield,
  'offshore-unit-trusts': Globe,
  'endowments': Target,
  'offshore-endowments': BarChart3,
};

const individualToggleOptions = [
  { id: 'unit-trust', label: 'Unit Trusts' },
  { id: 'tax-free-savings', label: 'Tax Free Savings' },
  { id: 'offshore-unit-trusts', label: 'Offshore Unit Trusts' },
  { id: 'endowments', label: 'Endowments' },
  { id: 'offshore-endowments', label: 'Offshore Endowments' },
];

const individualProducts: Record<string, CoverContent> = {
  'unit-trust': {
    title: 'Unit Trusts',
    description: 'Professionally managed collective investment schemes with diversified portfolios.',
    benefitsDescription: 'Unit trusts provide access to professionally managed investment portfolios with instant diversification across asset classes, sectors, and geographies. These collective investment schemes pool funds from multiple investors, allowing you to benefit from economies of scale, professional fund management, and daily liquidity while maintaining low minimum investment requirements.',
    features: [
      { title: 'Professional Management', description: 'Expert fund managers optimise your portfolio' },
      { title: 'Instant Diversification', description: 'Spread across asset classes and sectors' },
      { title: 'Daily Liquidity', description: 'Access your funds with daily pricing' },
      { title: 'Low Minimums', description: 'Start investing with small amounts' },
    ],
    benefits: ['Professional fund management', 'Instant portfolio diversification', 'Low minimum investment amounts', 'Daily liquidity and pricing', 'Access to diverse asset classes'],
    image: unitTrustImage,
    imageKey: '6c666aace2acbb23684f35d02f79057dd364f5c6',
  },
  'tax-free-savings': {
    title: 'Tax Free Savings',
    description: 'Tax-efficient investment accounts with R36,000 annual and R500,000 lifetime limits.',
    benefitsDescription: 'Tax Free Savings Accounts offer exceptional tax benefits with no tax on interest, dividends, or capital gains. With an annual contribution limit of R36,000 and lifetime limit of R500,000, these accounts provide a powerful wealth-building tool for long-term investors seeking to maximize after-tax returns while maintaining investment flexibility.',
    features: [
      { title: 'Zero Tax', description: 'No tax on interest, dividends, or capital gains' },
      { title: 'Annual Limit', description: 'R36,000 contribution per year' },
      { title: 'Lifetime Limit', description: 'R500,000 total contributions' },
      { title: 'Flexible Investments', description: 'Choose from a range of investment options' },
    ],
    benefits: ['Zero tax on investment returns', 'R36,000 annual contribution limit', 'R500,000 lifetime contribution limit', 'Flexible investment choices', 'Ideal for long-term wealth building'],
    image: taxFreeSavingsImage,
    imageKey: '05476d116bd826bed8f620f9ca8ef63eeaa74a6f',
  },
  'offshore-unit-trusts': {
    title: 'Offshore Unit Trusts',
    description: 'Global investment exposure through international unit trust funds.',
    benefitsDescription: 'Offshore unit trusts provide diversification beyond South African borders, offering exposure to developed markets, global currencies, and international investment opportunities. These funds protect your wealth from local economic volatility and currency depreciation while accessing superior growth prospects in developed economies and emerging markets worldwide.',
    features: [
      { title: 'Global Markets', description: 'Access developed and emerging economies' },
      { title: 'Currency Hedge', description: 'Diversify beyond the South African rand' },
      { title: 'International Managers', description: 'World-class fund management expertise' },
      { title: 'Volatility Protection', description: 'Reduce local concentration risk' },
    ],
    benefits: ['Global market diversification', 'Currency diversification benefits', 'Access to international managers', 'Protection from local volatility', 'Exposure to developed economies'],
    image: offshoreUnitTrustsImage,
    imageKey: '3a20bd72e539d6d53bb18a444a908939ce9db465',
  },
  'endowments': {
    title: 'Endowments',
    description: 'Tax-efficient investment wrappers with favorable estate planning benefits.',
    benefitsDescription: 'Endowment policies combine investment growth with tax efficiency and estate planning benefits. These investment wrappers offer reduced tax rates on investment returns (maximum 30% CGT vs 45% for individuals), no income tax on withdrawals after five years, and simplified estate planning with proceeds paid directly to beneficiaries outside of the estate.',
    features: [
      { title: 'Tax Efficiency', description: 'Reduced capital gains tax rates within the policy' },
      { title: 'Estate Benefits', description: 'Proceeds bypass your estate on death' },
      { title: 'Maturity Benefit', description: 'Tax-free withdrawals after 5 years' },
      { title: 'Investment Flexibility', description: 'Range of underlying investment choices' },
    ],
    benefits: ['Reduced capital gains tax rates', 'Tax-free withdrawals after 5 years', 'Estate planning advantages', 'No executor fees on proceeds', 'Investment flexibility within wrapper'],
    image: endowmentsImage,
    imageKey: '735ec93e5649f0d2d281ac7aa06355a572058b48',
  },
  'offshore-endowments': {
    title: 'Offshore Endowments',
    description: 'International endowment structures combining global exposure with tax efficiency.',
    benefitsDescription: 'Offshore endowments merge the tax benefits of traditional endowments with international investment exposure and currency diversification. These sophisticated investment vehicles provide access to global markets while maintaining favorable tax treatment, estate planning benefits, and protection from South African exchange control restrictions, ideal for wealth preservation and international diversification.',
    features: [
      { title: 'Global Exposure', description: 'Access international markets and currencies' },
      { title: 'Tax Benefits', description: 'Favourable tax treatment on returns' },
      { title: 'Estate Planning', description: 'Simplified succession and transfer' },
      { title: 'Exchange Control', description: 'Advantages over direct offshore investing' },
    ],
    benefits: ['Global investment exposure', 'Tax-efficient structure', 'Currency diversification', 'Estate planning benefits', 'Exchange control advantages'],
    image: offshoreEndowmentsImage,
    imageKey: 'cdaed82d69fb87a2a9ba8ab94b6ed69c92ae131f',
  },
};

// ── Business products ─────────────────────────────────────────────────────────

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'corporate': Building,
  'cash-management': TrendingUp,
  'treasury': Briefcase,
};

const businessToggleOptions = [
  { id: 'corporate', label: 'Corporate Funds' },
  { id: 'cash-management', label: 'Cash Management' },
  { id: 'treasury', label: 'Treasury Management' },
];

const businessProducts: Record<string, CoverContent> = {
  'corporate': {
    title: 'Corporate Investments',
    description: 'Professional management of company surplus funds and cash reserves.',
    benefitsDescription: 'Corporate investment management optimizes returns on company surplus funds while maintaining appropriate liquidity for operational requirements. Our approach balances growth objectives with capital preservation, ensuring corporate cash generates meaningful returns without compromising business operations.',
    features: [
      { title: 'Return Optimisation', description: 'Maximise returns on surplus corporate funds' },
      { title: 'Professional Management', description: 'Dedicated fund management expertise' },
      { title: 'Liquidity Solutions', description: 'Balance growth with operational needs' },
      { title: 'Performance Reporting', description: 'Regular detailed investment reports' },
    ],
    benefits: ['Enhanced corporate returns', 'Professional fund management', 'Liquidity management solutions', 'Risk-adjusted strategies', 'Regular performance reporting'],
    image: corporateImage,
    imageKey: '76fc906be4d2c342ff5272cc2c0d901ad65ff7f6',
  },
  'cash-management': {
    title: 'Cash Management',
    description: 'Optimize business cash flows and maximize returns on idle corporate funds.',
    benefitsDescription: 'Cash management solutions help businesses optimize their cash positions while maintaining liquidity for operational needs. Our approach ensures that idle funds generate competitive returns through money market instruments, call deposits, and short-term fixed income securities, while maintaining immediate access when cash is required.',
    features: [
      { title: 'Idle Cash Returns', description: 'Competitive rates on overnight and call deposits' },
      { title: 'Operational Liquidity', description: 'Immediate access when cash is needed' },
      { title: 'Money Market', description: 'Short-term fixed income instruments' },
      { title: 'Cash Optimisation', description: 'Professional cash flow management' },
    ],
    benefits: ['Maximize returns on idle cash', 'Maintain operational liquidity', 'Short-term investment solutions', 'Daily access to funds', 'Professional cash optimization'],
    image: cashManagementImage,
    imageKey: 'c9d654dd575becaa809d4d9ce31d124144ee1c67',
  },
  'treasury': {
    title: 'Treasury Management',
    description: 'Strategic management of business cash flows and working capital.',
    benefitsDescription: 'Treasury management provides sophisticated cash flow optimization and working capital solutions for businesses. Our approach ensures optimal liquidity management while maximizing returns on excess cash, supporting business operations and growth initiatives through strategic financial planning.',
    features: [
      { title: 'Cash Flow Planning', description: 'Strategic cash flow forecasting and management' },
      { title: 'Working Capital', description: 'Optimise working capital efficiency' },
      { title: 'Risk Management', description: 'Manage liquidity and interest rate risk' },
      { title: 'Growth Support', description: 'Capital allocation for business initiatives' },
    ],
    benefits: ['Cash flow optimization', 'Working capital efficiency', 'Liquidity risk management', 'Return enhancement strategies', 'Operational support solutions'],
    image: treasuryImage,
    imageKey: '58e37d5523feb65e353e0ac15275fd8643fc65e9',
  },
};

// ── Page Component ────────────────────────────────────────────────────────────

export function InvestmentManagementPage() {
  useImagePreload([
    investmentGrowthImage,
    unitTrustImage, taxFreeSavingsImage, offshoreUnitTrustsImage, endowmentsImage, offshoreEndowmentsImage,
    corporateImage, cashManagementImage, treasuryImage,
  ]);

  const seoData = getSEOData('investment-management');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'investment-management',
        hero: {
          badgeText: 'Investment Management Solutions',
          titleLine1: 'Grow Your Wealth',
          titleLine2: 'Professionally',
          description: 'Expert investment management to build and preserve your wealth over time — with access to South Africa\'s leading fund managers.',
          heroImage: investmentGrowthImage,
          heroImageKey: 'investment-hero',
          heroImageAlt: 'Investment growth concept showing stacked coins with growing plant representing wealth growth and investment protection',
          statusLabel: 'Investment Status',
          statusValue: 'Individuals & Businesses',
          quoteLink: '/get-quote/investment-management/contact',
          heroStyle: 'unified',
          stats: [
            { value: '10+', label: 'Fund Managers' },
            { value: '5', label: 'Investment Types' },
            { value: '3', label: 'Business Solutions' },
          ],
        },
        individuals: {
          badgeText: 'For Individuals',
          title: 'Investment Solutions for Individuals',
          subtitle: 'Professional investment management tailored to your goals and risk profile.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: {
            'unit-trust': 'Unit trust portfolio diversification and professional fund management',
            'tax-free-savings': 'Tax free savings account growth with zero tax on returns',
            'offshore-unit-trusts': 'Global offshore investment exposure across international markets',
            'endowments': 'Endowment policy tax efficiency and estate planning benefits',
            'offshore-endowments': 'Offshore endowment combining global exposure with tax efficiency',
          },
          cardIcon: TrendingUp,
          cardLabel: 'Personal Investments',
          quoteLink: '/get-quote/investment-management/contact',
        },
        business: {
          badgeText: 'For Businesses',
          title: 'Investment Management for Businesses',
          subtitle: 'Strategic investment solutions to optimize corporate finances.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: {
            'corporate': 'Corporate investment management and surplus fund optimisation',
            'cash-management': 'Business cash management and idle funds optimisation',
            'treasury': 'Treasury management and working capital solutions',
          },
          cardIcon: Briefcase,
          cardLabel: 'Business Investments',
          quoteLink: '/get-quote/investment-management/contact',
        },
        partners: {
          logos: partnerLogos,
          heading: "We work with South Africa's leading investment managers",
          subHeading: 'Trusted Investment Partners',
        },
        form: {
          specialistType: 'investment',
          selectLabel: 'Investment Goal',
          selectPlaceholder: 'Select investment goal',
          selectFieldName: 'investmentGoal',
          selectOptions: [
            { value: 'unit-trusts', label: 'Unit Trust Portfolios' },
            { value: 'discretionary', label: 'Discretionary Portfolio' },
            { value: 'offshore', label: 'Offshore Investments' },
            { value: 'shares', label: 'Share Portfolio' },
            { value: 'fixed-income', label: 'Fixed Income' },
            { value: 'corporate', label: 'Corporate Investments' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your investment goals and risk tolerance...',
        },
        structuredDataServiceName: 'Investment Management',
        structuredDataServiceType: 'Investment Advisory',
        structuredDataOffers: [
          { name: 'Unit Trusts', description: 'Professionally managed collective investment schemes with diversified portfolios.' },
          { name: 'Tax Free Savings', description: 'Tax-efficient accounts with R36,000 annual and R500,000 lifetime limits.' },
          { name: 'Offshore Unit Trusts', description: 'Global investment exposure through international unit trust funds.' },
          { name: 'Endowments', description: 'Tax-efficient investment wrappers with estate planning benefits.' },
          { name: 'Offshore Endowments', description: 'International endowment structures with global exposure and tax efficiency.' },
          { name: 'Corporate Investments', description: 'Professional management of company surplus funds.' },
          { name: 'Cash Management', description: 'Optimize business cash flows and maximize returns on idle funds.' },
          { name: 'Treasury Management', description: 'Strategic management of business cash flows and working capital.' },
        ],
        breadcrumbs: [
          { name: 'Home', url: 'https://www.navigatewealth.co' },
          { name: 'Services', url: 'https://www.navigatewealth.co/services' },
          { name: 'Investment Management' },
        ],
        preloadImages: [investmentGrowthImage, unitTrustImage, taxFreeSavingsImage, offshoreUnitTrustsImage, endowmentsImage, offshoreEndowmentsImage, corporateImage, cashManagementImage, treasuryImage],
        faqs: investmentManagementFAQs,
        approach: {
          serviceName: 'How We Manage Your Investments',
          headerDescription: 'At Navigate Wealth, we follow a proven methodology to ensure your investment strategy aligns with your financial goals, risk appetite, and time horizon.',
          steps: [
            {
              step: '1',
              title: 'Analyse & Profile',
              icon: Search,
              description: 'We conduct a comprehensive analysis of your financial goals, risk tolerance, and investment time horizon.',
              details: ['Financial goals assessment', 'Risk profiling', 'Time horizon mapping', 'Current portfolio review', 'Liquidity needs analysis'],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Strategy Development',
              icon: MessageSquare,
              description: 'Based on your profile, we design a tailored investment strategy with optimal asset allocation across multiple providers.',
              details: ['Asset allocation design', 'Provider comparison', 'Fee optimisation', 'Tax-efficient structuring', 'Diversification strategy'],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Execute & Monitor',
              icon: CheckCircle2,
              description: 'We implement your strategy and provide ongoing monitoring with regular reviews to ensure continued alignment with your goals.',
              details: ['Portfolio implementation', 'Performance monitoring', 'Regular rebalancing', 'Quarterly reviews', 'Ongoing advice and support'],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We only proceed when you fully understand your investment strategy and are completely satisfied with the approach. Your financial goals drive every decision we make.',
        },
      }}
    />
  );
}

export default InvestmentManagementPage;
