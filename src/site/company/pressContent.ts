/**
 * Press page data — shared by the live PressPage and NavigatorPressPage: the
 * press-release feed (GET /publications/press/articles), its categories and
 * filter, the media-kit items and the checkable company facts.
 *
 * Headline client, experience and asset figures were removed from the press
 * page in October 2026; see src/config/companyFacts.ts for why.
 */
import {
  Building,
  Calendar,
  FileText,
  Newspaper,
  Shield,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { COMPANY, FOUNDER } from '@/config/companyFacts';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export interface PressArticle {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  press_category: string;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  published_at?: string;
  author_name?: string;
  reading_time_minutes?: number;
}

export const PRESS_CATEGORY_MAP: Record<string, string> = {
  'Company News': 'company_news',
  'Product Launch': 'product_launch',
  Awards: 'awards',
  'Team News': 'team_news',
  'Industry Insights': 'industry_insights',
};

export const PRESS_CATEGORY_LABEL_MAP: Record<string, string> = {
  company_news: 'Company News',
  product_launch: 'Product Launch',
  awards: 'Awards',
  team_news: 'Team News',
  industry_insights: 'Industry Insights',
};

// "Awards" and "Team News" are kept in the label maps above so any article
// already tagged with them still shows its badge, but they are not offered as
// tabs: an empty "Awards" tab reads as a claim the firm has awards.
export const CATEGORY_TABS = ['All', 'Company News', 'Product Launch', 'Industry Insights'];

export async function fetchPressArticles(): Promise<PressArticle[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/press/articles`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch {
    /* fall through */
  }
  return [];
}

/** Whether an article passes the category tab and the search box. */
export function matchesPressFilter(
  article: PressArticle,
  category: string,
  searchQuery: string,
): boolean {
  if (category !== 'All') {
    const catKey = PRESS_CATEGORY_MAP[category];
    if (catKey && article.press_category !== catKey) return false;
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(q) ||
      article.excerpt.toLowerCase().includes(q) ||
      (article.subtitle || '').toLowerCase().includes(q)
    );
  }
  return true;
}

export function formatPressDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export interface PressFact {
  label: string;
  value: string;
  icon: LucideIcon;
}

/** Checkable company facts only. */
export const PRESS_FACTS: PressFact[] = [
  { label: 'FSCA-authorised FSP', value: COMPANY.fspNumber, icon: Shield },
  { label: 'Licensed by the FSCA', value: COMPANY.fscaAuthorisedOn, icon: Calendar },
  { label: 'Company founded', value: String(COMPANY.foundedYear), icon: Building },
  { label: `Led by ${FOUNDER.name}`, value: 'Founder-led', icon: UserCheck },
];

export interface MediaAsset {
  id: 'brand' | 'founder' | 'facts' | 'brochures';
  title: string;
  description: string;
  type: string;
  icon: LucideIcon;
}

export const MEDIA_ASSETS: MediaAsset[] = [
  {
    id: 'brand',
    title: 'Brand Assets',
    description: 'Logo packages, brand guidelines, and visual identity resources',
    type: 'ZIP',
    icon: Building,
  },
  {
    id: 'founder',
    title: 'Founder Photos',
    description: `High-resolution photography of our founder, ${FOUNDER.name}`,
    type: 'ZIP',
    icon: Users,
  },
  {
    id: 'facts',
    title: 'Company Fact Sheet',
    description: 'Licensing details, milestones, and company overview',
    type: 'PDF',
    icon: FileText,
  },
  {
    id: 'brochures',
    title: 'Product Brochures',
    description: 'Comprehensive service and solution overviews',
    type: 'PDF',
    icon: Newspaper,
  },
];

/**
 * The paragraph a journalist can paste into an article. Built only from
 * companyFacts.ts and the About page's own description of the practice.
 */
export const PRESS_BOILERPLATE = `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ${COMPANY.registrationNumber}), an independent, founder-led financial advisory practice and an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}. Founded in ${COMPANY.foundedYear} by ${FOUNDER.name} and based in ${COMPANY.address.city}, ${COMPANY.tradingName} helps individuals and families build, protect, and transfer wealth through comprehensive financial planning and investment management.`;
