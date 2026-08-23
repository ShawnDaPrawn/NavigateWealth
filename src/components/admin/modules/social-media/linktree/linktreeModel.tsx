/**
 * Model of the Linktree tab: link/settings shapes, the quick-add template
 * roster, the social platform list, category labels, and the API bridge.
 * Split out of LinktreeTab.tsx.
 */
/**
 * Linktree Tab — Admin management UI for link-in-bio page
 *
 * CRUD for company links that render on a public /links page.
 * Persisted via KV store linktree:links / linktree:settings.
 *
 * Features:
 *   - Full CRUD for links with reordering
 *   - Quick Add templates for common Navigate Wealth links
 *   - Social profile management (icon row on public page)
 *   - Settings (title, bio, theme)
 *   - Click analytics per link
 *
 * @module social-media/LinktreeTab
 */

import {
  Link as Globe,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Twitter,
  Mail,
  Phone,
  MapPin,
  CalendarCheck,
  FileText,
  BookOpen,
} from 'lucide-react';
import { api } from '../../../../../utils/api';

// ============================================================================
// Types
// ============================================================================

export interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  enabled: boolean;
  order: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinktreeSettings {
  title: string;
  bio: string;
  avatarUrl?: string;
  theme: 'navy' | 'gold' | 'light' | 'dark';
  showBranding: boolean;
  socialProfiles?: Record<string, string>;
}

// ============================================================================
// Quick Add Templates
// ============================================================================

export interface QuickAddTemplate {
  title: string;
  url: string;
  description: string;
  icon: React.ReactNode;
  category: 'website' | 'social' | 'contact' | 'content';
}

export const QUICK_ADD_TEMPLATES: QuickAddTemplate[] = [
  {
    title: 'Company Website',
    url: 'https://www.navigatewealth.co',
    description: 'Visit our official website',
    icon: <Globe className="h-4 w-4" />,
    category: 'website',
  },
  {
    title: 'Book a Consultation',
    url: 'https://www.navigatewealth.co/contact',
    description: 'Schedule a free financial planning session',
    icon: <CalendarCheck className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Our Services',
    url: 'https://www.navigatewealth.co/services',
    description: 'Explore our financial planning solutions',
    icon: <FileText className="h-4 w-4" />,
    category: 'website',
  },
  {
    title: 'Latest Blog Posts',
    url: 'https://www.navigatewealth.co/resources',
    description: 'Financial insights and market updates',
    icon: <BookOpen className="h-4 w-4" />,
    category: 'content',
  },
  {
    title: 'LinkedIn',
    url: 'https://www.linkedin.com/company/navigate-wealth',
    description: 'Follow us on LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'Instagram',
    url: 'https://www.instagram.com/navigatewealth',
    description: 'Follow us on Instagram',
    icon: <Instagram className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'Facebook',
    url: 'https://www.facebook.com/navigatewealth',
    description: 'Like us on Facebook',
    icon: <Facebook className="h-4 w-4" />,
    category: 'social',
  },
  {
    title: 'YouTube Channel',
    url: 'https://www.youtube.com/@navigatewealth',
    description: 'Watch our financial planning videos',
    icon: <Youtube className="h-4 w-4" />,
    category: 'content',
  },
  {
    title: 'Email Us',
    url: 'mailto:info@navigatewealth.co.za',
    description: 'Get in touch via email',
    icon: <Mail className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Call Us',
    url: 'tel:+27126672505',
    description: '(012) 667 2505',
    icon: <Phone className="h-4 w-4" />,
    category: 'contact',
  },
  {
    title: 'Office Location',
    url: 'https://maps.google.com/?q=Route+21+Corporate+Park+Centurion',
    description: 'Route 21 Corporate Park, Centurion',
    icon: <MapPin className="h-4 w-4" />,
    category: 'contact',
  },
];

// Social profile platform definitions
export const SOCIAL_PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: <Instagram className="h-4 w-4" />,
    placeholder: 'https://instagram.com/navigatewealth',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
    placeholder: 'https://linkedin.com/company/navigate-wealth',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: <Facebook className="h-4 w-4" />,
    placeholder: 'https://facebook.com/navigatewealth',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: <Youtube className="h-4 w-4" />,
    placeholder: 'https://youtube.com/@navigatewealth',
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    icon: <Twitter className="h-4 w-4" />,
    placeholder: 'https://x.com/navigatewealth',
  },
  {
    key: 'email',
    label: 'Email',
    icon: <Mail className="h-4 w-4" />,
    placeholder: 'mailto:info@navigatewealth.co.za',
  },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  website: 'Website',
  social: 'Social Media',
  contact: 'Contact',
  content: 'Content',
};

// ============================================================================
// API
// ============================================================================

export const BASE = '/linktree';

export async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  // url is BASE + suffix (e.g. '/linktree/links'); strip to just the suffix
  const path = url.startsWith('/linktree') ? url : BASE + url.replace(/^.*\/linktree/, '');
  const method = (opts?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE';
  const body = opts?.body ? JSON.parse(opts.body as string) : undefined;
  const res = await (method === 'GET'
    ? api.get<{ data: T }>(path)
    : method === 'DELETE'
      ? api.delete<{ data: T }>(path)
      : method === 'PUT'
        ? api.put<{ data: T }>(path, body)
        : api.post<{ data: T }>(path, body));
  return res.data;
}

// ============================================================================
// Component
// ============================================================================
