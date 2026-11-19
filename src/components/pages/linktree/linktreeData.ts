/**
 * The /links page's types, SEO tags and display helpers. Both designs of the
 * page (LinktreePage.tsx and the Navigator redesign) read them from here, so
 * they emit the same tags and show each link's address the same way.
 */
import { SITE_ORIGIN } from '../../../utils/siteOrigin';

export interface LinktreeLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  enabled: boolean;
  order: number;
  clicks: number;
}

export interface LinktreeSettings {
  title: string;
  bio: string;
  avatarUrl?: string;
  theme: 'navy' | 'gold' | 'light' | 'dark';
  showBranding: boolean;
  socialProfiles?: Record<string, string>;
}

export const seoProps = {
  title: 'Navigate Wealth Links',
  description: 'Official Navigate Wealth links, resources, services, and contact details.',
  canonicalUrl: `${SITE_ORIGIN}/links`,
  robotsContent: 'noindex, nofollow',
};

export const SOCIAL_LABEL_MAP: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  twitter: 'X',
  email: 'Email',
};

export function formatDisplayUrl(url: string): string {
  if (url.startsWith('mailto:')) return url.replace(/^mailto:/, '');
  if (url.startsWith('tel:')) return url.replace(/^tel:/, '');

  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}
