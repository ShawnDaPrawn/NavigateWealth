/** The sitemap page's sections and links. Static data, kept apart from the page that renders it. */
import React from 'react';
import { Home, Shield, Building, Users, FileText, Settings, BookOpen } from 'lucide-react';

export interface SitemapLink {
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

export interface SitemapSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  links: SitemapLink[];
}

export const sitemapSections: SitemapSection[] = [
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
      {
        title: 'Newsletters',
        path: '/resources?section=newsletters',
        description: 'Every published Navigate Wealth newsletter, by year and month.',
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
