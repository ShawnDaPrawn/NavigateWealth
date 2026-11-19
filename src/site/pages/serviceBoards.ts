/**
 * What the eight service-page boards draw differently from one another.
 *
 * The boards come in three layouts:
 * - `standard` (Medical Aid, Retirement, Investment, Employee Benefits):
 *   breadcrumb inside the hero copy, an "On this page" bar, products with a
 *   position counter and a "Next" button, the approach on navy, partner tiles
 *   on white;
 * - `jump` (Tax, Estate, Financial Planning): breadcrumb above the hero grid,
 *   a jump bar with "Call Me Back", tabs beside each section heading, the
 *   approach as white cards, partners on a navy band;
 * - `risk` (Risk Management): no breadcrumb or bar, a single quote action,
 *   tabs beside each heading, a partner logo strip, no approach section.
 *
 * Copy stays in each page's config; this holds layout, icons and the few
 * measurements that vary page to page.
 */
import type { ServiceIconName } from '../sections/serviceIcons';

export type ServiceLayout = 'standard' | 'jump' | 'risk';

export interface ServiceBoard {
  layout: ServiceLayout;
  /** Hero badge, status card and the two product groups' image chips. */
  icons: {
    badge: ServiceIconName;
    status: ServiceIconName;
    ind: ServiceIconName;
    biz: ServiceIconName;
  };
  /** Breadcrumb without the "Services" step (Financial Planning's board). */
  shortCrumbs?: boolean;
  /** Width of the heading beside the tabs (`jump` layout): individuals, businesses. */
  headWidth?: [number, number];
  /** Tab padding (`jump` layout): individuals, businesses. */
  tabPad?: [number, number];
  /** Partner tiles on white (`standard` layout). */
  tiles?: { maxWidth: number; height: number; logoWidth: number; logoHeight: number };
  /** Lead width under the approach heading (`standard` layout). */
  approachLead?: number;
  /** Partner band (`jump` layout): one described partner, a pair, or a grid. */
  partners?: 'card' | 'pair' | 'grid';
  /** The line under the described partner's name (`card`). */
  partnerNote?: string;
  /** The FAQ lead, where the board words it differently from the default. */
  faqLead?: string;
  /** The H1's two lines, where the board spells them differently. */
  heading?: [string, string];
}

const STANDARD_TILES = { maxWidth: 220, height: 132, logoWidth: 130, logoHeight: 50 };

export const SERVICE_BOARDS: Record<string, ServiceBoard> = {
  'risk-management': {
    layout: 'risk',
    icons: { badge: 'shield', status: 'shieldCheck', ind: 'shield', biz: 'briefcase' },
    faqLead: 'Clear answers to the questions clients ask us most about life and disability cover.',
  },
  'medical-aid': {
    layout: 'standard',
    icons: { badge: 'heart', status: 'activity', ind: 'heart', biz: 'briefcase' },
    tiles: { maxWidth: 240, height: 136, logoWidth: 140, logoHeight: 52 },
    approachLead: 640,
  },
  'retirement-planning': {
    layout: 'standard',
    icons: { badge: 'target', status: 'trendingUp', ind: 'user', biz: 'briefcase' },
    tiles: STANDARD_TILES,
    approachLead: 700,
    faqLead: 'Clear answers to the questions clients ask us most about planning for retirement.',
  },
  'investment-management': {
    layout: 'standard',
    icons: { badge: 'trendingUp', status: 'pieChart', ind: 'pieChart', biz: 'briefcase' },
    tiles: { ...STANDARD_TILES, maxWidth: 230 },
    approachLead: 700,
    faqLead: 'Clear answers to the questions clients ask us most about investing.',
  },
  'employee-benefits': {
    layout: 'standard',
    icons: { badge: 'briefcase', status: 'users', ind: 'users', biz: 'briefcase' },
    tiles: STANDARD_TILES,
    approachLead: 700,
    faqLead: 'Clear answers to the questions employers ask us most about group benefits.',
  },
  'tax-planning': {
    layout: 'jump',
    heading: ['Maximize Your', 'Tax Efficiency'],
    icons: { badge: 'calculator', status: 'checkCircle', ind: 'calculatorShort', biz: 'briefcase' },
    headWidth: [640, 640],
    tabPad: [16, 16],
    partners: 'card',
    partnerNote: 'Tax return preparation and SARS compliance management.',
  },
  'estate-planning': {
    layout: 'jump',
    icons: { badge: 'users', status: 'checkCircle', ind: 'heart', biz: 'briefcase' },
    headWidth: [640, 640],
    tabPad: [16, 16],
    partners: 'pair',
    faqLead:
      'Clear answers to the questions clients ask us most about wills, trusts and estate planning.',
  },
  'financial-planning': {
    layout: 'jump',
    icons: { badge: 'compass', status: 'checkCircle', ind: 'clipboardList', biz: 'briefcase' },
    shortCrumbs: true,
    headWidth: [600, 640],
    tabPad: [15, 16],
    partners: 'grid',
  },
};

const FALLBACK: ServiceBoard = SERVICE_BOARDS['medical-aid'];

export function serviceBoard(seoKey: string): ServiceBoard {
  return SERVICE_BOARDS[seoKey] ?? FALLBACK;
}
