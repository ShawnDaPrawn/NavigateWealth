/**
 * Brand / Corporate Identity — Service Layer
 *
 * Manages logo variants, colour palettes, typography config, brand collateral,
 * and brand guidelines.  Binary assets live in Supabase Storage; metadata and
 * configuration live in the KV store.
 *
 * Guidelines:
 *   SS4.2  — Backend module structure (service owns business logic & KV access)
 *   SS5.4  — KV key naming conventions
 *   SS12.3 — Multi-entry consistency
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('brand-service');

// ============================================================================
// CONSTANTS
// ============================================================================

const BUCKET_NAME = 'make-91ed8379-brand-assets';

/** Lazy Supabase admin client */
const getSupabase = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  );

// ============================================================================
// KV KEYS
// ============================================================================

const KEYS = {
  logosMetadata: 'brand:logos:metadata',
  colourPalette: 'brand:colours:palette',
  typographyConfig: 'brand:typography:config',
  collateralIndex: 'brand:collateral:index',
  guidelineRules: 'brand:guidelines:rules',
  guidelineVoice: 'brand:guidelines:voice',
  guidelinePdf: 'brand:guidelines:pdf',
  lastUpdated: 'brand:meta:last_updated',
} as const;

// ============================================================================
// TYPES
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

export interface TypographyConfig {
  fonts: {
    id: string;
    role: 'heading' | 'body' | 'mono' | 'display';
    family: string;
    weights: number[];
    fallback: string;
  }[];
  scale: {
    token: string;
    label: string;
    size: string;
    lineHeight: string;
    weight: number;
  }[];
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

// ============================================================================
// SERVICE
// ============================================================================

export class BrandService {
  // ------------------------------------------------------------------
  // Bucket — idempotent creation
  // ------------------------------------------------------------------

