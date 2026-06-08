import { describe, it, expect, vi, beforeEach } from 'vitest';
import { brandApi, COLLATERAL_CATEGORIES, LOGO_VARIANTS, LOGO_THEME_GROUPS } from '../brand-api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Exported constants
// ============================================================================

describe('COLLATERAL_CATEGORIES', () => {
  it('includes letterhead and email_banner', () => {
    const values = COLLATERAL_CATEGORIES.map((c) => c.value);
    expect(values).toContain('letterhead');
    expect(values).toContain('email_banner');
  });
});

describe('LOGO_VARIANTS', () => {
  it('has 8 variants covering light and dark themes', () => {
    expect(LOGO_VARIANTS).toHaveLength(8);
    const themes = LOGO_VARIANTS.map((v) => v.theme);
    expect(themes).toContain('light');
    expect(themes).toContain('dark');
  });
});

describe('LOGO_THEME_GROUPS', () => {
  it('has light and dark groups', () => {
    const values = LOGO_THEME_GROUPS.map((g) => g.value);
    expect(values).toContain('light');
    expect(values).toContain('dark');
  });
});

// ============================================================================
// brandApi.getSummary
// ============================================================================

describe('brandApi.getSummary', () => {
  it('returns brand summary from API', async () => {
    const summary = { logoCount: 3, colourCount: 5, collateralCount: 2, lastUpdated: null };
    mockApiGet.mockResolvedValue(summary);
    const result = await brandApi.getSummary();
    expect(result).toEqual(summary);
    expect(mockApiGet).toHaveBeenCalledWith('/brand/summary');
  });
});

// ============================================================================
// brandApi.getLogos
// ============================================================================

describe('brandApi.getLogos', () => {
  it('returns logos array from response', async () => {
    const logos = [{ id: 'l-001', variant: 'light_combined_1' }];
    mockApiGet.mockResolvedValue({ success: true, logos });
    const result = await brandApi.getLogos();
    expect(result).toEqual(logos);
  });

  it('returns empty array when logos is absent', async () => {
    mockApiGet.mockResolvedValue({ success: true });
    const result = await brandApi.getLogos();
    expect(result).toEqual([]);
  });
});

// ============================================================================
// brandApi.uploadLogo
// ============================================================================

