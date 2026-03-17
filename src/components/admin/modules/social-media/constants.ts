/**
 * Social Media Module — Shared Constants
 *
 * Single source of truth for brand tokens, platform display configs,
 * and other module-level constants.
 *
 * Navigate Wealth brand palette:
 *   Navy  #1B2A4A — primary / structural / headers
 *   Gold  #C9A84C — accent / emphasis / interactive highlights
 *
 * @module social-media/constants
 */

// ============================================================================
// Brand Tokens (Navigate Wealth)
// ============================================================================

export const BRAND = {
  /** Primary navy */
  navy: '#1B2A4A',
  /** Primary gold accent */
  gold: '#C9A84C',
  /** Navy at 5 % opacity — light background fills */
  navyLight: '#1B2A4A0D',
  /** Navy at 10 % opacity — slightly stronger bg */
  navy10: '#1B2A4A1A',
  /** Gold at 10 % opacity — accent backgrounds */
  goldLight: '#C9A84C1A',
  /** Gold at 20 % opacity — stronger accent bg */
  gold20: '#C9A84C33',
} as const;

// ============================================================================
// Tailwind-compatible class helpers
// ============================================================================

/** Utility classes for the brand icon container pattern (§8.3 stat card standards). */
export const BRAND_ICON_CONTAINER =
  'flex items-center justify-center h-8 w-8 rounded-lg';

/** Consistent selected-state ring for platform / option buttons */
export const BRAND_SELECTED_RING =
  'ring-1 ring-[#1B2A4A]/30 border-[#1B2A4A]/40';

// ============================================================================
// Platform Display Config
// ============================================================================

import React from 'react';
import { Linkedin, Instagram, Facebook, Twitter } from 'lucide-react';
import type { SocialPlatform, SocialAIPlatform } from './types';

export interface PlatformDisplayInfo {
  label: string;
  icon: React.ReactNode;
}

/** Minimal platform display lookup — used by DraftPosts, History, etc. */
export const PLATFORM_DISPLAY: Record<SocialPlatform, PlatformDisplayInfo> = {
  linkedin: { label: 'LinkedIn', icon: React.createElement(Linkedin, { className: 'h-3.5 w-3.5' }) },
  instagram: { label: 'Instagram', icon: React.createElement(Instagram, { className: 'h-3.5 w-3.5' }) },
  facebook: { label: 'Facebook', icon: React.createElement(Facebook, { className: 'h-3.5 w-3.5' }) },
  x: { label: 'X', icon: React.createElement(Twitter, { className: 'h-3.5 w-3.5' }) },
};

/** AI platform config — larger icons for generator UIs */
export const AI_PLATFORM_CONFIG: Record<
  SocialAIPlatform,
  { label: string; icon: React.ReactNode }
> = {
  linkedin: { label: 'LinkedIn', icon: React.createElement(Linkedin, { className: 'h-4 w-4' }) },
  instagram: { label: 'Instagram', icon: React.createElement(Instagram, { className: 'h-4 w-4' }) },
  facebook: { label: 'Facebook', icon: React.createElement(Facebook, { className: 'h-4 w-4' }) },
  x: { label: 'X (Twitter)', icon: React.createElement(Twitter, { className: 'h-4 w-4' }) },
};

// ============================================================================
// Date / Time Formatting (en-ZA locale — Guidelines §8.3)
// ============================================================================

export function formatDateZA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTimeZA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}
