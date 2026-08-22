/**
 * What an email signature is made of: the field set, the four templates, and
 * the defaults.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). No React here — the
 * shape of a signature is data, and the saved-format feature stores exactly
 * this subset of it in localStorage.
 */

export interface SignatureData {
  fullName: string;
  jobTitle: string;
  qualifications: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  linkedinUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  xUrl: string;
  disclaimerText: string;
  logoUrl: string;
  logoSize: number;
  logoTransparentBg: boolean;
  primaryColour: string;
  secondaryColour: string;
  nameColour: string;
  titleColour: string;
  showFspTagline: boolean;
}

/** Fields that define a reusable branding format (excludes personal details). */
export const FORMAT_FIELD_KEYS: (keyof SignatureData)[] = [
  'website',
  'address',
  'linkedinUrl',
  'instagramUrl',
  'youtubeUrl',
  'xUrl',
  'disclaimerText',
  'logoUrl',
  'logoSize',
  'logoTransparentBg',
  'primaryColour',
  'secondaryColour',
  'nameColour',
  'titleColour',
  'showFspTagline',
];

/** A saved branding preset — stores template + format fields, not personal details. */
export interface SavedFormat {
  id: string;
  name: string;
  createdAt: string;
  template: string;
  fields: Partial<SignatureData>;
}

export const FORMAT_STORAGE_KEY = 'navigate_wealth_signature_formats';

// ============================================================================
// CONSTANTS
// ============================================================================

export const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Two-column layout with gradient accent — best for everyday use',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Centred layout with refined dividers — ideal for senior staff',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Purple banner header with strong visual impact',
  },
  {
    id: 'navigate',
    name: 'Navigate',
    description: 'Website-inspired dark charcoal with brand aesthetic',
  },
] as const;

export const DEFAULT_DATA: SignatureData = {
  fullName: '',
  jobTitle: '',
  qualifications: '',
  email: '',
  phone: '',
  mobile: '',
  website: 'www.navigatewealth.co.za',
  address: '',
  linkedinUrl: 'https://www.linkedin.com/company/navigatewealth/',
  instagramUrl: 'https://www.instagram.com/navigate_wealth',
  youtubeUrl: 'https://www.youtube.com/@navigatewealth',
  xUrl: '',
  disclaimerText:
    'This email and any attachments are confidential and intended solely for the addressee. If you are not the intended recipient, please notify the sender immediately and delete this email. Navigate Wealth is an authorised financial services provider (FSP No. 54606).',
  logoUrl: '',
  logoSize: 36,
  logoTransparentBg: false,
  primaryColour: '#6d28d9',
  secondaryColour: '#313653',
  nameColour: '',
  titleColour: '',
  showFspTagline: true,
};

export const FSP_TAGLINE = 'Proudly South African \u00B7 Fiercely Independent \u00B7 FSP 54606';

// ============================================================================
// SOCIAL ICON SVGs (inline for email compatibility)
// ============================================================================
