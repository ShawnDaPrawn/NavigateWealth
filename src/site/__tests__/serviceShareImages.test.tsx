/**
 * Share images: every service page points its og:image at its own share
 * image (public/brand-assets/share/<page>.png, drawn from the ShareService
 * board) in both designs, the file exists and is a 1200×630 PNG under 300 KB,
 * and pages without their own image get the brand share image (ShareBrand)
 * as the site default. The previous default stays in public/.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

let design: 'navigator' | 'legacy' = 'navigator';
vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return design;
  },
  resolveSiteDesign: () => design,
}));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
vi.mock('../../components/modals/ConsultationModal', () => ({ ConsultationModal: () => null }));

// jsdom has no element scrolling; the pages' tab strips call it on mount.
Element.prototype.scrollTo = () => {};

const { SITE_ORIGIN } = await import('../../utils/siteOrigin');
const { SEO } = await import('../../components/seo/SEO');
const { SERVICE_SHARE_IMAGE_PATHS, BRAND_SHARE_IMAGE_PATH } =
  await import('../../components/seo/shareImages');

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public');

const PAGES: { seoKey: string; route: string; load: () => Promise<ComponentType> }[] = [
  {
    seoKey: 'retirement-planning',
    route: '/retirement-planning',
    load: async () =>
      (await import('../../components/pages/RetirementPlanningPage')).RetirementPlanningPage,
  },
  {
    seoKey: 'risk-management',
    route: '/risk-management',
    load: async () =>
      (await import('../../components/pages/RiskManagementPage')).RiskManagementPage,
  },
  {
    seoKey: 'investment-management',
    route: '/investment-management',
    load: async () =>
      (await import('../../components/pages/InvestmentManagementPage')).InvestmentManagementPage,
  },
  {
    seoKey: 'tax-planning',
    route: '/tax-planning',
    load: async () => (await import('../../components/pages/TaxPlanningPage')).TaxPlanningPage,
  },
  {
    seoKey: 'estate-planning',
    route: '/estate-planning',
    load: async () =>
      (await import('../../components/pages/EstatePlanningPage')).EstatePlanningPage,
  },
  {
    seoKey: 'financial-planning',
    route: '/financial-planning',
    load: async () =>
      (await import('../../components/pages/FinancialPlanningPage')).FinancialPlanningPage,
  },
  {
    seoKey: 'medical-aid',
    route: '/medical-aid',
    load: async () => (await import('../../components/pages/MedicalAidPage')).MedicalAidPage,
  },
  {
    seoKey: 'employee-benefits',
    route: '/employee-benefits',
    load: async () =>
      (await import('../../components/pages/EmployeeBenefitsPage')).EmployeeBenefitsPage,
  },
];

function meta(property: string) {
  return document.querySelector(`meta[property="${property}"]`)?.getAttribute('content');
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function expectShareFile(path: string) {
  const file = resolve(PUBLIC_DIR, `.${path}`);
  expect(existsSync(file), file).toBe(true);
  expect(pngSize(file)).toEqual({ width: 1200, height: 630 });
  expect(statSync(file).size).toBeLessThan(300 * 1024);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  document.head.querySelectorAll('meta[property^="og:image"]').forEach((m) => m.remove());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.getElementById('seo-structured-data')?.remove();
});

describe('service share images', () => {
  it('has one image per service page, each its own file', () => {
    expect(Object.keys(SERVICE_SHARE_IMAGE_PATHS).sort()).toEqual(
      PAGES.map((p) => p.seoKey).sort(),
    );
    const paths = Object.values(SERVICE_SHARE_IMAGE_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expectShareFile(path);
  });

  for (const which of ['navigator', 'legacy'] as const) {
    for (const page of PAGES) {
      it(`${page.route} (${which}) shares /brand-assets/share/${page.seoKey}.png`, async () => {
        design = which;
        const Page = await page.load();
        render(
          <MemoryRouter initialEntries={[page.route]}>
            <Page />
          </MemoryRouter>,
        );
        const expected = `${SITE_ORIGIN}${SERVICE_SHARE_IMAGE_PATHS[page.seoKey]}`;
        expect(SERVICE_SHARE_IMAGE_PATHS[page.seoKey]).toBe(
          `/brand-assets/share/${page.seoKey}.png`,
        );
        await waitFor(() => expect(meta('og:image')).toBe(expected), { timeout: 5000 });
        expect(meta('og:image:width')).toBe('1200');
        expect(meta('og:image:height')).toBe('630');
      });
    }
  }
});

describe('the default share image', () => {
  it('is the brand share image, and the previous default is still served', () => {
    design = 'navigator';
    render(<SEO title="A page" description="Without an image of its own." />);
    expect(meta('og:image')).toBe(`${SITE_ORIGIN}${BRAND_SHARE_IMAGE_PATH}`);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expectShareFile(BRAND_SHARE_IMAGE_PATH);
    expect(existsSync(resolve(PUBLIC_DIR, 'brand-assets/navigate-wealth-og.png'))).toBe(true);
  });

  it('claims no dimensions for an image of unknown size', () => {
    render(<SEO title="Article" description="With a hero." ogImage="https://example.com/a.jpg" />);
    expect(meta('og:image')).toBe('https://example.com/a.jpg');
    expect(meta('og:image:width')).toBeUndefined();
  });
});
