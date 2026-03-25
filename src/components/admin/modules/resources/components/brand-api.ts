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

export type LogoVariant =
  | 'light_combined_1'
  | 'light_combined_2'
  | 'light_icon_only'
  | 'light_logo_only'
  | 'dark_combined_1'
  | 'dark_combined_2'
  | 'dark_icon_only'
  | 'dark_logo_only';

export interface LogoEntry {
  id: string;
  variant: LogoVariant;
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

export const LOGO_THEME_GROUPS = [
  {
    value: 'light',
    label: 'Light Theme',
    description: 'Assets intended for light backgrounds and white surfaces.',
    previewClass: 'bg-white border',
  },
  {
    value: 'dark',
    label: 'Dark Theme',
    description: 'Assets intended for dark backgrounds and dark surfaces.',
    previewClass: 'bg-slate-950 border border-slate-800',
  },
] as const;

export const LOGO_VARIANTS = [
  {
    value: 'light_combined_1',
    theme: 'light',
    label: 'Combined Logo 1',
    description: 'Primary combined logo for the light theme.',
  },
  {
    value: 'light_combined_2',
    theme: 'light',
    label: 'Combined Logo 2',
    description: 'Secondary combined logo for the light theme.',
  },
  {
    value: 'light_icon_only',
    theme: 'light',
    label: 'Icon Only',
    description: 'Icon-only mark for the light theme.',
  },
  {
    value: 'light_logo_only',
    theme: 'light',
    label: 'Logo Only',
    description: 'Wordmark-only asset for the light theme.',
  },
  {
    value: 'dark_combined_1',
    theme: 'dark',
    label: 'Combined Logo 1',
    description: 'Primary combined logo for the dark theme.',
  },
  {
    value: 'dark_combined_2',
    theme: 'dark',
    label: 'Combined Logo 2',
    description: 'Secondary combined logo for the dark theme.',
  },
  {
    value: 'dark_icon_only',
    theme: 'dark',
    label: 'Icon Only',
    description: 'Icon-only mark for the dark theme.',
  },
  {
    value: 'dark_logo_only',
    theme: 'dark',
    label: 'Logo Only',
    description: 'Wordmark-only asset for the dark theme.',
  },
] as const;

// ============================================================================
// API METHODS
// ============================================================================

export const brandApi = {
  // Summary
  async getSummary(): Promise<BrandSummary> {
    const res = await api.get<BrandSummary & { success: boolean }>('/brand/summary');
    return res;
  },

  // Logos
  async getLogos(): Promise<LogoEntry[]> {
    const res = await api.get<{ success: boolean; logos: LogoEntry[] }>('/brand/logos');
    return res.logos || [];
  },

  async uploadLogo(file: File, variant: string, label: string, usageNotes: string): Promise<LogoEntry[]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('variant', variant);
    formData.append('label', label);
    formData.append('usageNotes', usageNotes);
    formData.append('uploadedBy', 'admin');
    const res = await api.post<{ success: boolean; logos: LogoEntry[] }>('/brand/logos/upload', formData);
    return res.logos || [];
  },

  async deleteLogo(variant: string): Promise<LogoEntry[]> {
    const res = await api.delete<{ success: boolean; logos: LogoEntry[] }>(`/brand/logos/${variant}`);
    return res.logos || [];
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
