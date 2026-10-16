/**
 * Company facts — the single source of truth for every claim the public site
 * makes about Navigate Wealth itself.
 *
 * WHY THIS EXISTS. In October 2026 a business-directory listing was declined
 * because the website "manufactured its own credibility": the About, Press and
 * Careers pages carried figures with nothing behind them that also contradicted
 * each other — 55+, 25+ or 15+ years of combined experience depending on the
 * page, 200+ clients on one page and 195+ on another, "2+ years in business"
 * beside a licence dated February 2025, "20+ team members" on a site whose Team
 * page named no one, and a Cape Town office that does not exist. Each page had
 * typed its own numbers, so nothing kept them in step.
 *
 * The rule now: a page states a fact about the firm only if it is listed here,
 * and everything listed here can be checked by a third party — the FSCA
 * register, the CIPC record, the office address. Client counts, experience
 * totals, retention rates and asset figures stay off the site unless they can
 * be evidenced; if one ever can be, it is added here, once, and read from here.
 */
import { Building2, Globe, Shield, UserCheck, type LucideIcon } from 'lucide-react';

export const COMPANY = {
  tradingName: 'Navigate Wealth',
  legalName: 'Wealthfront (Pty) Ltd',
  registrationNumber: '2024/071953/07',
  foundedYear: 2024,
  fspNumber: '54606',
  regulator: 'Financial Sector Conduct Authority (FSCA)',
  fscaAuthorisedOn: '4 February 2025',
  headquarters: 'Pretoria, South Africa',
  office: 'Route 21 Business Park, Pretoria',
} as const;

export const FOUNDER = {
  name: 'Shawn Francisco',
  title: 'Founder',
  /** Optimised variants live under public/img/optimized/<imageKey>-<width>.<format>. */
  imageKey: 'founder-shawn-francisco',
  /**
   * The founder's note on the About page. Every statement in it is either a
   * checkable fact from COMPANY or a commitment about how the practice works —
   * no invented biography, credentials or figures.
   */
  note: [
    `I started ${COMPANY.tradingName} in ${COMPANY.foundedYear} with a simple aim: to give South African individuals, families and business owners the kind of financial advice I would want for my own family — independent, transparent and personal.`,
    `${COMPANY.tradingName} is a founder-led practice. When you work with us, you work with me directly. I take the time to understand where you are and where you want to be, explain your options in plain language, and recommend what genuinely suits your needs. Because we are independent and not tied to any single product provider, we can compare solutions from a range of providers rather than selling one company's products.`,
    `Our licence as an authorised financial services provider (FSP ${COMPANY.fspNumber}) was granted by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}. We take the obligations that come with it seriously: fees disclosed upfront, advice recorded and explained, and regular reviews as your life changes.`,
    `We are building this practice one relationship at a time. If you would like to talk through your plans, I would be glad to meet you.`,
  ],
} as const;

export interface TrustFact {
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The trust strip shown wherever a page used to show headline stats. Pages
 * that have room for three take the first three, so order by importance.
 */
export const TRUST_FACTS: readonly TrustFact[] = [
  { value: `FSP ${COMPANY.fspNumber}`, label: 'FSCA-authorised', icon: Shield },
  { value: 'Independent', label: 'Not tied to one provider', icon: Globe },
  { value: 'Founder-led', label: 'Advice from the founder', icon: UserCheck },
  { value: `Est. ${COMPANY.foundedYear}`, label: COMPANY.headquarters, icon: Building2 },
];