describe('brandApi.uploadLogo', () => {
  it('returns updated logos array after upload', async () => {
    const logos = [{ id: 'l-002', variant: 'dark_combined_1' }];
    mockApiPost.mockResolvedValue({ success: true, logos });
    const mockFile = new File([''], 'logo.png', { type: 'image/png' });
    const result = await brandApi.uploadLogo({ png: mockFile }, 'dark_combined_1', 'Dark Logo', '');
    expect(result).toEqual(logos);
    expect(mockApiPost).toHaveBeenCalledWith('/brand/logos/upload', expect.any(FormData));
  });

  it('returns empty array when logos absent from response', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await brandApi.uploadLogo({}, 'light_icon_only', 'Light Icon', '');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// brandApi.deleteLogo
// ============================================================================

describe('brandApi.deleteLogo', () => {
  it('deletes logo and returns updated logos', async () => {
    const logos = [{ id: 'l-001', variant: 'light_combined_2' }];
    mockApiDelete.mockResolvedValue({ success: true, logos });
    const result = await brandApi.deleteLogo('dark_combined_1');
    expect(result).toEqual(logos);
    expect(mockApiDelete).toHaveBeenCalledWith('/brand/logos/dark_combined_1');
  });
});

// ============================================================================
// brandApi.getColourPalette
// ============================================================================

describe('brandApi.getColourPalette', () => {
  it('returns palette from response', async () => {
    const palette = { swatches: [], updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiGet.mockResolvedValue({ success: true, palette });
    const result = await brandApi.getColourPalette();
    expect(result).toEqual(palette);
  });

  it('returns null when palette is null', async () => {
    mockApiGet.mockResolvedValue({ success: true, palette: null });
    const result = await brandApi.getColourPalette();
    expect(result).toBeNull();
  });
});

// ============================================================================
// brandApi.saveColourPalette
// ============================================================================

describe('brandApi.saveColourPalette', () => {
  it('puts palette and returns saved palette', async () => {
    const palette = { swatches: [], updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiPut.mockResolvedValue({ success: true, palette });
    const result = await brandApi.saveColourPalette(palette);
    expect(result).toEqual(palette);
    expect(mockApiPut).toHaveBeenCalledWith('/brand/colours', palette);
  });
});

// ============================================================================
// brandApi.getTypography
// ============================================================================

describe('brandApi.getTypography', () => {
  it('returns typography config', async () => {
    const config = { fonts: [], scale: [], notes: '', updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiGet.mockResolvedValue({ success: true, config });
    const result = await brandApi.getTypography();
    expect(result).toEqual(config);
  });

  it('returns null when config is null', async () => {
    mockApiGet.mockResolvedValue({ success: true, config: null });
    const result = await brandApi.getTypography();
    expect(result).toBeNull();
  });
});

// ============================================================================
// brandApi.saveTypography
// ============================================================================

describe('brandApi.saveTypography', () => {
  it('puts typography and returns saved config', async () => {
    const config = { fonts: [], scale: [], notes: '', updatedAt: '2025-01-01', updatedBy: 'admin' };
    mockApiPut.mockResolvedValue({ success: true, config });
    const result = await brandApi.saveTypography(config);
    expect(result).toEqual(config);
    expect(mockApiPut).toHaveBeenCalledWith('/brand/typography', config);
  });
});

// ============================================================================
// brandApi.getCollateral
// ============================================================================

describe('brandApi.getCollateral', () => {
  it('returns collateral items', async () => {
    const items = [{ id: 'coll-001', name: 'Letterhead' }];
    mockApiGet.mockResolvedValue({ success: true, items });
    const result = await brandApi.getCollateral();
    expect(result).toEqual(items);
  });

  it('returns empty array when items absent', async () => {
    mockApiGet.mockResolvedValue({ success: true });
    const result = await brandApi.getCollateral();
    expect(result).toEqual([]);
  });
});

// ============================================================================
// brandApi.uploadCollateral
// ============================================================================

describe('brandApi.uploadCollateral', () => {
  it('posts collateral file and returns updated items', async () => {
    const items = [{ id: 'coll-002', name: 'Email Banner' }];
    mockApiPost.mockResolvedValue({ success: true, items });
    const mockFile = new File([''], 'banner.jpg', { type: 'image/jpeg' });
    const result = await brandApi.uploadCollateral(mockFile, 'Email Banner', 'email_banner', '');
    expect(result).toEqual(items);
    expect(mockApiPost).toHaveBeenCalledWith('/brand/collateral/upload', expect.any(FormData));
  });
});

// ============================================================================
// brandApi.deleteCollateral
// ============================================================================

describe('brandApi.deleteCollateral', () => {
  it('deletes collateral item by id', async () => {
    mockApiDelete.mockResolvedValue({ success: true, items: [] });
    const result = await brandApi.deleteCollateral('coll-001');
    expect(result).toEqual([]);
    expect(mockApiDelete).toHaveBeenCalledWith('/brand/collateral/coll-001');
  });
});

// ============================================================================
// brandApi.getGuidelines
// ============================================================================

describe('brandApi.getGuidelines', () => {
  it('returns guidelines and pdfUrl', async () => {
    const guidelines = {
      rules: [],
      voice: { tone: '', terminology: '', notes: '' },
      updatedAt: '2025-01-01',
      updatedBy: 'admin',
    };
    mockApiGet.mockResolvedValue({ success: true, guidelines, pdfUrl: 'https://cdn/guide.pdf' });
    const result = await brandApi.getGuidelines();
    expect(result.guidelines).toEqual(guidelines);
    expect(result.pdfUrl).toBe('https://cdn/guide.pdf');
  });

  it('returns null guidelines when absent', async () => {
    mockApiGet.mockResolvedValue({ success: true, guidelines: null, pdfUrl: null });
    const result = await brandApi.getGuidelines();
    expect(result.guidelines).toBeNull();
    expect(result.pdfUrl).toBeNull();
  });
});

// ============================================================================
// brandApi.saveGuidelineRules
// ============================================================================

describe('brandApi.saveGuidelineRules', () => {
  it('puts guideline rules', async () => {
    mockApiPut.mockResolvedValue(undefined);
    const rules = [{ id: 'r-001', title: 'Rule 1', description: 'Desc', order: 1 }];
    await expect(brandApi.saveGuidelineRules(rules)).resolves.toBeUndefined();
    expect(mockApiPut).toHaveBeenCalledWith('/brand/guidelines/rules', {
      rules,
      updatedBy: 'admin',
    });
  });
});

// ============================================================================
// brandApi.saveGuidelineVoice
// ============================================================================

describe('brandApi.saveGuidelineVoice', () => {
  it('puts voice guidelines', async () => {
    mockApiPut.mockResolvedValue(undefined);
    const voice = { tone: 'Professional', terminology: '', notes: '' };
    await brandApi.saveGuidelineVoice(voice);
    expect(mockApiPut).toHaveBeenCalledWith('/brand/guidelines/voice', {
      voice,
      updatedBy: 'admin',
    });
  });
});

// ============================================================================
// brandApi.uploadGuidelinePdf
// ============================================================================

describe('brandApi.uploadGuidelinePdf', () => {
  it('posts PDF file', async () => {
    mockApiPost.mockResolvedValue(undefined);
    const mockFile = new File(['%PDF'], 'guide.pdf', { type: 'application/pdf' });
    await brandApi.uploadGuidelinePdf(mockFile);
    expect(mockApiPost).toHaveBeenCalledWith('/brand/guidelines/pdf', expect.any(FormData));
  });
});