  async ensureBucket(): Promise<void> {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: { name: string }) => b.name === BUCKET_NAME);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      if (error) log.error('Failed to create brand assets bucket:', error);
      else log.info('Created brand assets bucket');
    }
  }

  // ------------------------------------------------------------------
  // Summary (stat cards)
  // ------------------------------------------------------------------

  async getSummary(): Promise<BrandSummary> {
    const [logos, palette, collateral, lastUpdated] = await Promise.all([
      kv.get(KEYS.logosMetadata),
      kv.get(KEYS.colourPalette),
      kv.get(KEYS.collateralIndex),
      kv.get(KEYS.lastUpdated),
    ]);
    const logoArr = (logos as LogoEntry[] | null) || [];
    const paletteObj = palette as ColourPalette | null;
    const collateralArr = (collateral as CollateralItem[] | null) || [];
    return {
      logoCount: logoArr.length,
      colourCount: paletteObj?.swatches?.length || 0,
      collateralCount: collateralArr.length,
      lastUpdated: (lastUpdated as string) || null,
    };
  }

  private async touchLastUpdated(): Promise<void> {
    await kv.set(KEYS.lastUpdated, new Date().toISOString());
  }

  // ------------------------------------------------------------------
  // LOGOS
  // ------------------------------------------------------------------

  async getLogos(): Promise<LogoEntry[]> {
    const data = await kv.get(KEYS.logosMetadata);
    return (data as LogoEntry[] | null) || [];
  }

  async upsertLogo(entry: LogoEntry): Promise<LogoEntry[]> {
    const logos = await this.getLogos();
    const idx = logos.findIndex(l => l.variant === entry.variant);
    if (idx >= 0) {
      // Keep max 3 previous versions
      const prev = logos[idx];
      const history = (prev.previousVersions || []).slice(0, 2);
      history.unshift({
        storagePath: prev.storagePath,
        uploadedAt: prev.uploadedAt,
        uploadedBy: prev.uploadedBy,
      });
      entry.previousVersions = history;
      logos[idx] = entry;
    } else {
      logos.push(entry);
    }
    await Promise.all([
      kv.set(KEYS.logosMetadata, logos),
      this.touchLastUpdated(),
    ]);
    return logos;
  }

  async deleteLogo(variant: string): Promise<LogoEntry[]> {
    let logos = await this.getLogos();
    const target = logos.find(l => l.variant === variant);
    if (target) {
      // Delete from storage
      const supabase = getSupabase();
      const pathsToDelete = [target.storagePath];
      if (target.previousVersions) {
        pathsToDelete.push(...target.previousVersions.map(v => v.storagePath));
      }
      await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
    }
    logos = logos.filter(l => l.variant !== variant);
    await Promise.all([
      kv.set(KEYS.logosMetadata, logos),
      this.touchLastUpdated(),
    ]);
    return logos;
  }

  async getLogoSignedUrl(storagePath: string): Promise<string | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600); // 1 hour
    if (error) {
      log.error('Failed to create signed URL:', error);
      return null;
    }
    return data.signedUrl;
  }

  // ------------------------------------------------------------------
  // COLOURS
  // ------------------------------------------------------------------

  async getColourPalette(): Promise<ColourPalette | null> {
    const data = await kv.get(KEYS.colourPalette);
    return (data as ColourPalette | null) || null;
  }

  async saveColourPalette(palette: ColourPalette): Promise<ColourPalette> {
    await Promise.all([
      kv.set(KEYS.colourPalette, palette),
      this.touchLastUpdated(),
    ]);
    return palette;
  }

  // ------------------------------------------------------------------
  // TYPOGRAPHY
  // ------------------------------------------------------------------

  async getTypography(): Promise<TypographyConfig | null> {
    const data = await kv.get(KEYS.typographyConfig);
    return (data as TypographyConfig | null) || null;
  }

  async saveTypography(config: TypographyConfig): Promise<TypographyConfig> {
    await Promise.all([
      kv.set(KEYS.typographyConfig, config),
      this.touchLastUpdated(),
    ]);
    return config;
  }

  // ------------------------------------------------------------------
  // COLLATERAL
  // ------------------------------------------------------------------

  async getCollateral(): Promise<CollateralItem[]> {
    const data = await kv.get(KEYS.collateralIndex);
    return (data as CollateralItem[] | null) || [];
  }

  async upsertCollateral(item: CollateralItem): Promise<CollateralItem[]> {
    const items = await this.getCollateral();
    const idx = items.findIndex(c => c.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    await Promise.all([
      kv.set(KEYS.collateralIndex, items),
      this.touchLastUpdated(),
    ]);
    return items;
  }

  async deleteCollateral(id: string): Promise<CollateralItem[]> {
    let items = await this.getCollateral();
    const target = items.find(c => c.id === id);
    if (target) {
      const supabase = getSupabase();
      await supabase.storage.from(BUCKET_NAME).remove([target.storagePath]);
    }
    items = items.filter(c => c.id !== id);
    await Promise.all([
      kv.set(KEYS.collateralIndex, items),
      this.touchLastUpdated(),
    ]);
    return items;
  }

  async getCollateralSignedUrl(storagePath: string): Promise<string | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);
    if (error) {
      log.error('Failed to create collateral signed URL:', error);
      return null;
    }
    return data.signedUrl;
  }

  // ------------------------------------------------------------------
  // GUIDELINES
  // ------------------------------------------------------------------

  async getGuidelines(): Promise<BrandGuidelines | null> {
    const [rules, voice, pdf] = await Promise.all([
      kv.get(KEYS.guidelineRules),
      kv.get(KEYS.guidelineVoice),
      kv.get(KEYS.guidelinePdf),
    ]);
    if (!rules && !voice && !pdf) return null;
    return {
      rules: (rules as BrandRule[] | null) || [],
      voice: (voice as BrandGuidelines['voice'] | null) || { tone: '', terminology: '', notes: '' },
      ...(pdf as { pdfStoragePath?: string; pdfFileName?: string; lastReviewedAt?: string } || {}),
      updatedAt: '',
      updatedBy: '',
    };
  }

  async saveGuidelineRules(rules: BrandRule[], updatedBy: string): Promise<void> {
    await Promise.all([
      kv.set(KEYS.guidelineRules, rules),
      this.touchLastUpdated(),
    ]);
  }

  async saveGuidelineVoice(voice: BrandGuidelines['voice'], updatedBy: string): Promise<void> {
    await Promise.all([
      kv.set(KEYS.guidelineVoice, voice),
      this.touchLastUpdated(),
    ]);
  }

  async saveGuidelinePdf(meta: { pdfStoragePath: string; pdfFileName: string }): Promise<void> {
    await Promise.all([
      kv.set(KEYS.guidelinePdf, meta),
      this.touchLastUpdated(),
    ]);
  }

  // ------------------------------------------------------------------
  // FILE UPLOAD (shared helper)
  // ------------------------------------------------------------------

  async uploadFile(
    file: Uint8Array,
    path: string,
    contentType: string,
  ): Promise<{ storagePath: string }> {
    await this.ensureBucket();
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, { contentType, upsert: true });
    if (error) {
      log.error('Upload failed:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
    return { storagePath: path };
  }
}
