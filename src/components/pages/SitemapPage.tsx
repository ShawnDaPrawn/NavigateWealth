import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { SEO, createBreadcrumbSchema, createWebPageSchema } from '../seo/SEO';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import {
  Home,
  Shield,
  Building,
  Users,
  FileText,
  Phone,
  Settings,
  TrendingUp,
  Calculator,
  BookOpen,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Search,
  Layers,
  Globe,
  Lock,
} from 'lucide-react';

interface SitemapLink {
  title: string;
  path: string;
  description: string;
  lastModified?: string;
  status?: 'public' | 'auth-required' | 'flexible';
  /**
   * Whether the page is eligible for the JSON-LD SiteNavigationElement.
   * Defaults to true; set false for routes that robots.txt disallows (e.g.
   * /login, /signup) or that are otherwise not canonical indexable URLs.
   * Auth-required and query-param links are always excluded regardless.
   */
  indexable?: boolean;
}

interface SitemapSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  links: SitemapLink[];
}

const SITEMAP_URL = `${SITE_ORIGIN}/sitemap`;

const sitemapSections: SitemapSection[] = [
  {
    id: 'main-navigation',
    title: 'Main Navigation',
    icon: Home,
    description: 'Primary website pages and core navigation',
    links: [
      {
        title: 'Home',
        path: '/',
        description: 'Welcome to Navigate Wealth — your trusted independent financial partner.',
        lastModified: '2026-04-02',
        status: 'public',
      },
      {
        title: 'About Us',
        path: '/about',
        description: 'Learn about our mission, values, and commitment to your financial success.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Our Services',
        path: '/services',
        description:
          'A comprehensive overview of our wealth management and financial planning services.',
        lastModified: '2026-04-02',
        status: 'public',
      },
      {
        title: 'Our Team',
        path: '/team',
        description: 'Meet our experienced financial advisers and wealth management professionals.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Ask Vasco',
        path: '/ask-vasco',
        description:
          'Your free AI financial navigator — get instant answers about money and planning.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Contact Us',
        path: '/contact',
        description: 'Get in touch with our team for personalised financial advice.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Book a Consultation',
        path: '/schedule-consultation',
        description: 'Schedule a free, no-obligation consultation with a Navigate Wealth adviser.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Get a Quote',
        path: '/get-quote',
        description: 'Request a personalised quote for any of our financial services.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
    ],
  },
  {
    id: 'financial-services',
    title: 'Financial Services',
    icon: Shield,
    description: 'Specialised financial planning and wealth management services',
    links: [
      {
        title: 'Financial Planning',
        path: '/financial-planning',
        description:
          'Holistic, goal-based financial planning tailored to every stage of your life.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Risk Management',
        path: '/risk-management',
        description:
          'Comprehensive risk assessment and life, disability, and severe-illness cover.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Retirement Planning',
        path: '/retirement-planning',
        description: 'Strategic retirement planning to secure your financial future.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Investment Management',
        path: '/investment-management',
        description: 'Professional investment portfolio management and advisory services.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Tax Planning',
        path: '/tax-planning',
        description: 'Strategic tax planning and optimisation for individuals and businesses.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Estate Planning',
        path: '/estate-planning',
        description: 'Comprehensive estate planning and wealth transfer strategies.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Employee Benefits',
        path: '/employee-benefits',
        description: 'Corporate employee-benefit solutions and group insurance.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
      {
        title: 'Medical Aid',
        path: '/medical-aid',
        description: 'Medical aid and healthcare cover planning for you and your family.',
        lastModified: '2026-03-01',
        status: 'flexible',
      },
    ],
  },
  {
    id: 'solutions',
    title: 'Solutions by Client Type',
    icon: Users,
    description: 'Tailored financial solutions for different client segments',
    links: [
      {
        title: 'For Individuals',
        path: '/solutions/individuals',
        description: 'Personal wealth management and financial planning for individuals.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'For Businesses',
        path: '/solutions/businesses',
        description: 'Corporate financial solutions and business wealth management.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'For Advisers',
        path: '/solutions/advisers',
        description: 'Professional resources and support for financial advisers.',
        lastModified: '2026-03-01',
        status: 'public',
      },
    ],
  },
  {
    id: 'resources',
    title: 'Resources & Insights',
    icon: BookOpen,
    description: 'Educational content, market insights, and financial tools',
    links: [
      {
        title: 'Resources Hub',
        path: '/resources',
        description: 'Market insights, educational articles, videos, and financial tools.',
        lastModified: '2026-04-02',
        status: 'public',
      },
      {
        title: 'Market Insights',
        path: '/resources?section=insights',
        description: 'The latest market analysis and financial insights from our experts.',
        status: 'public',
      },
      {
        title: 'Market Watch',
        path: '/resources?section=market-watch',
        description: 'Real-time market data, forex rates, stocks, and economic indicators.',
        status: 'public',
      },
      {
        title: 'Market News',
        path: '/resources?section=market-updates',
        description: 'Financial news, market updates, and investment opportunities.',
        status: 'public',
      },
    ],
  },
  {
    id: 'company',
    title: 'Company Information',
    icon: Building,
    description: 'Learn more about Navigate Wealth as a company',
    links: [
      {
        title: 'Why Choose Us',
        path: '/why-us',
        description: 'Discover what sets Navigate Wealth apart in financial services.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Careers',
        path: '/careers',
        description: 'Join our team of financial professionals and wealth management experts.',
        lastModified: '2026-03-01',
        status: 'public',
      },
      {
        title: 'Press & Media',
        path: '/press',
        description: 'Latest news, press releases, and media coverage.',
        lastModified: '2026-03-01',
        status: 'public',
      },
    ],
  },
  {
    id: 'client-portal',
    title: 'Client Portal',
    icon: Settings,
    description: 'Secure client area and account management tools',
    links: [
      {
        title: 'Log In',
        path: '/login',
        description: 'Access your secure Navigate Wealth client portal.',
        status: 'public',
        indexable: false,
      },
      {
        title: 'Create an Account',
        path: '/signup',
        description: 'Register to start your journey with Navigate Wealth.',
        status: 'public',
        indexable: false,
      },
      {
        title: 'Client Dashboard',
        path: '/dashboard',
        description: 'An overview of your financial portfolio and account summary.',
        status: 'auth-required',
      },
      {
        title: 'Products & Services',
        path: '/products-services',
        description: 'Manage your financial products and services.',
        status: 'auth-required',
      },
      {
        title: 'Transactions & Documents',
        path: '/transactions-documents',
        description: 'View transaction history and download important documents.',
        status: 'auth-required',
      },
      {
        title: 'Account Profile',
        path: '/profile',
        description: 'Manage your personal information and account preferences.',
        status: 'auth-required',
      },
      {
        title: 'Security Settings',
        path: '/security',
        description: 'Update passwords and manage account security features.',
        status: 'auth-required',
      },
    ],
  },
  {
    id: 'legal',
    title: 'Legal & Compliance',
    icon: FileText,
    description: 'Important legal information and regulatory disclosures',
    links: [
      {
        title: 'Legal Information',
        path: '/legal',
        description: 'Terms, privacy policy, and regulatory compliance information.',
        lastModified: '2026-01-01',
        status: 'flexible',
      },
      {
        title: 'Privacy & Data Protection',
        path: '/legal?section=privacy-data-protection',
        description: 'How we protect and manage your personal information.',
        lastModified: '2026-01-01',
        status: 'flexible',
      },
      {
        title: 'Regulatory Disclosures',
        path: '/legal?section=regulatory-disclosures',
        description: 'FSP licensing information and regulatory compliance details.',
        lastModified: '2026-01-01',
        status: 'flexible',
      },
    ],
  },
];

const allLinks = sitemapSections.flatMap((section) => section.links);
const totalPages = allLinks.length;
const publicPages = allLinks.filter((link) => link.status !== 'auth-required').length;

/** Most recent lastModified date across every entry, formatted for display. */
const lastUpdatedLabel = (() => {
  const dates = allLinks
    .map((link) => link.lastModified)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latest = dates[dates.length - 1];
  if (!latest) return null;
  const parsed = new Date(`${latest}T00:00:00`);
  return parsed.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
})();

/**
 * Structured data: WebPage + breadcrumb trail + a SiteNavigationElement listing
 * every publicly indexable page. The SiteNavigationElement helps search engines
 * understand the site hierarchy and can power rich sitelinks.
 */
const sitemapStructuredData: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@graph': [
    createWebPageSchema(
      'Sitemap — Navigate Wealth',
      'Complete sitemap of the Navigate Wealth website covering every service, resource, and tool.',
      SITEMAP_URL,
    ),
    createBreadcrumbSchema([{ name: 'Home', url: SITE_ORIGIN }, { name: 'Sitemap' }]),
    {
      '@type': 'SiteNavigationElement',
      name: 'Navigate Wealth Site Navigation',
      hasPart: allLinks
        .filter(
          (link) =>
            link.indexable !== false && link.status !== 'auth-required' && !link.path.includes('?'),
        )
        .map((link) => ({
          '@type': 'WebPage',
          name: link.title,
          description: link.description,
          url: `${SITE_ORIGIN}${link.path === '/' ? '' : link.path}`,
        })),
    },
  ],
};

