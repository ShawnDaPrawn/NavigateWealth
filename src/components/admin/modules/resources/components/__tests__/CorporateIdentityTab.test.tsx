/**
 * CorporateIdentityTab — Render / Characterization Test (Phase 4)
 * ==============================================================
 *
 * Locks the baseline render + data-fetch contract of CorporateIdentityTab
 * (1,822 lines — a Phase 6 decomposition target) so a regression during the
 * eventual extraction fails CI.
 *
 * Contract pinned here:
 *   • mounts and renders the "Corporate Identity" header + the six brand
 *     section tab triggers (Logos / Colours / Typography / Collateral /
 *     Signatures / Guidelines);
 *   • calls brandApi.getSummary() once on mount and renders the stat cards;
 *   • renders the Logos section (the default tab) which loads via
 *     brandApi.getLogos() — and, because Radix Tabs only mounts the active
 *     tab, does NOT eagerly load the other sections' data.
 *
 * Notes:
 *   • brand-api is partially mocked via importOriginal: the real constants
 *     (LOGO_VARIANTS, LOGO_THEME_GROUPS, COLLATERAL_CATEGORIES) are preserved,
 *     only the network-touching `brandApi` methods are stubbed.
 *   • utils/api/client is stubbed so importing brand-api does not instantiate a
 *     real Supabase client; sonner is stubbed (no Toaster DOM needed).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Defined via vi.hoisted so the (hoisted) vi.mock factory below can reference
// them without a "cannot access before initialization" error.
const { getSummary, getLogos, getColourPalette, getTypography, getCollateral, getGuidelines } =
  vi.hoisted(() => ({
    getSummary: vi.fn().mockResolvedValue({
      logoCount: 2,
      colourCount: 3,
      collateralCount: 1,
      lastUpdated: '2026-01-15T00:00:00.000Z',
    }),
    getLogos: vi.fn().mockResolvedValue([]),
    getColourPalette: vi.fn().mockResolvedValue(null),
    getTypography: vi.fn().mockResolvedValue(null),
    getCollateral: vi.fn().mockResolvedValue([]),
    getGuidelines: vi.fn().mockResolvedValue({ guidelines: null, pdfUrl: null }),
  }));

vi.mock('../brand-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brand-api')>();
  return {
    ...actual,
    brandApi: {
      getSummary,
      getLogos,
      getColourPalette,
      getTypography,
      getCollateral,
      getGuidelines,
      // Mutations — present so the shape matches; never invoked by a render.
      uploadLogo: vi.fn(),
      deleteLogo: vi.fn(),
      saveColourPalette: vi.fn(),
      saveTypography: vi.fn(),
      uploadCollateral: vi.fn(),
      deleteCollateral: vi.fn(),
      saveGuidelineRules: vi.fn(),
      saveGuidelineVoice: vi.fn(),
      uploadGuidelinePdf: vi.fn(),
    },
  };
});

import { CorporateIdentityTab } from '../CorporateIdentityTab';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CorporateIdentityTab', () => {
  it('renders the Corporate Identity header and the brand section tabs', () => {
    render(<CorporateIdentityTab />);

    expect(screen.getByText('Corporate Identity')).toBeTruthy();
    // Tab triggers whose labels are unique (not shared with a stat-card label).
    expect(screen.getByText('Logos')).toBeTruthy();
    expect(screen.getByText('Typography')).toBeTruthy();
    expect(screen.getByText('Signatures')).toBeTruthy();
    expect(screen.getByText('Guidelines')).toBeTruthy();
  });

  it('loads the brand summary on mount and renders the stat cards', async () => {
    render(<CorporateIdentityTab />);

    await waitFor(() => {
      expect(getSummary).toHaveBeenCalledTimes(1);
    });

    // After the summary resolves, the stat cards (skeletons → values) render.
    await waitFor(() => {
      expect(screen.getByText('Logo Assets')).toBeTruthy();
      expect(screen.getByText('Brand Colours')).toBeTruthy();
      expect(screen.getByText('Last Updated')).toBeTruthy();
    });
  });

  it('loads logos for the default (Logos) section and not the inactive sections', async () => {
    render(<CorporateIdentityTab />);

    await waitFor(() => {
      expect(getLogos).toHaveBeenCalledTimes(1);
    });

    // Radix Tabs only mounts the active tab, so the other sections' loaders
    // must not have fired on the initial render.
    expect(getColourPalette).not.toHaveBeenCalled();
    expect(getTypography).not.toHaveBeenCalled();
    expect(getCollateral).not.toHaveBeenCalled();
    expect(getGuidelines).not.toHaveBeenCalled();
  });
});
