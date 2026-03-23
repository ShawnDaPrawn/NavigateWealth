/**
 * Brand / Corporate Identity — Frontend API
 *
 * All data access for the Corporate Identity tab.
 *
 * Guidelines:
 *   SS5.1 — API layer is the only layer that talks to the server
 */

import { api } from '../../../../../utils/api/client';

// ============================================================================
// TYPES (mirror server-side shapes)
// ============================================================================

export interface LogoEntry {
  id: string;
  variant: 'primary' | 'reversed' | 'icon' | 'social' | 'monochrome';
  label: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  hasTransparency?: boolean;
  usageNotes: string;
  uploadedAt: string;
  uploadedBy: string;
  signedUrl?: string | null;
  source?: 'uploaded' | 'builtin';
  previousVersions?: { storagePath: string; uploadedAt: string; uploadedBy: string }[];
}

export interface ColourSwatch {
  id: string;
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  cmyk?: { c: number; m: number; y: number; k: number };
  group: 'primary' | 'secondary' | 'accent' | 'neutral' | 'semantic';
  order: number;
}

export interface ColourPalette {
  swatches: ColourSwatch[];
  updatedAt: string;
  updatedBy: string;
}

export interface TypographyFont {
  id: string;
  role: 'heading' | 'body' | 'mono' | 'display';
  family: string;
  weights: number[];
  fallback: string;
}

export interface TypographyScale {
  token: string;
  label: string;
  size: string;
  lineHeight: string;
  weight: number;
}

export interface TypographyConfig {
  fonts: TypographyFont[];
  scale: TypographyScale[];
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CollateralItem {
  id: string;
  name: string;
  category: 'letterhead' | 'email_banner' | 'social_template' | 'watermark' | 'presentation' | 'business_card' | 'other';
  description: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  uploadedBy: string;
  signedUrl?: string | null;
}

export interface BrandRule {
  id: string;
  title: string;
  description: string;
  doImagePath?: string;
  dontImagePath?: string;
  order: number;
}

export interface BrandGuidelines {
  rules: BrandRule[];
  voice: {
    tone: string;
    terminology: string;
    notes: string;
  };
  pdfStoragePath?: string;
  pdfFileName?: string;
  lastReviewedAt?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BrandSummary {
  logoCount: number;
  colourCount: number;
  collateralCount: number;
  lastUpdated: string | null;
}

export const COLLATERAL_CATEGORIES = [
  { value: 'letterhead', label: 'Letterheads' },
  { value: 'email_banner', label: 'Email Banners' },
  { value: 'social_template', label: 'Social Templates' },
  { value: 'watermark', label: 'Watermarks' },
  { value: 'presentation', label: 'Presentations' },
  { value: 'business_card', label: 'Business Cards' },
  { value: 'other', label: 'Other' },
] as const;

export const LOGO_VARIANTS = [
  { value: 'primary', label: 'Primary (Full Colour)', description: 'Main logo for light backgrounds' },
  { value: 'reversed', label: 'Reversed (White/Light)', description: 'Logo for dark backgrounds' },
  { value: 'icon', label: 'Icon Only', description: 'Favicon, app icon, small formats' },
  { value: 'social', label: 'Social Media', description: 'Square crop for profile images' },
  { value: 'monochrome', label: 'Monochrome', description: 'Single-colour version for print' },
] as const;

const BUILTIN_LOGO_PACK = [
  {
    variant: 'primary',
    label: 'Primary (Full Colour)',
    fileName: 'navigate-wealth-primary.svg',
    signedUrl: '/brand-assets/navigate-wealth-primary.svg',
    usageNotes: 'Built-in Navigate Wealth primary logo for light backgrounds.',
  },
  {
    variant: 'reversed',
    label: 'Reversed (White/Light)',
    fileName: 'navigate-wealth-reversed.svg',
    signedUrl: '/brand-assets/navigate-wealth-reversed.svg',
    usageNotes: 'Built-in reversed logo for dark backgrounds.',
  },
  {
    variant: 'icon',
    label: 'Icon Only',
    fileName: 'navigate-wealth-icon.svg',
    signedUrl: '/brand-assets/navigate-wealth-icon.svg',
    usageNotes: 'Built-in favicon and compact icon mark.',
  },
  {
    variant: 'social',
    label: 'Social Media',
    fileName: 'navigate-wealth-social.svg',
    signedUrl: '/brand-assets/navigate-wealth-social.svg',
    usageNotes: 'Built-in square social avatar treatment.',
  },
  {
    variant: 'monochrome',
    label: 'Monochrome',
    fileName: 'navigate-wealth-monochrome.svg',
    signedUrl: '/brand-assets/navigate-wealth-monochrome.svg',
    usageNotes: 'Built-in single-colour version for print and embossing.',
  },
] as const satisfies Array<{
  variant: LogoEntry['variant'];
  label: string;
  fileName: string;
  signedUrl: string;
  usageNotes: string;
}>;

function getBuiltInLogoEntries(): LogoEntry[] {
  return BUILTIN_LOGO_PACK.map((asset) => ({
    id: `builtin-${asset.variant}`,
    variant: asset.variant,
    label: asset.label,
    fileName: asset.fileName,
    storagePath: asset.signedUrl,
    mimeType: asset.fileName.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
    fileSize: 0,
    usageNotes: asset.usageNotes,
    uploadedAt: '',
    uploadedBy: 'Navigate Wealth',
    signedUrl: asset.signedUrl,
    source: 'builtin',
  }));
}

function mergeBuiltInLogos(logos: LogoEntry[]): LogoEntry[] {
  const uploaded = logos.map((logo) => ({
    ...logo,
    source: logo.source ?? 'uploaded',
  }));
  const uploadedVariants = new Set(uploaded.map((logo) => logo.variant));
  const fallbacks = getBuiltInLogoEntries().filter((logo) => !uploadedVariants.has(logo.variant));
  return [...uploaded, ...fallbacks];
}

// ============================================================================
// API METHODS
// ============================================================================

export const brandApi = {
  // Summary
  async getSummary(): Promise<BrandSummary> {
    const res = await api.get<BrandSummary & { success: boolean }>('/brand/summary');
    return {
      ...res,
      logoCount: Math.max(res.logoCount || 0, BUILTIN_LOGO_PACK.length),
    };
  },

  // Logos
  async getLogos(): Promise<LogoEntry[]> {
    const res = await api.get<{ success: boolean; logos: LogoEntry[] }>('/brand/logos');
    return mergeBuiltInLogos(res.logos || []);
  },

  async uploadLogo(file: File, variant: string, label: string, usageNotes: string): Promise<LogoEntry[]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('variant', variant);
    formData.append('label', label);
    formData.append('usageNotes', usageNotes);
    formData.append('uploadedBy', 'admin');
    const res = await api.post<{ success: boolean; logos: LogoEntry[] }>('/brand/logos/upload', formData);
    return mergeBuiltInLogos(res.logos || []);
  },

