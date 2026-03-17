/**
 * FinancialPlanningPage — Migrated to ServicePageTemplate.
 *
 * Previously used ProductPageTemplate (breadcrumb-based, purple theme).
 * Now uses the shared ServicePageTemplate for full visual consistency
 * with all other service pages (split-panel hero, tabbed sections,
 * approach, tailored solutions, partner marquee, FAQ, form, modals).
 */

import React from 'react';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import {
  ClipboardList,
  Target,
  TrendingUp,
  Calculator,
  PieChart,
  Shield,
  Heart,
  Home,
  Briefcase,
  Building,
  Users,
  Search,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  allanGrayLogo,
  sanlamLogo,
  momentumLogo,
  oldMutualLogo,
  libertyLogo,
  discoveryLogo,
  stanlibLogo,
} from '../shared/assets/provider-logos';

// ── Images ────────────────────────────────────────────────────────────────────

const heroImage = 'https://images.unsplash.com/photo-1765438864227-288900d09d26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBwbGFubmluZyUyMHN0cmF0ZWd5JTIwY29uc3VsdGF0aW9ufGVufDF8fHx8MTc3MjMyNDkyOXww&ixlib=rb-4.1.0&q=80&w=1080';
const comprehensiveImage = 'https://images.unsplash.com/photo-1635322039171-4b9f2e0d5337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWFsdGglMjBtYW5hZ2VtZW50JTIwcG9ydGZvbGlvJTIwcmV2aWV3fGVufDF8fHx8MTc3MjMyNDkzMHww&ixlib=rb-4.1.0&q=80&w=1080';
const investmentImage = 'https://images.unsplash.com/photo-1768055104929-cf2317674a80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnZlc3RtZW50JTIwZ3Jvd3RoJTIwY2hhcnQlMjBhbmFseXNpc3xlbnwxfHx8fDE3NzIzMjQ5MzB8MA&ixlib=rb-4.1.0&q=80&w=1080';
const retirementImage = 'https://images.unsplash.com/photo-1758686254493-d73c9c2a3049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRpcmVtZW50JTIwc2F2aW5ncyUyMHBsYW5uaW5nJTIwY291cGxlfGVufDF8fHx8MTc3MjMyNDkzMXww&ixlib=rb-4.1.0&q=80&w=1080';
const taxImage = 'https://images.unsplash.com/photo-1753955900083-b62ee8d97805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXglMjBjYWxjdWxhdGlvbiUyMGRvY3VtZW50cyUyMGFjY291bnRpbmd8ZW58MXx8fHwxNzcyMzI0OTMxfDA&ixlib=rb-4.1.0&q=80&w=1080';
const debtImage = 'https://images.unsplash.com/photo-1765868017186-18a3fc4c2942?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWJ0JTIwbWFuYWdlbWVudCUyMGZpbmFuY2lhbCUyMGRvY3VtZW50c3xlbnwxfHx8fDE3NzIzMjQ5MzF8MA&ixlib=rb-4.1.0&q=80&w=1080';
const estateImage = 'https://images.unsplash.com/photo-1766973305733-368e4604ce37?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlc3RhdGUlMjBwbGFubmluZyUyMGZhbWlseSUyMGxlZ2FjeXxlbnwxfHx8fDE3NzIzMjQ5MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080';
const corporateImage = 'https://images.unsplash.com/photo-1758518729711-1cbacd55efdb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBmaW5hbmNpYWwlMjB0ZWFtJTIwbWVldGluZ3xlbnwxfHx8fDE3NzIzMjQ5MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080';
const cfoImage = 'https://images.unsplash.com/photo-1574884280706-7342ca3d4231?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGZpbmFuY2UlMjBDRk8lMjBzdHJhdGVneXxlbnwxfHx8fDE3NzIzMjQ5MzN8MA&ixlib=rb-4.1.0&q=80&w=1080';
const cashflowImage = 'https://images.unsplash.com/photo-1766503498598-494939f8d3b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXNoZmxvdyUyMG1hbmFnZW1lbnQlMjBidXNpbmVzc3xlbnwxfHx8fDE3NzIzMjQ5MzN8MA&ixlib=rb-4.1.0&q=80&w=1080';

