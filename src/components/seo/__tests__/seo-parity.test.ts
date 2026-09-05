/**
 * Guards against drift between the two SEO metadata sources:
 * - Client-side: src/components/seo/SEO.tsx + seo-config.ts (applied on hydration)
 * - Build-time: scripts/seo/seo-static-data.mjs (prerendered into per-route HTML)
 *
 * Google sees both (static head first, hydrated head after rendering JS), so
 * they must agree or pages send mixed signals.
 */
import { describe, it, expect } from 'vitest';
import { createOrganizationSchema } from '../SEO';
import { seoPages } from '../seo-config';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
// Plain-JS build script module (no type declarations).
import * as seoStaticData from '../../../../scripts/seo/seo-static-data.mjs';

const {
  createOrganizationSchema: createBuildOrganizationSchema,
  publicSeoRoutes,
  SEO_TITLE_MAX,
} = seoStaticData as {
  createOrganizationSchema: (siteUrl: string) => Record<string, unknown>;
  publicSeoRoutes: Array<{ path: string; title: string }>;
  SEO_TITLE_MAX: number;
};

describe('organization schema parity', () => {
  it('client and build-time Organization schemas are identical', () => {
    expect(createOrganizationSchema()).toEqual(createBuildOrganizationSchema(SITE_ORIGIN));
  });
});

describe('title constraints', () => {
  it('every client page title fits within the SERP-safe length', () => {
    for (const [key, data] of Object.entries(seoPages)) {
      expect(
        data.title.length,
        `seoPages['${key}'] title exceeds ${SEO_TITLE_MAX} chars`,
      ).toBeLessThanOrEqual(SEO_TITLE_MAX);
    }
  });

  it('every build-time route title fits within the SERP-safe length', () => {
    for (const route of publicSeoRoutes) {
      expect(
        route.title.length,
        `route '${route.path}' title exceeds ${SEO_TITLE_MAX} chars`,
      ).toBeLessThanOrEqual(SEO_TITLE_MAX);
    }
  });

  it('client and build-time titles agree for pages defined in both', () => {
    const clientTitleByPath = new Map(
      Object.values(seoPages).map((data) => [
        data.canonicalUrl.replace(SITE_ORIGIN, '') || '/',
        data.title,
      ]),
    );
    for (const route of publicSeoRoutes) {
      const clientTitle = clientTitleByPath.get(route.path);
      if (clientTitle) {
        expect(clientTitle, `title mismatch for ${route.path}`).toBe(route.title);
      }
    }
  });
});
