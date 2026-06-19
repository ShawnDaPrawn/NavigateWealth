/**
 * advice-engine-roa-branding.ts — assembles a "brand kit" for RoA document
 * generation from the brand-service (colour palette, typography, logo). All
 * lookups are best-effort: when brand configuration is missing we fall back to
 * the Navigate Wealth house defaults so document generation never fails.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { BrandService, type ColourSwatch } from './brand-service.ts';

const log = createModuleLogger('advice-engine-roa-branding');

export interface RoABrandColor {
  /** 0..1 channels for pdf-lib's rgb(). */
  r: number;
  g: number;
  b: number;
  /** Hex without the leading '#', for docx. */
  hex: string;
}

export interface RoABrandKit {
  primary: RoABrandColor;
  heading: RoABrandColor;
  muted: RoABrandColor;
  border: RoABrandColor;
  soft: RoABrandColor;
  headingFont: string;
  bodyFont: string;
  entityName: string;
  logo?: { bytes: Uint8Array; format: 'png' | 'jpeg' };
}

function hexToColor(hex: string, fallback: RoABrandColor): RoABrandColor {
  const cleaned = (hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r: r / 255, g: g / 255, b: b / 255, hex: cleaned.toLowerCase() };
}

const DEFAULT_KIT: RoABrandKit = {
  primary: hexToColor('6d28d9', { r: 0.43, g: 0.16, b: 0.85, hex: '6d28d9' }),
  heading: hexToColor('312f55', { r: 0.19, g: 0.18, b: 0.33, hex: '312f55' }),
  muted: hexToColor('6b7280', { r: 0.42, g: 0.45, b: 0.5, hex: '6b7280' }),
  border: hexToColor('e5e7eb', { r: 0.9, g: 0.9, b: 0.92, hex: 'e5e7eb' }),
  soft: hexToColor('f9fafb', { r: 0.98, g: 0.98, b: 0.98, hex: 'f9fafb' }),
  headingFont: 'Inter',
  bodyFont: 'Inter',
  entityName: 'Navigate Wealth',
};

function pickSwatch(
  swatches: ColourSwatch[],
  group: ColourSwatch['group'],
): ColourSwatch | undefined {
  return swatches
    .filter((s) => s.group === group)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
}

export async function getRoABrandKit(): Promise<RoABrandKit> {
  const brandService = new BrandService();
  const kit: RoABrandKit = { ...DEFAULT_KIT };

  try {
    const palette = await brandService.getColourPalette();
    const swatches = palette?.swatches || [];
    if (swatches.length > 0) {
      const primary = pickSwatch(swatches, 'primary');
      const neutralDark = swatches
        .filter((s) => s.group === 'neutral')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      const accent = pickSwatch(swatches, 'accent');
      if (primary) kit.primary = hexToColor(primary.hex, kit.primary);
      if (neutralDark) kit.heading = hexToColor(neutralDark.hex, kit.heading);
      else if (primary) kit.heading = hexToColor(primary.hex, kit.heading);
      void accent;
    }
  } catch (error) {
    log.warn('Brand palette unavailable — using defaults', { error: getErrMsg(error) });
  }

  try {
    const typography = await brandService.getTypography();
    const heading = typography?.fonts.find((f) => f.role === 'heading' || f.role === 'display');
    const body = typography?.fonts.find((f) => f.role === 'body');
    if (heading?.family) kit.headingFont = heading.family;
    if (body?.family) kit.bodyFont = body.family;
  } catch (error) {
    log.warn('Brand typography unavailable — using defaults', { error: getErrMsg(error) });
  }

  try {
    const logos = await brandService.getLogos();
    // Prefer a light combined logo for document headers/cover pages.
    const preferredOrder = [
      'light_combined_1',
      'light_combined_2',
      'light_logo_only',
      'dark_combined_1',
    ];
    const candidates = logos
      .slice()
      .sort((a, b) => preferredOrder.indexOf(a.variant) - preferredOrder.indexOf(b.variant) || 0);
    for (const entry of candidates) {
      const asset =
        entry.assets.find((a) => a.format === 'png') ||
        entry.assets.find((a) => a.format === 'jpeg');
      if (!asset) continue;
      const bytes = await brandService.downloadBrandAsset(asset.storagePath);
      if (bytes && bytes.byteLength > 0) {
        kit.logo = { bytes, format: asset.format === 'jpeg' ? 'jpeg' : 'png' };
        break;
      }
    }
  } catch (error) {
    log.warn('Brand logo unavailable — proceeding without it', { error: getErrMsg(error) });
  }

  return kit;
}
