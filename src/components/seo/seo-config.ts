/**
 * SEO Configuration
 *
 * Centralised SEO metadata for all public-facing pages.
 * Each entry provides the title, description, keywords, canonical URL,
 * and Open Graph type used by the SEO component.
 */

const BASE_URL = 'https://navigatewealth.co';

export interface SEOPageData {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: string;
}

const seoPages: Record<string, SEOPageData> = {
  home: {
    title: 'Navigate Wealth | Independent Financial Advisors in South Africa',
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
    title: 'Risk Management Insurance | Life, Disability & Income Protection | Navigate Wealth',
    description:
      'Independent risk management advice for individuals and businesses in South Africa. Life cover, disability cover, severe illness, income protection and business insurance solutions from leading insurers.',
    keywords:
      'risk management South Africa, life cover, disability insurance, income protection, severe illness cover, business insurance, buy and sell agreement, key person insurance, life insurance South Africa, independent insurance advisor, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/risk-management`,
    ogType: 'website',
  },
  'medical-aid': {
    title: 'Medical Aid & Health Insurance | Navigate Wealth',
    description:
      'Independent medical aid advice for individuals and businesses in South Africa. Comprehensive plans, hospital plans, savings plans, group schemes, and corporate wellness from leading medical schemes.',
    keywords:
      'medical aid South Africa, health insurance, hospital plan, medical savings, gap cover, group medical scheme, corporate wellness, Discovery Health, Momentum Health, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/medical-aid`,
    ogType: 'website',
  },
  'investment-management': {
    title: 'Investment Management | Unit Trusts, Offshore & Tax-Free Savings | Navigate Wealth',
    description:
      'Professional investment management for individuals and businesses in South Africa. Unit trusts, tax-free savings, offshore investments, endowments, corporate funds, and cash management solutions.',
    keywords:
      'investment management South Africa, unit trusts, tax free savings account, offshore investments, endowments, corporate investments, wealth management, Allan Gray, Sygnia, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/investment-management`,
    ogType: 'website',
  },
  'retirement-planning': {
    title: 'Retirement Planning | Annuities, Pension & Provident Funds | Navigate Wealth',
    description:
      'Comprehensive retirement planning for individuals and businesses in South Africa. Retirement annuities, preservation funds, living annuities, pension funds, and provident funds from leading providers.',
    keywords:
      'retirement planning South Africa, retirement annuity, living annuity, pension fund, provident fund, preservation fund, retirement savings, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/retirement-planning`,
    ogType: 'website',
  },
  'tax-planning': {
    title: 'Tax Planning & Optimisation | Navigate Wealth',
    description:
      'Expert tax planning and optimisation for individuals and businesses in South Africa. Tax-efficient structures, estate duty planning, capital gains management, and corporate tax strategies.',
    keywords:
      'tax planning South Africa, tax optimisation, estate duty, capital gains tax, corporate tax, tax-free savings, tax deductions, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/tax-planning`,
    ogType: 'website',
  },
  'estate-planning': {
    title: 'Estate Planning | Wills, Trusts & Succession | Navigate Wealth',
    description:
      'Comprehensive estate planning for individuals and businesses in South Africa. Wills, trusts, succession planning, estate duty optimisation, and business continuity from accredited specialists.',
    keywords:
      'estate planning South Africa, wills, trusts, succession planning, estate duty, inheritance, business succession, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/estate-planning`,
    ogType: 'website',
  },
  'employee-benefits': {
    title: 'Employee Benefits | Group Risk, Retirement & Health | Navigate Wealth',
    description:
      'Tailored employee benefits solutions for businesses in South Africa. Group risk cover, retirement funds, medical aid schemes, and wellness programmes from leading providers.',
    keywords:
      'employee benefits South Africa, group risk cover, group retirement fund, group medical aid, corporate wellness, employee wellness, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/services/employee-benefits`,
    ogType: 'website',
  },
  'financial-planning': {
    title: 'Financial Planning | Comprehensive Wealth Strategy | Navigate Wealth',
    description:
      'Independent financial planning for individuals and businesses in South Africa. Comprehensive strategies covering investments, retirement, tax optimisation, estate planning, and debt management.',
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
    canonicalUrl: `${BASE_URL}/for-individuals`,
    ogType: 'website',
  },
  'for-businesses': {
    title: 'Financial Solutions for Businesses | Navigate Wealth',
    description:
      'Corporate financial services for businesses in South Africa. Employee benefits, group risk cover, business insurance, corporate investments, and tax planning from independent advisors.',
    keywords:
      'business financial planning, corporate wealth management, employee benefits, group risk cover, business insurance, corporate investments, South Africa, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/for-businesses`,
    ogType: 'website',
  },
  'for-advisers': {
    title: 'For Financial Advisers | Partner with Navigate Wealth',
    description:
      'Join Navigate Wealth as an independent financial adviser. Access our technology platform, compliance support, product range, and collaborative network across South Africa.',
    keywords:
      'financial adviser partnership, independent adviser network, financial services franchise, adviser support platform, Navigate Wealth partnership, South Africa',
    canonicalUrl: `${BASE_URL}/for-advisers`,
    ogType: 'website',
  },
  'products-services': {
    title: 'Products & Services | Navigate Wealth',
    description:
      'Explore the full range of financial products and services offered by Navigate Wealth. From risk management and investments to retirement planning and employee benefits across South Africa.',
    keywords:
      'financial products South Africa, financial services, insurance products, investment products, retirement products, Navigate Wealth',
    canonicalUrl: `${BASE_URL}/products-services`,
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
};

/**
 * Retrieve SEO metadata for a given page identifier.
 * Falls back to the home page data when the key is not found.
 */
export function getSEOData(page: string): SEOPageData {
  return seoPages[page] || seoPages.home;
}

/**
 * Common FAQ entries used for structured data on the homepage.
 */
export const commonFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What services does Navigate Wealth offer?',
    answer:
      'Navigate Wealth offers comprehensive financial planning services including investment management, retirement planning, risk management, tax planning, estate planning, and employee benefits consulting.',
  },
  {
    question: 'Is Navigate Wealth an independent financial advisor?',
    answer:
      'Yes. Navigate Wealth is a fully independent financial advisory firm. We are not tied to any single product provider, which means we can recommend the best solutions from across the market for your unique needs.',
  },
  {
    question: 'How do I get started with Navigate Wealth?',
    answer:
      'Getting started is easy. Simply contact us to schedule a free, no-obligation consultation. During this meeting we will discuss your financial goals, assess your current situation, and outline a personalised plan to help you achieve financial independence.',
  },
  {
    question: 'Does Navigate Wealth operate across South Africa?',
    answer:
      'Yes. While our offices are based in South Africa, we serve clients nationwide through both in-person and virtual consultations.',
  },
  {
    question: 'What makes Navigate Wealth different from other financial advisors?',
    answer:
      'Our independence, personalised approach, and commitment to long-term relationships set us apart. We focus on understanding your unique circumstances and goals, leveraging a wide range of product providers to build a strategy that truly works for you.',
  },
];

