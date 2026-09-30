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
  /** Shown under the label in a narrow mega-menu tile, which fits two short
      lines. Keep it within NAV_DESCRIPTION_MAX_LENGTH so it never gets cut off. */
  description: string;
}

export const NAV_DESCRIPTION_MAX_LENGTH = 30;

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
    description: 'Life and disability cover.',
  },
  {
    path: '/medical-aid',
    label: 'Medical Aid',
    icon: Heart,
    description: 'Medical schemes and gap cover.',
  },
  {
    path: '/retirement-planning',
    label: 'Retirement Planning',
    icon: Target,
    description: 'Retire on your own terms.',
  },
  {
    path: '/investment-management',
    label: 'Investment Management',
    icon: TrendingUp,
    description: 'Local and offshore portfolios.',
  },
  {
    path: '/employee-benefits',
    label: 'Employee Benefits',
    icon: Briefcase,
    description: 'Group benefits for your team.',
  },
  {
    path: '/tax-planning',
    label: 'Tax Planning',
    icon: Calculator,
    description: 'Keep more of what you earn.',
  },
  {
    path: '/estate-planning',
    label: 'Estate Planning',
    icon: Users,
    description: 'Wills, trusts and succession.',
  },
  {
    path: '/financial-planning',
    label: 'Financial Planning',
    icon: Compass,
    description: 'One plan for all your money.',
  },
];

export const solutionItems: NavMenuItem[] = [
  {
    path: '/solutions/individuals',
    label: 'For Individuals',
    icon: User,
    description: 'Advice for every life stage.',
  },
  {
    path: '/solutions/businesses',
    label: 'For Businesses',
    icon: Building,
    description: 'Benefits and key-person cover.',
  },
  {
    path: '/solutions/advisers',
    label: 'For Advisers',
    icon: Briefcase,
    description: 'Grow your practice with us.',
  },
];

export const companyItems: NavMenuItem[] = [
  {
    path: '/about',
    label: 'About Us',
    icon: Info,
    description: 'Who we are and how we help.',
  },
  {
    path: '/why-us',
    label: 'Why Us?',
    icon: Award,
    description: 'What sets us apart.',
  },
  {
    path: '/careers',
    label: 'Careers',
    icon: UserCheck,
    description: 'Build a career with us.',
  },
  {
    path: '/press',
    label: 'Press',
    icon: Newspaper,
    description: 'News and media resources.',
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
