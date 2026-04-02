/**
 * Shared constants for Login and Signup pages.
 * Single source of truth for stats, feature showcases, and shared form data.
 */

// ─── Stat Cards (Right Column) ─────────────────────────────────────────────────
export const AUTH_STATS = [
  { value: '1,000+', label: 'Active Clients' },
  { value: 'R500m+', label: 'Assets Managed' },
  { value: '55+', label: 'Years Experience' },
] as const;

// ─── Feature Showcase Items ────────────────────────────────────────────────────
export const LOGIN_FEATURES = [
  {
    iconSlug: 'TrendingUp',
    title: 'Real-Time Portfolio Tracking',
    description: 'Monitor your investments, see live performance, and track progress against your goals.',
  },
  {
    iconSlug: 'Shield',
    title: 'Enterprise-Grade Security',
    description: 'Two-factor authentication, encryption at rest, and full POPIA compliance protect your data.',
  },
  {
    iconSlug: 'Users',
    title: 'Dedicated Advisor Access',
    description: 'Connect directly with your personal financial advisor for guidance whenever you need it.',
  },
] as const;

export const SIGNUP_FEATURES = [
  {
    iconSlug: 'Target',
    title: 'Tailored Financial Plans',
    description: 'Receive a personalised strategy built around your income, goals, and risk appetite.',
  },
  {
    iconSlug: 'Shield',
    title: 'Bank-Level Protection',
    description: 'Your information is encrypted with POPIA-compliant infrastructure from day one.',
  },
  {
    iconSlug: 'Headphones',
    title: 'Ongoing Professional Support',
    description: 'A qualified advisor is assigned to you and available throughout your financial journey.',
  },
] as const;

// ─── Country Codes ─────────────────────────────────────────────────────────────
export interface CountryCode {
  code: string;
  flag: string;
  name: string;
  priority: boolean; // true = SADC / primary market countries shown first
}

export const COUNTRY_CODES: CountryCode[] = [
  // ── Priority: South Africa + SADC region ──
  { code: '+27',  flag: '\u{1F1FF}\u{1F1E6}', name: 'South Africa',  priority: true },
  { code: '+267', flag: '\u{1F1E7}\u{1F1FC}', name: 'Botswana',      priority: true },
  { code: '+264', flag: '\u{1F1F3}\u{1F1E6}', name: 'Namibia',       priority: true },
  { code: '+263', flag: '\u{1F1FF}\u{1F1FC}', name: 'Zimbabwe',      priority: true },
  { code: '+260', flag: '\u{1F1FF}\u{1F1F2}', name: 'Zambia',        priority: true },
  { code: '+258', flag: '\u{1F1F2}\u{1F1FF}', name: 'Mozambique',    priority: true },
  { code: '+230', flag: '\u{1F1F2}\u{1F1FA}', name: 'Mauritius',     priority: true },
  { code: '+255', flag: '\u{1F1F9}\u{1F1FF}', name: 'Tanzania',      priority: true },
  { code: '+254', flag: '\u{1F1F0}\u{1F1EA}', name: 'Kenya',         priority: true },
  // ── Other countries ──
  { code: '+1',   flag: '\u{1F1FA}\u{1F1F8}', name: 'United States', priority: false },
  { code: '+44',  flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom',priority: false },
  { code: '+61',  flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia',     priority: false },
  { code: '+64',  flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand',   priority: false },
  { code: '+91',  flag: '\u{1F1EE}\u{1F1F3}', name: 'India',         priority: false },
  { code: '+86',  flag: '\u{1F1E8}\u{1F1F3}', name: 'China',         priority: false },
  { code: '+81',  flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan',         priority: false },
  { code: '+82',  flag: '\u{1F1F0}\u{1F1F7}', name: 'South Korea',   priority: false },
  { code: '+65',  flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore',     priority: false },
  { code: '+60',  flag: '\u{1F1F2}\u{1F1FE}', name: 'Malaysia',      priority: false },
  { code: '+49',  flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany',       priority: false },
  { code: '+33',  flag: '\u{1F1EB}\u{1F1F7}', name: 'France',        priority: false },
  { code: '+39',  flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy',         priority: false },
  { code: '+34',  flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain',         priority: false },
  { code: '+31',  flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands',   priority: false },
  { code: '+41',  flag: '\u{1F1E8}\u{1F1ED}', name: 'Switzerland',   priority: false },
  { code: '+46',  flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden',        priority: false },
  { code: '+47',  flag: '\u{1F1F3}\u{1F1F4}', name: 'Norway',        priority: false },
  { code: '+45',  flag: '\u{1F1E9}\u{1F1F0}', name: 'Denmark',       priority: false },
  { code: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Ireland',       priority: false },
  { code: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal',      priority: false },
  { code: '+48',  flag: '\u{1F1F5}\u{1F1F1}', name: 'Poland',        priority: false },
  { code: '+43',  flag: '\u{1F1E6}\u{1F1F9}', name: 'Austria',       priority: false },
  { code: '+32',  flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgium',       priority: false },
  { code: '+358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finland',       priority: false },
  { code: '+30',  flag: '\u{1F1EC}\u{1F1F7}', name: 'Greece',        priority: false },
  { code: '+90',  flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkey',        priority: false },
  { code: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'UAE',           priority: false },
  { code: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi Arabia',  priority: false },
  { code: '+20',  flag: '\u{1F1EA}\u{1F1EC}', name: 'Egypt',         priority: false },
  { code: '+234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria',       priority: false },
  { code: '+233', flag: '\u{1F1EC}\u{1F1ED}', name: 'Ghana',         priority: false },
  { code: '+256', flag: '\u{1F1FA}\u{1F1EC}', name: 'Uganda',        priority: false },
  { code: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Morocco',       priority: false },
  { code: '+52',  flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexico',        priority: false },
  { code: '+55',  flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil',        priority: false },
  { code: '+54',  flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina',     priority: false },
  { code: '+56',  flag: '\u{1F1E8}\u{1F1F1}', name: 'Chile',         priority: false },
  { code: '+57',  flag: '\u{1F1E8}\u{1F1F4}', name: 'Colombia',      priority: false },
  { code: '+7',   flag: '\u{1F1F7}\u{1F1FA}', name: 'Russia',        priority: false },
  { code: '+380', flag: '\u{1F1FA}\u{1F1E6}', name: 'Ukraine',       priority: false },
  { code: '+66',  flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand',      priority: false },
  { code: '+63',  flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippines',   priority: false },
  { code: '+62',  flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesia',     priority: false },
  { code: '+84',  flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam',       priority: false },
  { code: '+852', flag: '\u{1F1ED}\u{1F1F0}', name: 'Hong Kong',     priority: false },
  { code: '+886', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan',        priority: false },
  { code: '+92',  flag: '\u{1F1F5}\u{1F1F0}', name: 'Pakistan',      priority: false },
  { code: '+880', flag: '\u{1F1E7}\u{1F1E9}', name: 'Bangladesh',    priority: false },
  { code: '+94',  flag: '\u{1F1F1}\u{1F1F0}', name: 'Sri Lanka',     priority: false },
];
