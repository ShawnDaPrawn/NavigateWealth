/**
 * The fallback articles shown when the backend has none.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */
import { type ArticleDisplay } from './articleTypes';

export const DEMO_ARTICLES: Record<string, ArticleDisplay> = {
  'complete-guide-retirement-planning-2025': {
    id: 'demo-retirement-guide-2025',
    slug: 'complete-guide-retirement-planning-2025',
    title: 'The Complete Guide to Retirement Planning in 2025',
    subtitle: 'Essential strategies for building a secure retirement',
    excerpt:
      'Navigate the complexities of retirement planning with our comprehensive guide covering 401(k) optimization, Social Security strategies, and long-term wealth preservation.',
    body: `<h2>Introduction to Retirement Planning</h2><p>Planning for retirement is one of the most important financial decisions you'll make in your lifetime. This comprehensive guide will walk you through the essential strategies and considerations for building a secure retirement.</p><h2>401(k) Optimization Strategies</h2><p>Maximizing your 401(k) contributions is crucial for building retirement wealth. Here are key strategies:</p><ul><li>Take full advantage of employer matching contributions</li><li>Gradually increase contribution rates annually</li><li>Choose appropriate asset allocation based on your age and risk tolerance</li><li>Consider Roth vs. Traditional 401(k) options</li></ul><h2>Social Security Planning</h2><p>Understanding when and how to claim Social Security benefits can significantly impact your retirement income:</p><ul><li>Delaying benefits can increase monthly payments by up to 8% per year</li><li>Coordinate spousal benefits for maximum household income</li><li>Consider your health and longevity expectations</li></ul><blockquote>The single most impactful decision in retirement planning is starting early. Even small, consistent contributions compound dramatically over decades.</blockquote><h2>Long-Term Wealth Preservation</h2><p>Protecting and growing your retirement assets requires careful planning and regular review of your investment strategy. Diversification across asset classes remains the cornerstone of prudent wealth management.</p>`,
    author_name: 'David Rodriguez',
    category_name: 'Retirement Planning',
    category_id: 'demo-category-1',
    type_name: 'Insights & Education',
    reading_time_minutes: 8,
    published_at: '2025-01-15T00:00:00Z',
    is_featured: true,
    status: 'published',
    tags: ['retirement', '401k', 'social security'],
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-20T00:00:00Z',
  },
  'tax-efficient-investment-strategies': {
    id: 'demo-tax-efficient-strategies',
    slug: 'tax-efficient-investment-strategies',
    title: 'Tax-Efficient Investment Strategies',
    subtitle: 'Minimize taxes while maximizing returns',
    excerpt:
      'Learn proven strategies to optimize your after-tax investment returns through strategic tax planning and smart investment choices.',
    body: `<h2>Understanding Tax-Efficient Investing</h2><p>Tax efficiency is a critical component of successful long-term investing. By minimizing the tax impact on your investments, you can keep more of your returns working for you.</p><h2>Asset Location Strategy</h2><p>Placing the right investments in the right accounts can significantly reduce your tax burden:</p><ul><li>Hold tax-inefficient assets in tax-deferred accounts</li><li>Keep tax-efficient investments in taxable accounts</li><li>Utilize Roth accounts for high-growth potential investments</li></ul><h2>Tax-Loss Harvesting</h2><p>Strategic realization of losses can offset gains and reduce your tax liability while maintaining your desired asset allocation.</p>`,
    author_name: 'Sarah Chen',
    category_name: 'Estate & Tax Planning',
    category_id: 'demo-category-2',
    type_name: 'Insights & Education',
    reading_time_minutes: 6,
    published_at: '2025-01-10T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['tax planning', 'investments', 'wealth management'],
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
  'estate-planning-essentials-high-net-worth': {
    id: 'demo-estate-planning-hnw',
    slug: 'estate-planning-essentials-high-net-worth',
    title: 'Estate Planning Essentials for High-Net-Worth Families',
    subtitle: 'Protect and transfer your wealth effectively',
    excerpt:
      'A comprehensive guide to estate planning strategies for high-net-worth individuals and families looking to preserve their legacy.',
    body: `<h2>The Importance of Estate Planning</h2><p>For high-net-worth families, proper estate planning is essential to ensure your wealth is transferred according to your wishes while minimizing tax implications.</p><h2>Key Estate Planning Tools</h2><ul><li>Revocable Living Trusts for probate avoidance</li><li>Irrevocable Life Insurance Trusts (ILITs)</li><li>Family Limited Partnerships (FLPs)</li><li>Charitable Remainder Trusts</li></ul><h2>Wealth Transfer Strategies</h2><p>Strategic gifting and trust structures can help minimize estate taxes while providing for future generations.</p>`,
    author_name: 'Jennifer Walsh',
    category_name: 'Estate & Tax Planning',
    category_id: 'demo-category-2',
    type_name: 'Insights & Education',
    reading_time_minutes: 10,
    published_at: '2025-01-05T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['estate planning', 'trusts', 'wealth transfer'],
    created_at: '2025-01-05T00:00:00Z',
    updated_at: '2025-01-05T00:00:00Z',
  },
  'understanding-risk-management-modern-portfolios': {
    id: 'demo-risk-management',
    slug: 'understanding-risk-management-modern-portfolios',
    title: 'Understanding Risk Management in Modern Portfolios',
    subtitle: 'Balance risk and return effectively',
    excerpt:
      'Learn how to construct resilient portfolios through diversification, strategic asset allocation, and risk management techniques.',
    body: `<h2>The Foundation of Risk Management</h2><p>Effective risk management is crucial for long-term investment success. Understanding and managing risk allows you to achieve your financial goals while protecting your wealth.</p><h2>Diversification Principles</h2><p>Proper diversification across asset classes, sectors, and geographies helps reduce portfolio volatility:</p><ul><li>Asset class diversification (stocks, bonds, alternatives)</li><li>Geographic diversification (domestic and international)</li><li>Sector and industry diversification</li><li>Investment style diversification (growth vs. value)</li></ul><h2>Strategic Asset Allocation</h2><p>Your asset allocation should reflect your risk tolerance, time horizon, and financial goals. Regular rebalancing ensures you maintain your target allocation.</p>`,
    author_name: 'Michael Johnson',
    category_name: 'Risk & Insurance',
    category_id: 'demo-category-3',
    type_name: 'Insights & Education',
    reading_time_minutes: 7,
    published_at: '2025-01-08T00:00:00Z',
    is_featured: false,
    status: 'published',
    tags: ['risk management', 'diversification', 'asset allocation'],
    created_at: '2025-01-08T00:00:00Z',
    updated_at: '2025-01-08T00:00:00Z',
  },
};

// ---------------------------------------------------------------------------
// Loading & Error states
// ---------------------------------------------------------------------------