// ── Partner logos ─────────────────────────────────────────────────────────────

const partnerLogos = [
  { id: 'sanlam',     name: 'Sanlam',     logo: sanlamLogo,     est: '1918' },
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo, est: '1973' },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo, est: '1845' },
  { id: 'momentum',   name: 'Momentum',   logo: momentumLogo,   est: '1966' },
  { id: 'liberty',    name: 'Liberty',    logo: libertyLogo,    est: '1957' },
  { id: 'discovery',  name: 'Discovery',  logo: discoveryLogo,  est: '1992' },
  { id: 'stanlib',    name: 'Stanlib',    logo: stanlibLogo,    est: '1974' },
];

// ── Tab icons ─────────────────────────────────────────────────────────────────

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'comprehensive': ClipboardList,
  'investment':    TrendingUp,
  'retirement':    Target,
  'tax':           Calculator,
  'debt':          PieChart,
  'estate':        Home,
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'corporate':  Building,
  'executive':  Users,
  'cashflow':   Briefcase,
};

// ── Individual products ───────────────────────────────────────────────────────

const individualToggleOptions = [
  { id: 'comprehensive', label: 'Comprehensive' },
  { id: 'investment',    label: 'Investments' },
  { id: 'retirement',    label: 'Retirement' },
  { id: 'tax',           label: 'Tax Planning' },
  { id: 'debt',          label: 'Debt Strategy' },
  { id: 'estate',        label: 'Estate' },
];

