/**
 * P8.6 — Signer-side branding hook.
 *
 * Reads the branding bundle delivered by `/signer/validate` and:
 *
 * 1. Returns derived render values (display name, accent colour,
 *    gradient strip CSS, primary button style) so each page only
 *    has to think in terms of "title", "accentStyle", etc.
 * 2. Sets a CSS custom property (`--esign-accent`) on the document
 *    root so any deeper child can pick the colour up without prop
 *    drilling, and clears it on unmount so the platform default is
 *    restored.
 *
 * Defaults (kept in one place so `BrandingDialog`'s preview matches
 * the live signer page exactly):
 */

import { useEffect, useMemo } from 'react';

interface BrandingInput {
  display_name?: string | null;
  logo_url?: string | null;
  accent_hex?: string | null;
  support_email?: string | null;
}

const DEFAULT_ACCENT = '#4f46e5';
const DEFAULT_DISPLAY_NAME = 'Navigate Wealth';
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export interface SignerBranding {
  displayName: string;
  accentHex: string;
  logoUrl: string | null;
  supportEmail: string | null;
  /** Inline style for the 1.5px coloured strip at the top of each card. */
  stripStyle: { background: string };
  /** Inline style for primary action buttons. */
  primaryButtonStyle: { background: string; borderColor: string };
}

export function useSignerBranding(branding: BrandingInput | null | undefined): SignerBranding {
  const result = useMemo<SignerBranding>(() => {
    const accent = branding?.accent_hex && HEX_RE.test(branding.accent_hex)
      ? branding.accent_hex
      : DEFAULT_ACCENT;
    const displayName = branding?.display_name?.trim() || DEFAULT_DISPLAY_NAME;
    const logoUrl = branding?.logo_url?.trim() || null;
    const supportEmail = branding?.support_email?.trim() || null;

    return {
      displayName,
      accentHex: accent,
      logoUrl,
      supportEmail,
      stripStyle: {
        background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 50%, ${accent} 100%)`,
      },
      primaryButtonStyle: {
        background: accent,
        borderColor: accent,
      },
    };
  }, [branding?.accent_hex, branding?.display_name, branding?.logo_url, branding?.support_email]);

  // Expose the accent as a CSS variable so deeper Tailwind utilities
  // (or custom CSS classes) can opt into the firm colour without
  // threading it through props.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.documentElement.style.getPropertyValue('--esign-accent');
    document.documentElement.style.setProperty('--esign-accent', result.accentHex);
    return () => {
      if (previous) {
        document.documentElement.style.setProperty('--esign-accent', previous);
      } else {
        document.documentElement.style.removeProperty('--esign-accent');
      }
    };
  }, [result.accentHex]);

  return result;
}
