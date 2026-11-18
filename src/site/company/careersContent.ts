/**
 * Careers content and the job-listings feed — shared by the live CareersPage
 * and NavigatorCareersPage, so both designs list the same departments and read
 * the same published roles (GET /publications/careers, managed in the admin).
 *
 * No headcount or retention figures here: see src/config/companyFacts.ts.
 */
import {
  Coffee,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Lightbulb,
  Megaphone,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
}

export interface CareerCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
}

export interface CareerPoint {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const CAREER_CATEGORIES: CareerCategory[] = [
  {
    id: 'advisory',
    title: 'Advisory',
    icon: Users,
    description:
      'Client-facing roles providing financial advice and building lasting relationships.',
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: FileText,
    description: 'Operational support roles ensuring smooth business operations.',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Shield,
    description: 'Regulatory and compliance roles maintaining standards and oversight.',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    description: 'Creative and strategic roles driving brand growth and client acquisition.',
  },
];

export const CAREER_VALUES: CareerPoint[] = [
  {
    title: 'Founder-Led',
    description: 'Work directly alongside the founder and see how every part of the practice runs.',
    icon: UserCheck,
  },
  {
    title: 'Client Excellence',
    description: "Every decision we make is guided by what's best for our clients.",
    icon: Heart,
  },
  {
    title: 'Professional Growth',
    description: 'We support continuous learning, CPD and professional development.',
    icon: GraduationCap,
  },
  {
    title: 'Independence',
    description: 'We give advice that is not tied to any single product provider.',
    icon: Globe,
  },
];

export const CAREER_PERKS: CareerPoint[] = [
  {
    icon: TrendingUp,
    title: 'Competitive Remuneration',
    description: 'Market-related pay, discussed openly for each role',
  },
  {
    icon: GraduationCap,
    title: 'Continuous Learning',
    description: 'Support for CPD and industry qualifications',
  },
  {
    icon: Coffee,
    title: 'Flexible Working',
    description: 'Hybrid working from our Pretoria office',
  },
  {
    icon: Shield,
    title: 'Meaningful Work',
    description: 'Help clients make real, well-informed financial decisions',
  },
  {
    icon: Lightbulb,
    title: 'Innovation Culture',
    description: 'AI tools, modern tech stack & creative freedom',
  },
  { icon: Users, title: 'Mentorship', description: 'One-on-one mentorship from the founder' },
];

/** The short list shown under "No current openings". */
export const CAREER_HIGHLIGHTS = [
  'Competitive remuneration',
  'Professional development',
  'Growth opportunities',
  'Modern work environment',
  'Flexible working options',
  'Close-knit, founder-led culture',
];

export async function fetchJobListings(): Promise<JobListing[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/careers`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (err) {
    console.error('Failed to fetch job listings:', err);
  }
  return [];
}

/** "12 Dec 2026", the way both designs print a closing date. */
export function formatClosingDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