const individualProducts: Record<string, CoverContent> = {
  'comprehensive': {
    title: 'Comprehensive Financial Planning',
    description: 'A complete strategy covering all aspects of your financial life from budgeting to estate planning.',
    benefitsDescription: 'Our comprehensive financial planning service takes a holistic view of your finances. We assess your current position, define your goals, and build a personalised strategy that integrates investments, retirement savings, risk cover, tax efficiency, and estate planning into a single, coherent roadmap.',
    features: [
      { title: 'Financial Assessment', description: 'Complete analysis of your current financial position' },
      { title: 'Goal-Based Strategy', description: 'Plans designed around your life objectives' },
      { title: 'Cash Flow Optimisation', description: 'Maximise savings from existing income' },
      { title: 'Regular Reviews', description: 'Annual reviews to adapt to changing circumstances' },
    ],
    benefits: [
      'Holistic financial strategy',
      'Aligned to your life goals',
      'Regular plan reviews',
      'Tax-efficient structuring',
      'Independent product selection',
    ],
    image: comprehensiveImage,
  },
  'investment': {
    title: 'Investment Strategy Planning',
    description: 'Customised investment strategies aligned with your risk tolerance and financial goals.',
    benefitsDescription: 'We design tailored investment strategies that match your risk appetite, time horizon, and growth objectives. Our independent approach means we select from the full range of available products — unit trusts, tax-free savings, offshore investments, and more — to build the optimal portfolio for your needs.',
    features: [
      { title: 'Asset Allocation', description: 'Strategic distribution across asset classes' },
      { title: 'Diversification', description: 'Spread risk across geographies and sectors' },
      { title: 'Risk Management', description: 'Portfolio aligned to your risk tolerance' },
      { title: 'Performance Tracking', description: 'Ongoing monitoring and rebalancing' },
    ],
    benefits: [
      'Tailored asset allocation',
      'Multi-provider portfolio',
      'Risk-adjusted returns',
      'Regular rebalancing',
      'Transparent fee structure',
    ],
    image: investmentImage,
  },
  'retirement': {
    title: 'Retirement Planning',
    description: 'Strategic planning to ensure you can maintain your desired lifestyle in retirement.',
    benefitsDescription: 'Our retirement planning service projects your future income needs, evaluates your current savings trajectory, and builds a strategy to close any gaps. We structure retirement annuities, preservation funds, and living annuities to maximise tax efficiency and ensure long-term income security.',
    features: [
      { title: 'Income Projections', description: 'Detailed modelling of retirement income needs' },
      { title: 'Pension Optimisation', description: 'Maximise contributions and tax deductions' },
      { title: 'Post-Retirement Planning', description: 'Living annuity vs guaranteed annuity analysis' },
      { title: 'Healthcare Costs', description: 'Plan for medical expenses in retirement' },
    ],
    benefits: [
      'Clear retirement income target',
      'Tax-efficient contributions',
      'Optimal annuity selection',
      'Healthcare cost planning',
      'Regular progress reviews',
    ],
    image: retirementImage,
  },
  'tax': {
    title: 'Tax Planning & Optimisation',
    description: 'Minimise your tax burden through strategic planning and investment structuring.',
    benefitsDescription: 'Tax planning is integral to every financial decision. We work alongside your tax practitioner to ensure your investments, retirement savings, and estate plan are structured to minimise income tax, capital gains tax, and estate duty — all while remaining fully compliant with SARS regulations.',
    features: [
      { title: 'Tax-Efficient Structures', description: 'Endowments, TFSAs, and retirement vehicles' },
      { title: 'Capital Gains Planning', description: 'Minimise CGT on disposals and transfers' },
      { title: 'Estate Duty Strategy', description: 'Reduce estate duty through trusts and donations' },
      { title: 'Annual Tax Review', description: 'Optimise deductions every tax year' },
    ],
    benefits: [
      'Lower effective tax rate',
      'Capital gains minimisation',
      'Estate duty reduction',
      'Annual deduction optimisation',
      'SARS-compliant structures',
    ],
    image: taxImage,
  },
  'debt': {
    title: 'Debt Management Planning',
    description: 'Strategic debt management and elimination plans to improve your financial position.',
    benefitsDescription: 'Effective debt management accelerates your path to financial freedom. We assess all outstanding debts, prioritise repayment strategies, negotiate better terms where possible, and integrate debt elimination into your broader financial plan — freeing up capital for wealth-building.',
    features: [
      { title: 'Debt Consolidation', description: 'Simplify multiple debts into manageable payments' },
      { title: 'Interest Optimisation', description: 'Reduce overall interest costs' },
      { title: 'Payment Prioritisation', description: 'Target high-cost debt first' },
      { title: 'Credit Improvement', description: 'Strategies to rebuild your credit profile' },
    ],
    benefits: [
      'Structured repayment plan',
      'Lower total interest cost',
      'Improved credit score',
      'Faster path to debt-free',
      'Integrated with wealth strategy',
    ],
    image: debtImage,
  },
  'estate': {
    title: 'Estate Planning Integration',
    description: 'Protect and transfer your wealth according to your wishes.',
    benefitsDescription: 'Your financial plan must include provisions for the transfer of wealth to the next generation. We integrate will preparation, trust structures, and beneficiary optimisation into your comprehensive plan — ensuring your legacy is protected and estate duty is minimised.',
    features: [
      { title: 'Will Preparation', description: 'Legally sound wills and codicils' },
      { title: 'Trust Structures', description: 'Inter vivos and testamentary trusts' },
      { title: 'Beneficiary Planning', description: 'Optimal nomination across all policies' },
      { title: 'Duty Minimisation', description: 'Strategies to reduce estate duty liability' },
    ],
    benefits: [
      'Up-to-date valid will',
      'Appropriate trust structures',
      'Optimised beneficiary nominations',
      'Reduced estate duty',
      'Smooth wealth transfer',
    ],
    image: estateImage,
  },
};

const individualImageAltMap: Record<string, string> = {
  'comprehensive': 'Comprehensive financial planning strategy session',
  'investment':    'Investment portfolio review and asset allocation',
  'retirement':    'Retirement savings planning and income modelling',
  'tax':           'Tax planning documents and calculation',
  'debt':          'Debt management and financial document review',
  'estate':        'Estate planning and family legacy preservation',
};

// ── Business products ─────────────────────────────────────────────────────────

const businessToggleOptions = [
  { id: 'corporate',  label: 'Corporate Planning' },
  { id: 'executive',  label: 'Executive Wealth' },
  { id: 'cashflow',   label: 'Cash Flow Strategy' },
];