  async deleteLogo(variant: string): Promise<LogoEntry[]> {
    const res = await api.delete<{ success: boolean; logos: LogoEntry[] }>(`/brand/logos/${variant}`);
    return mergeBuiltInLogos(res.logos || []);
  },

  // Colours
  async getColourPalette(): Promise<ColourPalette | null> {
    const res = await api.get<{ success: boolean; palette: ColourPalette | null }>('/brand/colours');
    return res.palette;
  },

  async saveColourPalette(palette: ColourPalette): Promise<ColourPalette> {
    const res = await api.put<{ success: boolean; palette: ColourPalette }>('/brand/colours', palette);
    return res.palette;
  },

  // Typography
  async getTypography(): Promise<TypographyConfig | null> {
    const res = await api.get<{ success: boolean; config: TypographyConfig | null }>('/brand/typography');
    return res.config;
  },

  async saveTypography(config: TypographyConfig): Promise<TypographyConfig> {
    const res = await api.put<{ success: boolean; config: TypographyConfig }>('/brand/typography', config);
    return res.config;
  },

  // Collateral
  async getCollateral(): Promise<CollateralItem[]> {
    const res = await api.get<{ success: boolean; items: CollateralItem[] }>('/brand/collateral');
    return res.items || [];
  },

  async uploadCollateral(file: File, name: string, category: string, description: string): Promise<CollateralItem[]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('uploadedBy', 'admin');
    const res = await api.post<{ success: boolean; items: CollateralItem[] }>('/brand/collateral/upload', formData);
    return res.items || [];
  },

  async deleteCollateral(id: string): Promise<CollateralItem[]> {
    const res = await api.delete<{ success: boolean; items: CollateralItem[] }>(`/brand/collateral/${id}`);
    return res.items || [];
  },

  // Guidelines
  async getGuidelines(): Promise<{ guidelines: BrandGuidelines | null; pdfUrl: string | null }> {
    const res = await api.get<{ success: boolean; guidelines: BrandGuidelines | null; pdfUrl: string | null }>('/brand/guidelines');
    return { guidelines: res.guidelines, pdfUrl: res.pdfUrl };
  },

  async saveGuidelineRules(rules: BrandRule[]): Promise<void> {
    await api.put('/brand/guidelines/rules', { rules, updatedBy: 'admin' });
  },

  async saveGuidelineVoice(voice: BrandGuidelines['voice']): Promise<void> {
    await api.put('/brand/guidelines/voice', { voice, updatedBy: 'admin' });
  },

  async uploadGuidelinePdf(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await api.post('/brand/guidelines/pdf', formData);
  },
};