/**
 * Risk Management FAQ entries used for structured data on the risk management page.
 * These target common search intent questions to qualify for Google FAQ rich results.
 */
export const riskManagementFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What is risk management insurance in South Africa?',
    answer:
      'Risk management insurance in South Africa refers to a range of personal and business insurance products designed to protect you financially against unforeseen events. This includes life cover, disability cover, severe illness cover, income protection, and business assurance products such as key person insurance and buy-and-sell agreements.',
  },
  {
    question: 'How much life cover do I need in South Africa?',
    answer:
      'The amount of life cover you need depends on your income, outstanding debts, dependants, and financial goals. A general starting point is 10–12 times your annual income, but a qualified independent financial advisor can calculate a precise figure based on your unique circumstances. Navigate Wealth provides free, no-obligation consultations to help you determine the right level of cover.',
  },
  {
    question: 'What is the difference between disability cover and income protection?',
    answer:
      'Disability cover (capital disability) pays a once-off lump sum if you become permanently disabled and unable to work. Income protection pays a monthly benefit — typically up to 75% of your gross income — for as long as you remain unable to work, up to retirement age. Many advisors recommend having both to cover both immediate capital needs and ongoing living expenses.',
  },
  {
    question: 'What does severe illness cover pay out for?',
    answer:
      'Severe illness cover (also called critical illness cover) pays a tax-free lump sum if you are diagnosed with a covered condition such as cancer, heart attack, stroke, organ failure, or other serious medical events. The funds can be used for any purpose — medical treatment, rehabilitation, debt repayment, or lifestyle adjustments — giving you financial flexibility during recovery.',
  },
  {
    question: 'Do I need business insurance if I am a business owner in South Africa?',
    answer:
      'Yes. Business owners face unique risks that personal insurance does not address. Key person insurance protects the business against the financial impact of losing a critical employee or director. Buy-and-sell agreements fund the transfer of a deceased partner\'s shares to surviving partners. Contingent liability cover settles guaranteed business debts. Navigate Wealth can structure a comprehensive business risk plan tailored to your specific business structure.',
  },
  {
    question: 'Which insurers does Navigate Wealth work with?',
    answer:
      'Navigate Wealth works with all major South African insurers including Discovery, Sanlam, Momentum, Liberty, Old Mutual, BrightRock, and Hollard. As an independent advisory firm, we are not tied to any single provider and search the full market to find the most appropriate cover at the best premium for your needs.',
  },
];