function getStatusBadge(status?: string) {
  switch (status) {
    case 'public':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
        >
          <Globe className="h-3 w-3" aria-hidden="true" />
          Public
        </Badge>
      );
    case 'auth-required':
      return (
        <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 text-purple-700">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Login required
        </Badge>
      );
    case 'flexible':
      return (
        <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-600">
          <Users className="h-3 w-3" aria-hidden="true" />
          Public &amp; clients
        </Badge>
      );
    default:
      return null;
  }
}

export function SitemapPage() {
  const [query, setQuery] = useState('');

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sitemapSections;
    return sitemapSections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (link) =>
            link.title.toLowerCase().includes(q) ||
            link.description.toLowerCase().includes(q) ||
            link.path.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [query]);

  const visibleCount = filteredSections.reduce((total, section) => total + section.links.length, 0);
  const isSearching = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Sitemap — Navigate Wealth | Complete Site Navigation"
        description="Complete sitemap of the Navigate Wealth website. Find every page, service, resource, and tool for wealth management, financial planning, and investment services in South Africa."
        keywords={[
          'Navigate Wealth sitemap',
          'financial planning South Africa',
          'wealth management pages',
          'site navigation',
        ]}
        canonicalUrl={SITEMAP_URL}
        structuredData={sitemapStructuredData}
      />

      {/* Hero Section — matches the site-standard dark hero (Home, Services, Why Us) */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Sitemap hero">
        {/* Background decoration */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#1a1f3a] to-[#111827] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-48 -left-32 w-[450px] h-[450px] rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16 lg:py-20">
          <div className="max-w-3xl">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm text-gray-400 mb-6"
            >
              <Link to="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span className="text-white">Sitemap</span>
            </nav>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-6">
              <Globe className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                Everything on Navigate Wealth, in one place
              </span>
            </div>
            <h1 className="!text-[clamp(1.85rem,4.5vw,3rem)] !font-extrabold !leading-[1.1] text-white tracking-tight mb-5">
              Navigate Wealth{' '}
              <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
                Sitemap
              </span>
            </h1>
            <p className="text-gray-400 text-base lg:text-lg max-w-2xl leading-relaxed mb-8">
              Your complete guide to every page on our site — services, solutions, resources, and
              your secure client portal. Search below or browse by category to find exactly what you
              need.
            </p>

            {/* Search */}
            <div className="relative max-w-xl">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages — e.g. retirement, tax, contact…"
                aria-label="Search the sitemap"
                className="h-12 pl-12 pr-4 text-base text-slate-900 shadow-lg border-transparent"
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" aria-hidden="true" />
                {totalPages} pages
              </span>
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" aria-hidden="true" />
                {sitemapSections.length} categories
              </span>
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-400" aria-hidden="true" />
                {publicPages} public pages
              </span>
              {lastUpdatedLabel && (
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" aria-hidden="true" />
                  Updated {lastUpdatedLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-14">
        {/* Quick Navigation */}
        {!isSearching && (
          <div className="mb-14">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Jump to a category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sitemapSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                    <section.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {section.title}
                    </span>
                    <span className="text-xs text-slate-500">{section.links.length} pages</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {isSearching && (
          <p className="mb-8 text-sm text-slate-600" role="status" aria-live="polite">
            {visibleCount === 0 ? (
              <>No pages match “{query.trim()}”.</>
            ) : (
              <>
                Showing <span className="font-semibold text-slate-900">{visibleCount}</span>{' '}
                {visibleCount === 1 ? 'page' : 'pages'} matching “{query.trim()}”.
              </>
            )}
          </p>
        )}

        {/* Sitemap Sections */}
        {visibleCount === 0 && isSearching ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Search className="mx-auto mb-4 h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="text-lg font-semibold text-slate-900">No matching pages</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Try a different keyword, or{' '}
              <button
                type="button"
                onClick={() => setQuery('')}
                className="font-medium text-purple-600 hover:text-purple-800 hover:underline"
              >
                clear your search
              </button>{' '}
              to browse everything.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredSections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <section.icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <CardTitle className="text-lg text-slate-900">{section.title}</CardTitle>
                        <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-slate-100">
                      {section.links.map((link) => (
                        <li key={link.path}>
                          <Link
                            to={link.path}
                            className="group flex items-start gap-4 p-5 transition-colors hover:bg-purple-50/60 sm:px-6"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <span className="text-base font-semibold text-slate-900 transition-colors group-hover:text-purple-700">
                                  {link.title}
                                </span>
                                {getStatusBadge(link.status)}
                              </div>
                              <p className="mt-1 text-sm text-slate-600">{link.description}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-500">
                                  {link.path}
                                </code>
                                {link.lastModified && <span>Updated {link.lastModified}</span>}
                              </div>
                            </div>
                            <ArrowUpRight
                              className="mt-1 h-5 w-5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-purple-600"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        )}

        {/* Help / About */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="h-5 w-5 text-purple-600" aria-hidden="true" />
                About this sitemap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-600">
                This page lists every section of the Navigate Wealth website to help both visitors
                and search engines discover our content quickly. Each entry shows who can access it.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  {getStatusBadge('public')}
                  <span>Accessible to everyone.</span>
                </li>
                <li className="flex items-center gap-2">
                  {getStatusBadge('flexible')}
                  <span>Open to all, with extra tools once you sign in.</span>
                </li>
                <li className="flex items-center gap-2">
                  {getStatusBadge('auth-required')}
                  <span>Secure portal — sign in to access.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <TrendingUp className="h-5 w-5 text-purple-600" aria-hidden="true" />
                Can&apos;t find what you need?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-600">
                Our team is here to help you navigate our services and find the right financial
                solution for your goals.
              </p>
              <div className="space-y-3">
                <Link
                  to="/contact"
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 transition-colors hover:text-purple-900"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Contact our team
                </Link>
                <Link
                  to="/get-quote"
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 transition-colors hover:text-purple-900"
                >
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  Get a personalised quote
                </Link>
                <Link
                  to="/resources"
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 transition-colors hover:text-purple-900"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Browse our resources
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SitemapPage;
