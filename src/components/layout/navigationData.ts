import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Briefcase,
  Building,
  Calculator,
  Compass,
  Heart,
  Info,
  Newspaper,
  Shield,
  Target,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

export interface NavMenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface MegaPanelConfig {
  heading: string;
  tagline: string;
  /** Key of a pre-optimized image set under public/img/optimized/<key>-<width>.<format> */
  image: { key: string; alt: string };
  cta?: { label: string; to: string };
  /** Overall panel width — fixed to content so it sits inside the navbar bounds
      rather than stretching the full container width */
  panelClassName: string;
  /** Fixed width of the left image column */
  imageClassName: string;
  /** Column layout of the tile grid (always two rows for equal panel heights) */
  gridClassName: string;
}

export const serviceItems: NavMenuItem[] = [
  {
    path: '/risk-management',
    label: 'Risk Management',
    icon: Shield,
    description: 'Life, disability and illness cover that protects your family and income.',
  },
  {
    path: '/medical-aid',
    label: 'Medical Aid',
    icon: Heart,
    description: 'The right medical scheme and gap cover for your healthcare needs.',
  },
  {
    path: '/retirement-planning',
    label: 'Retirement Planning',
    icon: Target,
    description: "Build and protect the retirement lifestyle you're working towards.",
  },
  {
    path: '/investment-management',
    label: 'Investment Management',
    icon: TrendingUp,
    description: 'Grow your wealth with expertly managed local and offshore portfolios.',
  },
  {
    path: '/employee-benefits',
    label: 'Employee Benefits',
    icon: Briefcase,
    description: 'Group retirement, risk and healthcare benefits for your team.',
  },
  {
    path: '/tax-planning',
    label: 'Tax Planning',
    icon: Calculator,
    description: 'Keep your finances tax-efficient, compliant and structured smartly.',
  },
  {
    path: '/estate-planning',
    label: 'Estate Planning',
    icon: Users,
    description: 'Wills, trusts and succession planning that secure your legacy.',
  },
  {
    path: '/financial-planning',
    label: 'Financial Planning',
    icon: Compass,
    description: 'A holistic roadmap that ties every part of your money together.',
  },
];

export const solutionItems: NavMenuItem[] = [
  {
    path: '/solutions/individuals',
    label: 'For Individuals',
    icon: User,
    description: 'Personal advice and planning for every stage of life.',
  },
  {
    path: '/solutions/businesses',
    label: 'For Businesses',
    icon: Building,
    description: 'Benefits, key-person cover and planning for your company.',
  },
  {
    path: '/solutions/advisers',
    label: 'For Advisers',
    icon: Briefcase,
    description: 'Partner with us to grow and support your advice practice.',
  },
];

export const companyItems: NavMenuItem[] = [
  {
    path: '/about',
    label: 'About Us',
    icon: Info,
    description: 'Who we are and how we help South Africans build wealth.',
  },
  {
    path: '/why-us',
    label: 'Why Us?',
    icon: Award,
    description: 'What sets our advice, our service and our people apart.',
  },
  {
    path: '/careers',
    label: 'Careers',
    icon: UserCheck,
    description: 'Join our team and build a career in financial advice.',
  },
  {
    path: '/press',
    label: 'Press',
    icon: Newspaper,
    description: 'News, announcements and media resources.',
  },
];

export const servicesPanel: MegaPanelConfig = {
  heading: 'Our Services',
  tagline: 'Advice for every part of your financial life.',
  image: {
    key: 'services-menu',
    alt: 'Financial adviser reviewing tax and planning documents with a client',
  },
  cta: { label: 'View all services', to: '/services' },
  // md:w-… overrides the shadcn wrapper's md:w-auto (tailwind-merge keeps the
  // md variant separately from the unprefixed width).
  panelClassName: 'w-[880px] md:w-[880px] max-w-[calc(100%-1rem)]',
  imageClassName: 'w-[300px]',
  gridClassName: 'grid-cols-4',
};

export const solutionsPanel: MegaPanelConfig = {
  heading: 'Solutions',
  tagline: 'Tailored guidance for wherever you are.',
  image: {
    key: 'solutions-menu',
    alt: 'Financial adviser consulting with a couple',
  },
  panelClassName: 'w-[560px] md:w-[560px] max-w-[calc(100%-1rem)]',
  imageClassName: 'w-[240px]',
  gridClassName: 'grid-cols-2',
};

export const companyPanel: MegaPanelConfig = {
  heading: 'Company',
  tagline: 'Get to know Navigate Wealth.',
  image: {
    key: 'company-menu',
    alt: 'Navigate Wealth team collaborating in a meeting',
  },
  panelClassName: 'w-[560px] md:w-[560px] max-w-[calc(100%-1rem)]',
  imageClassName: 'w-[240px]',
  gridClassName: 'grid-cols-2',
};