/**
 * Medical Aid FAQ entries for structured data on the medical aid page.
 */
export const medicalAidFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What is the difference between a comprehensive medical aid and a hospital plan?',
    answer:
      'A comprehensive medical aid covers both in-hospital and day-to-day expenses including doctor visits, chronic medication, and preventative care. A hospital plan only covers major medical events and in-hospital treatment, making it more affordable but requiring you to pay for routine care out of pocket.',
  },
  {
    question: 'How do medical savings accounts work in South Africa?',
    answer:
      'Medical savings plans allocate a portion of your monthly contribution to a personal medical savings account (PMSA). You use this fund for day-to-day expenses like GP visits and medication. Unused savings roll over to the following year. Once your savings are depleted, above-threshold benefits may cover additional costs.',
  },
  {
    question: 'Can my employer provide medical aid as part of my benefits?',
    answer:
      'Yes. Many South African employers offer group medical aid schemes as part of their employee benefits package. Group schemes often provide reduced premiums through employer-negotiated rates and simplified administration through payroll deductions.',
  },
  {
    question: 'What is gap cover and do I need it?',
    answer:
      'Gap cover is a short-term insurance product that pays the difference between what your medical aid pays and what specialists actually charge. Since many specialists charge above medical aid rates, gap cover protects you from significant out-of-pocket expenses during hospitalisation.',
  },
  {
    question: 'Which medical aid schemes does Navigate Wealth work with?',
    answer:
      'Navigate Wealth works with leading South African medical aid schemes including Discovery Health, Momentum Health, and others. As independent advisors, we compare options across the market to find the best plan for your healthcare needs and budget.',
  },
];

/**
 * Investment Management FAQ entries for structured data on the investment management page.
 */
export const investmentManagementFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What is a unit trust and how does it work?',
    answer:
      'A unit trust (collective investment scheme) pools money from multiple investors to buy a diversified portfolio of assets managed by professional fund managers. You buy units in the fund, and the value of your units rises or falls with the underlying assets. Unit trusts offer instant diversification, professional management, and daily liquidity.',
  },
  {
    question: 'How much can I invest in a Tax Free Savings Account in South Africa?',
    answer:
      'You can contribute up to R36,000 per year to a Tax Free Savings Account (TFSA), with a lifetime limit of R500,000. All returns — interest, dividends, and capital gains — are completely tax-free, making TFSAs one of the most powerful wealth-building tools available to South African investors.',
  },
  {
    question: 'What are the benefits of offshore investing?',
    answer:
      'Offshore investing provides currency diversification, protecting your wealth from rand depreciation. It also gives access to global markets and companies not available locally, reduces concentration risk in the South African economy, and can offer superior growth opportunities in developed and emerging markets worldwide.',
  },
  {
    question: 'What is the difference between an endowment and a unit trust?',
    answer:
      'An endowment is a tax-efficient investment wrapper that holds underlying investments (including unit trusts). Endowments are taxed at a flat rate within the policy (lower than most individual marginal tax rates), proceeds bypass your estate on death, and withdrawals after five years may be more tax-efficient. Unit trusts are taxed at your marginal rate.',
  },
  {
    question: 'How does Navigate Wealth select investment providers?',
    answer:
      'Navigate Wealth follows a research-driven approach, evaluating providers including Allan Gray, Sygnia, Discovery, Liberty, Stanlib, INN8, Old Mutual, Sanlam, Momentum, and JUST. We assess fund performance, fees, risk management, and service quality to recommend the optimal combination for each client\'s goals.',
  },
];

/**
 * Retirement Planning FAQ entries for structured data on the retirement planning page.
 */
