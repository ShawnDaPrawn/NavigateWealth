/**
 * The About page's "Discover Navigate Wealth" topics — shared by the live
 * AboutPage and NavigatorAboutPage so the two designs cannot drift apart.
 * Every licensing detail is read from companyFacts.ts.
 */
import {
  Award,
  CheckCircle,
  Eye,
  FileText,
  Handshake,
  HandHeart,
  Heart,
  Lightbulb,
  Scale,
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';

export type AboutSectionKey = 'mission' | 'partners' | 'licensing' | 'transparency';

export interface AboutSectionItem {
  title: string;
  text: string;
  icon: LucideIcon;
}

export interface AboutSection {
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  content: AboutSectionItem[];
}

export const ABOUT_SECTIONS: Record<AboutSectionKey, AboutSection> = {
  mission: {
    label: 'Mission & Culture',
    icon: Heart,
    title: 'Our Mission & Culture',
    description: 'Learn about our values, purpose, and the culture that drives everything we do.',
    content: [
      {
        title: 'Our Mission',
        text: 'To empower our clients to achieve financial independence and peace of mind through personalised wealth management strategies, exceptional service, and unwavering commitment to their success.',
        icon: Target,
      },
      {
        title: 'Our Approach',
        text: 'As a founder-led practice, we keep advice personal: you deal directly with the person advising you. We stay current with markets and regulation so that the advice stays relevant as your life changes.',
        icon: Users,
      },
      {
        title: 'Our Promise',
        text: 'Every client relationship is built on trust, transparency, and a deep understanding of your unique financial journey. We promise to be your trusted partner every step of the way.',
        icon: Handshake,
      },
    ],
  },
  partners: {
    label: 'Our Partners',
    icon: HandHeart,
    title: 'Trusted Product Providers',
    description:
      'We work with established South African product providers, so you can compare real options side by side.',
    content: [
      {
        title: 'Investment Partners',
        text: 'Investment managers and platforms including Allan Gray, Sygnia, Stanlib and INN8, used to build diversified investment and retirement portfolios.',
        icon: TrendingUp,
      },
      {
        title: 'Insurance Partners',
        text: 'Life, disability and severe illness cover compared across insurers including Discovery, Old Mutual, Momentum, Sanlam, Liberty, BrightRock and Hollard.',
        icon: Shield,
      },
      {
        title: 'Medical & Estate Partners',
        text: 'Medical aid options from Discovery Health and Momentum Health, and estate planning support from Capital Legacy and EW Serfontein & Associates.',
        icon: Stethoscope,
      },
    ],
  },
  licensing: {
    label: 'Licensing',
    icon: Scale,
    title: 'Regulatory Compliance',
    description:
      'Every detail below can be checked independently, starting with the FSCA’s public register.',
    content: [
      {
        title: 'FSP Licence',
        text: `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ${COMPANY.registrationNumber}), an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}.`,
        icon: Award,
      },
      {
        title: 'Fit and Proper Advice',
        text: 'Everyone who gives advice at Navigate Wealth meets the FSCA’s Fit and Proper requirements for honesty, qualifications, experience and continuous professional development.',
        icon: Users,
      },
      {
        title: 'Regulatory Oversight',
        text: 'We operate under the FAIS Act and the FSCA’s General Code of Conduct, and our authorisation can be confirmed on the FSCA’s public register of financial services providers.',
        icon: CheckCircle,
      },
    ],
  },
  transparency: {
    label: 'Radical Transparency',
    icon: Eye,
    title: 'Complete Transparency',
    description:
      'We believe in radical transparency - no hidden fees, no complex structures, just honest, straightforward advice.',
    content: [
      {
        title: 'Fee Transparency',
        text: "All fees are clearly disclosed upfront with no hidden charges. We believe you should know exactly what you're paying for and why.",
        icon: FileText,
      },
      {
        title: 'Investment Transparency',
        text: 'You have full visibility into your investments with regular reporting, real-time access to your portfolio, and clear explanations of all investment decisions.',
        icon: Lightbulb,
      },
      {
        title: 'Performance Transparency',
        text: 'We provide honest, comprehensive performance reporting that shows both successes and areas for improvement, along with clear benchmarking.',
        icon: TrendingUp,
      },
    ],
  },
};

export const ABOUT_SECTION_KEYS = Object.keys(ABOUT_SECTIONS) as AboutSectionKey[];
