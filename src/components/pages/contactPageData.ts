/**
 * The Contact page's audiences — who the enquiry is from, what we offer them
 * and the label each is filed under (the enquiry's clientType). Both designs
 * read them from here (ContactPage.tsx for the live page,
 * src/site/pages/NavigatorContactPage.tsx for the redesign), so the copy
 * lives in one place whichever design is live. Moved here verbatim from
 * ContactPage.tsx.
 */
import { Building, UserCheck, Users } from 'lucide-react';

export const clientTypes = {
  individuals: {
    label: 'Individuals',
    icon: Users,
    phone: '+27 (0)12 667 2505',
    email: 'info@navigatewealth.co',
    description: 'Personal wealth management and financial planning for individuals and families.',
    services: [
      'Personal Investment Management',
      'Retirement Planning',
      'Risk Management',
      'Estate Planning',
      'Tax Planning',
    ],
  },
  business: {
    label: 'Business',
    icon: Building,
    phone: '+27 (0)12 667 2505',
    email: 'info@navigatewealth.co',
    description: 'Comprehensive financial solutions for businesses of all sizes.',
    services: [
      'Corporate Investment Solutions',
      'Employee Benefits',
      'Business Risk Management',
      'Corporate Tax Planning',
      'Executive Benefits',
    ],
  },
  advisors: {
    label: 'Advisors',
    icon: UserCheck,
    phone: '+27 (0)12 667 2505',
    email: 'info@navigatewealth.co',
    description: 'Succession planning and practice transitions for financial advisers.',
    services: [
      'Succession Planning',
      'Practice Valuation',
      'Practice Sales',
      'Client Transitions',
      'Legacy Planning',
    ],
  },
};

/** An audience key; also the clientType an enquiry is filed under. */
export type ClientTypeKey = keyof typeof clientTypes;