export const retirementPlanningFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What is a retirement annuity (RA) in South Africa?',
    answer:
      'A retirement annuity is a personal retirement savings vehicle that offers tax deductions on contributions (up to 27.5% of taxable income, capped at R350,000 per year). Funds grow tax-free within the RA and are accessible from age 55. On retirement, up to one-third can be taken as a lump sum and the remainder must purchase an annuity.',
  },
  {
    question: 'What is the difference between a living annuity and a guaranteed annuity?',
    answer:
      'A living annuity allows you to choose your drawdown rate (between 2.5% and 17.5% per year) and your investment portfolio, but the income is not guaranteed and depends on market performance. A guaranteed (life) annuity provides a fixed income for life regardless of market conditions, but you cannot change the terms once purchased.',
  },
  {
    question: 'What happens to my pension fund when I change jobs?',
    answer:
      'When you leave an employer, you can transfer your pension or provident fund benefit to a preservation fund. This maintains the tax-free growth and allows one withdrawal before retirement. Alternatively, you may transfer to a retirement annuity. Cashing out is possible but attracts significant tax and forfeits future growth.',
  },
  {
    question: 'How much should I save for retirement in South Africa?',
    answer:
      'Financial advisors generally recommend saving 15–17% of your gross income throughout your working life to maintain your standard of living in retirement. However, the exact amount depends on your desired retirement age, expected lifestyle, existing savings, and other income sources. A financial needs analysis can determine your specific requirement.',
  },
  {
    question: 'What is a preservation fund?',
    answer:
      'A preservation fund is a retirement savings vehicle that accepts transfers from pension funds, provident funds, or other preservation funds when you leave an employer. It preserves the tax benefits of your retirement savings while allowing one withdrawal before retirement age (55). Funds continue to grow tax-free within the preservation fund.',
  },
];

/**
 * Tax Planning FAQ entries for structured data on the tax planning page.
 */
export const taxPlanningFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What tax deductions are available to individuals in South Africa?',
    answer:
      'South African individuals can claim deductions for retirement fund contributions (up to 27.5% of taxable income, capped at R350,000), medical aid contributions and qualifying medical expenses, donations to approved public benefit organisations (up to 10% of taxable income), and home office expenses if you work from home.',
  },
  {
    question: 'How is capital gains tax calculated in South Africa?',
    answer:
      'Capital gains tax (CGT) is calculated by including a portion of your net capital gain in your taxable income. For individuals, 40% of the net gain is included; for companies, 80%. The first R40,000 of capital gains per year is excluded for individuals. The effective maximum CGT rate for individuals is 18% (45% marginal rate × 40% inclusion).',
  },
  {
    question: 'What is estate duty and how can I reduce it?',
    answer:
      'Estate duty is a tax of 20% on the first R30 million of a deceased estate (above a R3.5 million exemption) and 25% on amounts exceeding R30 million. Strategies to reduce estate duty include making use of the spousal exemption, establishing trusts, making donations during your lifetime, and structuring insurance policies correctly.',
  },
  {
    question: 'How can a business reduce its tax liability in South Africa?',
    answer:
      'Businesses can reduce tax through maximising allowable deductions, using the small business corporation tax incentive, accelerated depreciation allowances, research and development tax incentives, employee share schemes, and strategic retirement fund contributions for employees. Professional tax planning ensures compliance while optimising the tax position.',
  },
  {
    question: 'Does Navigate Wealth provide tax advice?',
    answer:
      'Navigate Wealth provides tax-efficient financial planning and structuring advice. We work alongside your tax practitioner to ensure your investments, retirement savings, and estate plan are structured to minimise your overall tax burden while remaining fully compliant with SARS regulations.',
  },
];

/**
 * Estate Planning FAQ entries for structured data on the estate planning page.
 */
export const estatePlanningFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'Why do I need a will in South Africa?',
    answer:
      'Without a valid will, your estate is distributed according to the Intestate Succession Act, which may not reflect your wishes. A will allows you to specify beneficiaries, appoint a guardian for minor children, nominate an executor, and structure bequests to minimise estate duty. Every adult with assets or dependants should have an up-to-date will.',
  },
  {
    question: 'What is a testamentary trust and when should I use one?',
    answer:
      'A testamentary trust is created in your will and comes into effect on your death. It is commonly used to protect assets for minor children, provide for dependants with special needs, manage assets for beneficiaries who may not be financially responsible, and potentially reduce estate duty on the surviving spouse\'s estate.',
  },
  {
    question: 'What happens to my estate when I die in South Africa?',
    answer:
      'On death, your estate is reported to the Master of the High Court. An executor (nominated in your will or appointed by the Master) administers the estate: settling debts, paying estate duty and taxes, and distributing assets to beneficiaries. This process typically takes 6–12 months but can take longer for complex estates.',
  },
  {
    question: 'How can I plan for business succession?',
    answer:
      'Business succession planning involves buy-and-sell agreements (funded by life insurance), shareholder agreements, key person insurance, and potentially establishing a business trust. The goal is to ensure continuity of the business, fair treatment of the deceased owner\'s heirs, and smooth transfer of ownership without disrupting operations.',
  },
  {
    question: 'How often should I review my estate plan?',
    answer:
      'You should review your estate plan at least every two years, or whenever a significant life event occurs — such as marriage, divorce, the birth of a child, acquiring or selling major assets, changes in tax legislation, or the death of a nominated executor or beneficiary.',
  },
];

