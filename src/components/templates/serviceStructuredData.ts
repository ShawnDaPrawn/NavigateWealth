/**
 * The JSON-LD every service page emits, shared by both designs so the
 * redesign cannot drift from what search engines already read: the
 * organisation, the service with its offers, the breadcrumb trail, and — when
 * the page shows FAQs — an FAQPage whose text matches the visible answers.
 */
import {
  createBreadcrumbSchema,
  createFAQSchema,
  createOrganizationSchema,
  createServiceSchema,
} from '../seo/SEO';
import type { ServicePageConfig, ServicePageSeoData } from './ServicePageTemplate';

export function buildServiceStructuredData(
  config: ServicePageConfig,
  seoData: ServicePageSeoData,
): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    createOrganizationSchema(),
    createServiceSchema({
      name: config.structuredDataServiceName,
      description: seoData.description,
      url: seoData.canonicalUrl,
      serviceType: config.structuredDataServiceType,
      offers: config.structuredDataOffers,
    }),
    createBreadcrumbSchema(config.breadcrumbs),
  ];
  if (config.faqs && config.faqs.length > 0) {
    graph.push(createFAQSchema(config.faqs));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