const businessProducts: Record<string, CoverContent> = {
  'corporate': {
    title: 'Corporate Financial Planning',
    description: 'Strategic financial planning for businesses to optimise growth, manage risk, and maximise shareholder value.',
    benefitsDescription: 'Our corporate financial planning service helps businesses develop comprehensive strategies that align financial resources with business objectives. We assess capital structure, evaluate growth opportunities, and design risk management frameworks that protect and enhance business value.',
    features: [
      { title: 'Capital Strategy', description: 'Optimal capital structure and funding' },
      { title: 'Growth Planning', description: 'Financial modelling for expansion' },
      { title: 'Risk Framework', description: 'Enterprise risk assessment and mitigation' },
      { title: 'Shareholder Value', description: 'Strategies to maximise returns' },
    ],
    benefits: [
      'Aligned financial and business strategy',
      'Optimised capital allocation',
      'Structured growth roadmap',
      'Reduced financial risk',
      'Enhanced stakeholder confidence',
    ],
    image: corporateImage,
  },
  'executive': {
    title: 'Executive Wealth Planning',
    description: 'Personalised financial strategies for executives and key personnel.',
    benefitsDescription: 'Executive wealth planning addresses the unique financial needs of senior leaders — complex remuneration packages, share options, tax-efficient structuring, and succession considerations. We build bespoke strategies that protect and grow executive wealth across all financial dimensions.',
    features: [
      { title: 'Remuneration Analysis', description: 'Optimise salary, bonuses, and share options' },
      { title: 'Tax Structuring', description: 'Minimise tax on complex income sources' },
      { title: 'Wealth Protection', description: 'Ring-fence personal assets from business risk' },
      { title: 'Succession Planning', description: 'Smooth leadership and wealth transitions' },
    ],
    benefits: [
      'Optimised executive remuneration',
      'Tax-efficient wealth structuring',
      'Personal asset protection',
      'Integrated succession plan',
      'Confidential advisory service',
    ],
    image: cfoImage,
  },
  'cashflow': {
    title: 'Cash Flow Strategy',
    description: 'Optimise business cash flows, working capital, and surplus fund management.',
    benefitsDescription: 'Effective cash flow management is critical to business sustainability. We help businesses forecast cash requirements, optimise working capital cycles, and invest surplus funds productively — ensuring liquidity while maximising returns on idle capital.',
    features: [
      { title: 'Cash Forecasting', description: 'Accurate short- and long-term projections' },
      { title: 'Working Capital', description: 'Optimise debtor/creditor cycles' },
      { title: 'Surplus Management', description: 'Invest idle funds for optimal returns' },
      { title: 'Liquidity Planning', description: 'Ensure adequate operational reserves' },
    ],
    benefits: [
      'Accurate cash flow forecasts',
      'Optimised working capital',
      'Higher returns on surplus funds',
      'Adequate liquidity reserves',
      'Reduced funding costs',
    ],
    image: cashflowImage,
  },
};

