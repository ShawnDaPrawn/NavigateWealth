/* eslint-disable react-refresh/only-export-components */
/**
 * SEO Component & Structured Data Helpers
 *
 * Provides a reusable <SEO /> component that injects meta tags and JSON-LD
 * structured data into the document head, plus factory functions for common
 * Schema.org types used across public pages.
 */

import { useEffect } from 'react';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import organization from './organization.json';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ArticleMeta {
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

interface SEOProps {
  title: string;
  description: string;
  keywords?: string | string[];
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  robotsContent?: string;
  structuredData?: Record<string, unknown>;
  /** Emits article:* Open Graph tags; only meaningful with ogType="article". */
  articleMeta?: ArticleMeta;
}

interface FAQItem {
  question: string;
  answer: string;
}

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface ServiceOffer {
  name: string;
  description?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const SITE_NAME = 'Navigate Wealth';
const BASE_URL = SITE_ORIGIN;
/** Default OG image used when a page-specific one is not supplied (1200x630). */
const DEFAULT_OG_IMAGE = `${BASE_URL}/brand-assets/navigate-wealth-og.png`;

/* -------------------------------------------------------------------------- */
/*  SEO Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Manages document <head> meta tags and optional JSON-LD structured data.
 * Uses useEffect so it works safely during client-side rendering.
 */
export function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage,
  robotsContent = 'index, follow',
  structuredData,
  articleMeta,
}: SEOProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Helper: set or create a <meta> tag
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const normalizedKeywords = Array.isArray(keywords) ? keywords.join(', ') : keywords;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', robotsContent);
    if (normalizedKeywords) setMeta('name', 'keywords', normalizedKeywords);

    // Helper: drop a <meta> tag if present (e.g. stale dimensions from a
    // previous page when navigating client-side).
    const removeMeta = (attr: string, key: string) => {
      document.querySelector(`meta[${attr}="${key}"]`)?.remove();
    };

    // Open Graph
    const resolvedImage = ogImage || DEFAULT_OG_IMAGE;
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:locale', 'en_ZA');
    setMeta('property', 'og:image', resolvedImage);
    if (resolvedImage === DEFAULT_OG_IMAGE) {
      // Dimensions are only known for our own OG asset; claiming them for
      // arbitrary page images (article heroes) would be wrong.
      setMeta('property', 'og:image:width', '1200');
      setMeta('property', 'og:image:height', '630');
    } else {
      removeMeta('property', 'og:image:width');
      removeMeta('property', 'og:image:height');
    }
    setMeta('property', 'og:image:alt', title);
    if (canonicalUrl) setMeta('property', 'og:url', canonicalUrl);

    // Article-specific Open Graph tags. Explicitly removed otherwise so they
    // never leak onto non-article pages during client-side navigation.
    const articleTags: Array<[string, string | undefined]> = [
      ['article:author', articleMeta?.author],
      ['article:published_time', articleMeta?.publishedTime],
      ['article:modified_time', articleMeta?.modifiedTime],
    ];
    for (const [key, value] of articleTags) {
      if (value) {
        setMeta('property', key, value);
      } else {
        removeMeta('property', key);
      }
    }

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', resolvedImage);
    setMeta('name', 'twitter:site', '@NavigateWealthSA');

    // Canonical link
    if (canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonicalUrl);
    }

    // Structured data (JSON-LD)
    const SCRIPT_ID = 'seo-structured-data';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (structuredData) {
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    } else if (script) {
      script.remove();
    }

    // Cleanup structured data script on unmount
    return () => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
    };
  }, [
    title,
    description,
    keywords,
    canonicalUrl,
    ogType,
    ogImage,
    robotsContent,
    structuredData,
    articleMeta,
  ]);

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Schema.org Structured Data Factories                                      */
/* -------------------------------------------------------------------------- */

export function createOrganizationSchema(): Record<string, unknown> {
  // Static organisation facts live in organization.json — the single source of
  // truth shared with the build-time prerenderer (scripts/seo/seo-static-data.mjs).
  return {
    '@type': ['Organization', 'FinancialService'],
    '@id': `${BASE_URL}/#organization`,
    ...organization,
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/brand-assets/navigate-wealth-social.png`,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: organization.telephone,
      email: organization.email,
      availableLanguage: organization.availableLanguage,
    },
  };
}

/**
 * WebSite schema with SearchAction — strongly helps Google generate sitelinks
 * and the branded search box.
 */
export function createWebSiteSchema(): Record<string, unknown> {
  // ResourcesPage hydrates the `q` param into the on-page search box.
  return {
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: SITE_NAME,
    url: BASE_URL,
    publisher: { '@id': `${BASE_URL}/#organization` },
    inLanguage: 'en-ZA',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/resources?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function createWebPageSchema(
  title: string,
  description: string,
  url: string,
): Record<string, unknown> {
  return {
    '@type': 'WebPage',
    name: title,
    description,
    url,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

export function createFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function createAboutPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    description:
      'Learn about Navigate Wealth, our mission, values, and the experienced team of independent financial advisors.',
    url: `${BASE_URL}/about`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

export function createContactPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${SITE_NAME}`,
    description: 'Get in touch with Navigate Wealth for a free financial planning consultation.',
    url: `${BASE_URL}/contact`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

/**
 * Creates a BreadcrumbList schema for a given page trail.
 * The last item should omit `url` (it is the current page).
 *
 * @example
 * createBreadcrumbSchema([
 *   { name: 'Home',     url: 'https://www.navigatewealth.co' },
 *   { name: 'Services', url: 'https://www.navigatewealth.co/services' },
 *   { name: 'Risk Management' },  // current page — no url
 * ])
 */
export function createBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

/**
 * Creates a FinancialService schema for service pages.
 * Drives Google's Knowledge Panel and rich service results.
 */
export function createServiceSchema({
  name,
  description,
  url,
  serviceType,
  offers = [],
}: {
  name: string;
  description: string;
  url: string;
  serviceType: string;
  offers?: ServiceOffer[];
}): Record<string, unknown> {
  return {
    '@type': 'FinancialService',
    name,
    description,
    url,
    serviceType,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'Country',
      name: 'South Africa',
    },
    ...(offers.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `${name} Products`,
            itemListElement: offers.map((offer) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: offer.name,
                ...(offer.description ? { description: offer.description } : {}),
              },
            })),
          },
        }
      : {}),
  };
}
