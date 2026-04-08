/**
 * Submissions Manager — Constants
 *
 * Config-driven status indicators, type labels, and column definitions.
 * Per §5.3 — all display state is centralised here, never inlined in JSX.
 * Per §8.3 — colour vocabulary follows platform status standards.
 */

import type { SubmissionStatus, SubmissionType, SubmissionColumn } from './types';

// ── Site Base URL ─────────────────────────────────────────────────────────────
import { SITE_ORIGIN } from '@/utils/siteOrigin';

export const SITE_BASE_URL = SITE_ORIGIN;

// ── Status Config ─────────────────────────────────────────────────────────────
// §8.3: Blue=Informational (new), Amber=Pending, Green=Completed, Gray=Archived

export const SUBMISSION_STATUS_CONFIG: Record<
  SubmissionStatus,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
    columnHeaderClass: string;
  }
> = {
  new: {
    label: 'New',
    badgeClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    dotClass: 'bg-blue-500',
    columnHeaderClass: 'border-t-blue-500',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
    columnHeaderClass: 'border-t-amber-500',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
    columnHeaderClass: 'border-t-green-500',
  },
  archived: {
    label: 'Archived',
    badgeClass: 'bg-gray-500 hover:bg-gray-600 text-white',
    dotClass: 'bg-gray-400',
    columnHeaderClass: 'border-t-gray-400',
  },
};

// ── Type Config ───────────────────────────────────────────────────────────────

export const SUBMISSION_TYPE_CONFIG: Record<
  SubmissionType,
  { label: string; shortLabel: string; iconName: string }
> = {
  quote: {
    label: 'Quote Request',
    shortLabel: 'Quote',
    iconName: 'MessageSquare',
  },
  will_draft: {
    label: 'Will Draft',
    shortLabel: 'Will',
    iconName: 'FileText',
  },
  tax_planning: {
    label: 'Tax Planning',
    shortLabel: 'Tax',
    iconName: 'Calculator',
  },
  consultation: {
    label: 'Consultation',
    shortLabel: 'Consult',
    iconName: 'Calendar',
  },
  contact: {
    label: 'Contact Enquiry',
    shortLabel: 'Contact',
    iconName: 'Mail',
  },
  client_signup: {
    label: 'New Client Signup',
    shortLabel: 'Signup',
    iconName: 'UserPlus',
  },
};

// ── Source Channel Config ─────────────────────────────────────────────────────

export const SOURCE_CHANNEL_LABELS: Record<string, string> = {
  website_form: 'Website Form',
  admin: 'Admin Created',
  client_portal: 'Client Portal',
};

// ── Board Column Definitions ──────────────────────────────────────────────────

export const SUBMISSION_COLUMNS: SubmissionColumn[] = [
  {
    id: 'new',
    label: 'New',
    description: 'Freshly submitted — awaiting action',
  },
  {
    id: 'pending',
    label: 'Pending',
    description: 'Being reviewed or waiting on client',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Fully resolved',
  },
  {
    id: 'archived',
    label: 'Archived',
    description: 'No further action required',
  },
];

/** Board-only columns (excludes archived — archived has its own view) */
export const BOARD_COLUMNS: SubmissionColumn[] = [
  {
    id: 'new',
    label: 'New',
    description: 'Freshly submitted — awaiting action',
  },
  {
    id: 'pending',
    label: 'Pending',
    description: 'Being reviewed or waiting on client',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Fully resolved',
  },
];

// ── Submission Invite Config ──────────────────────────────────────────────────
// §5.3 — Centralised config for client-facing submission invite links.
// Used by the SubmissionInviteModal to generate shareable links and send
// branded invitation emails directing clients to the appropriate form.

export interface SubmissionInviteType {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  iconName: string;
  /** Relative path on the public site */
  path: string;
  /** Email subject line */
  emailSubject: string;
  /** Email body intro (HTML) */
  emailBody: string;
  /** Button label in the email */
  emailButtonLabel: string;
  /** Accent colour class for the card */
  accentClass: string;
  /** Icon background colour class */
  iconBgClass: string;
  /** Icon text colour class */
  iconTextClass: string;
}

