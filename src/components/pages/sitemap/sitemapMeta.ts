/**
 * The sitemap page's SEO tags, structured data and headline figures, derived
 * from sitemapData.ts. Both designs of the page (SitemapPage.tsx and the
 * Navigator redesign) read them from here, so they always emit the same tags.
 */
import { createBreadcrumbSchema, createWebPageSchema } from '../../seo/SEO';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import { sitemapSections } from './sitemapData';

export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap`;

const allLinks = sitemapSections.flatMap((section) => section.links);
export const totalPages = allLinks.length;
export const publicPages = allLinks.filter((link) => link.status !== 'auth-required').length;

/** Most recent lastModified date across every entry, formatted for display. */
export const lastUpdatedLabel = (() => {
  const dates = allLinks
    .map((link) => link.lastModified)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latest = dates[dates.length - 1];
  if (!latest) return null;
  const parsed = new Date(`${latest}T00:00:00`);
  return parsed.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
})();

/**
 * Structured data: WebPage + breadcrumb trail + a SiteNavigationElement listing
 * every publicly indexable page. The SiteNavigationElement helps search engines
 * understand the site hierarchy and can power rich sitelinks.
 */
export const sitemapStructuredData: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@graph': [
    createWebPageSchema(
      'Sitemap — Navigate Wealth',
      'Complete sitemap of the Navigate Wealth website covering every service, resource, and tool.',
      SITEMAP_URL,
    ),
    createBreadcrumbSchema([{ name: 'Home', url: SITE_ORIGIN }, { name: 'Sitemap' }]),
    {
      '@type': 'SiteNavigationElement',
      name: 'Navigate Wealth Site Navigation',
      hasPart: allLinks
        .filter(
          (link) =>
            link.indexable !== false && link.status !== 'auth-required' && !link.path.includes('?'),
        )
        .map((link) => ({
          '@type': 'WebPage',
          name: link.title,
          description: link.description,
          url: `${SITE_ORIGIN}${link.path === '/' ? '' : link.path}`,
        })),
    },
  ],
};

/** The page's `<SEO>` props, apart from the structured data above. */
export const SITEMAP_SEO = {
  title: 'Sitemap — Navigate Wealth | Complete Site Navigation',
  description:
    'Complete sitemap of the Navigate Wealth website. Find every page, service, resource, and tool for wealth management, financial planning, and investment services in South Africa.',
  keywords: [
    'Navigate Wealth sitemap',
    'financial planning South Africa',
    'wealth management pages',
    'site navigation',
  ],
  canonicalUrl: SITEMAP_URL,
};