/**
 * Employee Benefits FAQ entries for structured data on the employee benefits page.
 */
export const employeeBenefitsFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What employee benefits are most valued by South African employees?',
    answer:
      'Research consistently shows that medical aid, retirement funding, and group life cover are the most valued benefits. Additional benefits like disability cover, funeral cover, education assistance, and wellness programmes are increasingly important for attracting and retaining talent in the competitive South African labour market.',
  },
  {
    question: 'Is it mandatory to provide a pension fund for employees in South Africa?',
    answer:
      'While not universally mandatory, certain industries and bargaining councils require employer-provided retirement funding. From a practical standpoint, offering a retirement fund is essential for employee retention. The proposed mandatory retirement fund reforms (when enacted) will require all employers to provide retirement benefits.',
  },
  {
    question: 'What is the difference between a pension fund and a provident fund?',
    answer:
      'Historically, pension funds required a minimum two-thirds to purchase an annuity at retirement, while provident funds allowed the full amount as a lump sum. Since March 2021, provident fund contributions are subject to the same annuitisation rules as pension funds for new contributions, largely eliminating the distinction for new members.',
  },
  {
    question: 'How does group risk cover work?',
    answer:
      'Group risk cover provides life, disability, and funeral benefits for all qualifying employees under a single policy. Premiums are typically lower than individual policies due to group underwriting (no individual medical assessments). Cover is usually expressed as a multiple of annual salary and is paid for by the employer, the employee, or a combination of both.',
  },
  {
    question: 'Can Navigate Wealth help restructure our employee benefits?',
    answer:
      'Yes. Navigate Wealth provides comprehensive employee benefits consulting, including benchmarking your current benefits against industry standards, analysing costs, evaluating providers, and recommending improvements. We help businesses design competitive benefits packages that attract talent while managing costs effectively.',
  },
];

/**
 * Financial Planning FAQ entries for structured data on the financial planning page.
 */
export const financialPlanningFAQs: Array<{ question: string; answer: string }> = [
  {
    question: 'What is a comprehensive financial plan?',
    answer:
      'A comprehensive financial plan is a holistic strategy that covers all aspects of your financial life — budgeting, investments, retirement savings, risk management, tax optimisation, estate planning, and debt management. It aligns your money with your life goals and is reviewed regularly to adapt to changing circumstances.',
  },
  {
    question: 'How much does financial planning cost in South Africa?',
    answer:
      'Fees vary depending on the complexity of your needs. Navigate Wealth offers a free initial consultation to assess your situation. Ongoing planning fees may be structured as a flat fee, hourly rate, or percentage of assets under management. We are transparent about all fees before any engagement begins.',
  },
  {
    question: 'Do I need a financial planner if I already have investments?',
    answer:
      'Yes. A financial planner does more than select investments. They ensure your entire financial picture — tax efficiency, risk cover, retirement readiness, estate structure, and debt strategy — is working together. Many clients discover gaps or inefficiencies that a holistic review can address.',
  },
  {
    question: 'What qualifications should a financial planner have?',
    answer:
      'In South Africa, look for a Certified Financial Planner (CFP®) designation, which requires rigorous education, examination, experience, and ongoing professional development. All Navigate Wealth advisers hold recognised industry qualifications and are registered with the Financial Sector Conduct Authority (FSCA).',
  },
  {
    question: 'How often should I review my financial plan?',
    answer:
      'We recommend a formal review at least once a year, or whenever a major life event occurs — such as marriage, divorce, birth of a child, job change, inheritance, or significant market shifts. Regular reviews ensure your plan stays aligned with your evolving goals and circumstances.',
  },
];