export const SUBMISSION_INVITE_TYPES: SubmissionInviteType[] = [
  {
    id: 'get-quote',
    label: 'Get a Quote',
    shortLabel: 'Quote',
    description: 'Request a personalised quote across any of our financial services',
    iconName: 'MessageSquare',
    path: '/get-quote',
    emailSubject: 'Get Your Personalised Quote — Navigate Wealth',
    emailBody: '<p>We\'d love to help you find the right financial solution. Click the button below to request a personalised quote — it only takes a few minutes.</p><p>Our independent advisers will compare options from South Africa\'s leading providers to find the best fit for your needs and budget.</p>',
    emailButtonLabel: 'Get My Quote',
    accentClass: 'border-purple-200 hover:border-purple-300',
    iconBgClass: 'bg-purple-50',
    iconTextClass: 'text-purple-600',
  },
  {
    id: 'schedule-consultation',
    label: 'Schedule a Meeting',
    shortLabel: 'Meeting',
    description: 'Book a consultation with one of our financial advisers',
    iconName: 'Calendar',
    path: '/schedule-consultation',
    emailSubject: 'Schedule Your Consultation — Navigate Wealth',
    emailBody: '<p>We\'d like to invite you to schedule a consultation with one of our qualified financial advisers.</p><p>Whether you have questions about your existing portfolio, want to explore new options, or need guidance on a specific financial matter — we\'re here to help.</p>',
    emailButtonLabel: 'Book My Consultation',
    accentClass: 'border-blue-200 hover:border-blue-300',
    iconBgClass: 'bg-blue-50',
    iconTextClass: 'text-blue-600',
  },
  {
    id: 'estate-planning-quote',
    label: 'Estate Planning Quote',
    shortLabel: 'Estate Quote',
    description: 'Request an estate planning consultation — trusts, succession, estate duty',
    iconName: 'Landmark',
    path: '/get-quote/estate-planning/contact',
    emailSubject: 'Estate Planning Consultation — Navigate Wealth',
    emailBody: '<p>Proper estate planning protects your family and ensures your wishes are honoured. Our qualified advisers can guide you through trusts, succession planning, estate duty, and more.</p><p>Click below to request an estate planning consultation — there\'s no obligation.</p>',
    emailButtonLabel: 'Get My Estate Planning Quote',
    accentClass: 'border-emerald-200 hover:border-emerald-300',
    iconBgClass: 'bg-emerald-50',
    iconTextClass: 'text-emerald-600',
  },
  {
    id: 'ai-will-drafting',
    label: 'AI Will Drafting',
    shortLabel: 'Will Drafting',
    description: 'Draft your will with our AI-powered will drafting agent — guided, step by step',
    iconName: 'FileText',
    path: '/get-quote/estate-planning/contact?will=true',
    emailSubject: 'Draft Your Will — Navigate Wealth AI Assistant',
    emailBody: '<p>Protecting your loved ones starts with a properly drafted will. Our AI-powered Will Drafting Agent guides you through the entire process — step by step, in plain language.</p><p>Click the button below to get started. It\'s quick, secure, and you can save your progress at any time.</p>',
    emailButtonLabel: 'Start My Will',
    accentClass: 'border-cyan-200 hover:border-cyan-300',
    iconBgClass: 'bg-cyan-50',
    iconTextClass: 'text-cyan-600',
  },
  {
    id: 'contact-us',
    label: 'Contact Us',
    shortLabel: 'Contact',
    description: 'Send a general enquiry or request a callback',
    iconName: 'Mail',
    path: '/contact',
    emailSubject: 'We\'d Love to Hear From You — Navigate Wealth',
    emailBody: '<p>Have a question or want to know more about how Navigate Wealth can help you? We\'re here for you.</p><p>Click the button below to send us a message and one of our team members will get back to you promptly.</p>',
    emailButtonLabel: 'Contact Us',
    accentClass: 'border-amber-200 hover:border-amber-300',
    iconBgClass: 'bg-amber-50',
    iconTextClass: 'text-amber-600',
  },
  // REMOVED: 'financial-review' invite type — '/get-quote/financial-planning' does not
  // exist as a service page (Financial Planning is a holistic service without a
  // dedicated quote wizard; see ServicesPage.tsx comment near line 389).
  {
    id: 'tax-planning',
    label: 'Tax Planning',
    shortLabel: 'Tax',
    description: 'Expert tax-efficient strategies and optimisation',
    iconName: 'Calculator',
    path: '/get-quote/tax-planning/contact',
    emailSubject: 'Tax Planning Consultation — Navigate Wealth',
    emailBody: '<p>Are you making the most of your tax-efficient investment opportunities? Our team can help you develop strategies to optimise your tax position — legally and sustainably.</p><p>Click below to request a tax planning consultation.</p>',
    emailButtonLabel: 'Plan My Tax Strategy',
    accentClass: 'border-teal-200 hover:border-teal-300',
    iconBgClass: 'bg-teal-50',
    iconTextClass: 'text-teal-600',
  },
  {
    id: 'retirement-planning',
    label: 'Retirement Planning',
    shortLabel: 'Retirement',
    description: 'Plan for a comfortable and secure retirement',
    iconName: 'TrendingUp',
    path: '/get-quote/retirement-planning/contact',
    emailSubject: 'Retirement Planning — Navigate Wealth',
    emailBody: '<p>It\'s never too early — or too late — to start planning for retirement. Our advisers will help you build a strategy that ensures financial security in your golden years.</p><p>Click below to begin your retirement planning journey.</p>',
    emailButtonLabel: 'Plan My Retirement',
    accentClass: 'border-orange-200 hover:border-orange-300',
    iconBgClass: 'bg-orange-50',
    iconTextClass: 'text-orange-600',
  },
];