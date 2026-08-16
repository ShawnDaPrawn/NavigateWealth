import overrides from './article-canonical-overrides.json';
import { SITE_ORIGIN } from '@/utils/siteOrigin';

const overrideBySlug = overrides as Record<string, string>;

export function knownArticleCanonicalUrl(
  slug: string | undefined,
  origin: string = SITE_ORIGIN,
): string | null {
  if (!slug) return null;
  const mapped = overrideBySlug[slug.trim()];
  if (!mapped) return null;
  const path = mapped.trim();
  if (!path) return null;
  return path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
