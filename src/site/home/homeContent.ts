/**
 * Small helpers and constants for the Navigator home and services pages.
 * Kept out of the component files so each of those exports components only.
 *
 * Copy itself comes from the live pages' data modules
 * (components/pages/homePageData.tsx, servicesPageData.ts); nothing here
 * states a fact about the firm.
 */

/** The home page's one H1: what people search for. The live slides follow it. */
export const HOME_H1 = 'Independent Wealth Management and Financial Advice in South Africa';
export const SERVICES_H1 = 'Financial Advice and Wealth Management Services';

/** How long each hero slide shows before the next, in ms. Matches the fill bar's CSS. */
export const HERO_SLIDE_MS = 8000;

/** The compass reading shown with each hero slide (decoration only). */
export const COMPASS_READINGS = [
  { degrees: 32, label: '032° NNE' },
  { degrees: 58, label: '058° ENE' },
  { degrees: 14, label: '014° NNE' },
  { degrees: 76, label: '076° ENE' },
] as const;

export const CONSULTATION_PATH = '/schedule-consultation';
export const QUOTE_PATH = '/get-quote';
export const INSIGHTS_PATH = '/resources?section=insights';
export const PRIVACY_NOTICE_PATH = '/legal/privacy-notice';

/**
 * The live data predates the house style's South African spelling. The
 * redesign shows the same sentences with these words spelt the local way;
 * nothing else changes. (FAQ text is left alone: it must match its JSON-LD.)
 */
const SA_SPELLING: readonly [RegExp, string][] = [
  [/\bMaximize\b/g, 'Maximise'],
  [/\bmaximize\b/g, 'maximise'],
  [/\bMinimize\b/g, 'Minimise'],
  [/\bminimize\b/g, 'minimise'],
  [/\boptimize\b/g, 'optimise'],
  [/\binquiry\b/g, 'enquiry'],
  [/\bPrograms\b/g, 'Programmes'],
];

export function saSpelling(text: string): string {
  return SA_SPELLING.reduce((out, [pattern, word]) => out.replace(pattern, word), text);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── "Get Started" enquiry form ──────────────────────────────────────────────

export type StartField = 'firstName' | 'lastName' | 'email' | 'phone';
export type StartErrors = Partial<Record<StartField, string>>;
export const START_FIELDS: readonly StartField[] = ['firstName', 'lastName', 'email', 'phone'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]+$/;

/** What is wrong with each field, in the words shown under it. */
export function validateStart(values: Record<StartField, string>): StartErrors {
  const errors: StartErrors = {};
  if (!values.firstName.trim()) errors.firstName = 'Enter your first name';
  if (!values.lastName.trim()) errors.lastName = 'Enter your last name';
  const email = values.email.trim();
  if (!email) errors.email = 'Enter your email address';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address';
  const phone = values.phone.trim();
  // The endpoint requires a phone number: digits, spaces, + - and brackets, 9+ digits.
  if (!phone) errors.phone = 'Enter your phone number';
  else if (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, '').length < 9)
    errors.phone = 'Enter a valid phone number';
  return errors;
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export function formatPostedOn(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