const businessImageAltMap: Record<string, string> = {
  'corporate':  'Corporate financial team strategic planning meeting',
  'executive':  'Executive wealth planning and business finance strategy',
  'cashflow':   'Cash flow management and working capital optimisation',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function FinancialPlanningPage() {
  const seoData = getSEOData('financial-planning');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'financial-planning',

        hero: {
          badgeText: 'Financial Planning',
          titleLine1: 'Your Roadmap to',
          titleLine2: 'Financial Success',
          description: 'Comprehensive financial planning that aligns your money with your life goals. We create personalised strategies covering investments, retirement, tax, and estate planning.',
          heroImage: heroImage,
          heroImageAlt: 'Financial planning strategy consultation with professional adviser',
          statusLabel: 'Planning Status',
          statusValue: 'Individuals & Businesses',
          stats: [
            { value: '6', label: 'Planning Areas' },
            { value: '7+', label: 'Partner Providers' },
            { value: '3', label: 'Business Solutions' },
          ],
          quoteLink: '/get-quote/financial-planning',
          heroStyle: 'unified',
        },

        individuals: {
          badgeText: 'For Individuals',
          title: 'Financial Planning for Individuals',
          subtitle: 'Personalised strategies covering every aspect of your financial life.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: individualImageAltMap,
          cardIcon: ClipboardList,
          cardLabel: 'Personal Planning',
          quoteLink: '/get-quote/risk-management',
          ariaLabel: 'Financial planning for individuals',
        },

        business: {
          badgeText: 'For Businesses',
          title: 'Financial Planning for Businesses',
          subtitle: 'Strategic financial frameworks to optimise growth, manage risk, and maximise value.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: businessImageAltMap,
          cardIcon: Briefcase,
          cardLabel: 'Business Planning',
          quoteLink: '/get-quote/employee-benefits',
          ariaLabel: 'Financial planning for businesses',
        },

        partners: {
          logos: partnerLogos,
          heading: 'We work with South Africa\'s leading financial institutions',
          subHeading: 'Professional Financial Planning Partners',
        },

        form: {
          specialistType: 'financial planning',
          selectLabel: 'Planning Need',
          selectPlaceholder: 'Select your need',
          selectOptions: [
            { value: 'comprehensive', label: 'Comprehensive Financial Plan' },
            { value: 'investment', label: 'Investment Strategy' },
            { value: 'retirement', label: 'Retirement Planning' },
            { value: 'tax', label: 'Tax Optimisation' },
            { value: 'debt', label: 'Debt Management' },
            { value: 'estate', label: 'Estate Planning' },
            { value: 'corporate', label: 'Corporate Planning' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your financial goals and current situation...',
          selectFieldName: 'planningNeed',
        },

        structuredDataOffers: [
          { name: 'Comprehensive Financial Planning', description: 'Complete financial strategy covering investments, retirement, tax, and estate planning.' },
          { name: 'Investment Strategy Planning', description: 'Customised investment strategies aligned with risk tolerance and financial goals.' },
          { name: 'Retirement Planning', description: 'Strategic retirement planning to maintain your desired lifestyle in retirement.' },
          { name: 'Tax Planning & Optimisation', description: 'Tax-efficient structuring of investments, retirement savings, and estate plans.' },
          { name: 'Debt Management Planning', description: 'Strategic debt elimination and credit improvement plans.' },
          { name: 'Estate Planning Integration', description: 'Wills, trusts, and beneficiary planning integrated into your financial strategy.' },
          { name: 'Corporate Financial Planning', description: 'Strategic financial planning for businesses to optimise growth and manage risk.' },
          { name: 'Executive Wealth Planning', description: 'Personalised financial strategies for executives and key personnel.' },
        ],
        structuredDataServiceType: 'Financial Planning Advisory',
        structuredDataServiceName: 'Comprehensive Financial Planning',
        breadcrumbs: [
          { name: 'Home', url: 'https://navigatewealth.co' },
          { name: 'Financial Planning' },
        ],
        preloadImages: [],

        approach: {
          serviceName: 'How We Build Your Financial Plan',
          headerDescription: 'A proven methodology to create a comprehensive strategy that aligns your money with your life goals.',
          steps: [
            {
              step: '1',
              title: 'Discover & Assess',
              icon: Search,
              description: 'We begin with a thorough assessment of your current financial position, goals, risk tolerance, and life circumstances.',
              details: [
                'Complete financial audit',
                'Goal identification and prioritisation',
                'Risk tolerance profiling',
                'Current product review',
                'Cash flow analysis',
              ],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Design & Recommend',
              icon: MessageSquare,
              description: 'We design a personalised financial strategy across all six planning areas, selecting the best products from the full market.',
              details: [
                'Integrated strategy design',
                'Product and provider selection',
                'Tax-efficient structuring',
                'Risk management integration',
                'Scenario modelling',
              ],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement & Review',
              icon: CheckCircle2,
              description: 'We implement your plan, monitor progress, and conduct regular reviews to keep your strategy aligned with your evolving life.',
              details: [
                'Seamless implementation',
                'Performance monitoring',
                'Annual plan reviews',
                'Life-event adjustments',
                'Ongoing advisory support',
              ],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We only proceed when you fully understand your financial plan and are completely satisfied with every recommendation. Your financial success is our priority.',
        },
      }}
    />
  );
}