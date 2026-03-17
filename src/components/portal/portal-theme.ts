/**
 * Portal Theme Configuration
 * 
 * Centralised theme toggle for the client portal UI.
 * Switch `ACTIVE_THEME` to 'classic' to revert all portal pages
 * to the previous flat/white design.
 * 
 * Guidelines refs: §5.3 (constants), §8.1 (preserve existing standards)
 */

export type PortalTheme = 'branded' | 'classic';

/**
 * ROLLBACK TOGGLE
 * Change this to 'classic' to revert the portal UI to the previous style.
 */
export const ACTIVE_THEME: PortalTheme = 'branded';

// ── Brand Colours (from website hero + globals.css) ──────────────────────────

export const BRAND = {
  /** Dark navy background used in website hero sections */
  heroBg: '#1a1e36',
  heroVia: '#252a47',
  /** Primary purple from --primary in globals.css */
  purple: '#6d28d9',
  purpleLight: '#7c3aed',
  purpleDark: '#5b21b6',
  /** Text on dark backgrounds */
  textOnDark: '#ffffff',
  textMutedOnDark: 'rgba(255,255,255,0.7)',
  textSubtleOnDark: 'rgba(255,255,255,0.5)',
} as const;

// ── Dashboard Navigation Styles ──────────────────────────────────────────────

export const NAV_STYLES = {
  branded: {
    wrapper: 'bg-gradient-to-r from-[#1a1e36] via-[#252a47] to-[#1a1e36] border-b border-white/10',
    container: 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12',
    linkBase: 'flex items-center space-x-2 py-3.5 px-3 border-b-2 whitespace-nowrap transition-all duration-200',
    linkActive: 'border-purple-400 text-white',
    linkInactive: 'border-transparent text-white/60 hover:text-white hover:border-white/30',
    iconClass: 'h-4 w-4',
    labelClass: 'text-sm hidden sm:inline font-medium',
  },
  classic: {
    wrapper: 'border-b border-gray-200 bg-[rgba(255,255,255,1)]',
    container: 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12',
    linkBase: 'flex items-center space-x-2 py-4 px-2 border-b-2 whitespace-nowrap transition-colors',
    linkActive: 'border-[#6d28d9] text-[#6d28d9]',
    linkInactive: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
    iconClass: 'h-4 w-4',
    labelClass: 'text-sm hidden sm:inline text-[rgb(0,0,0)] font-normal font-bold text-[14px]',
  },
} as const;

// ── Portal Page Header Styles ────────────────────────────────────────────────

export const HERO_STYLES = {
  branded: {
    section: 'relative overflow-hidden bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]',
    dotPattern: true,
    glowEffects: true,
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    textAccent: 'text-purple-300',
  },
  classic: {
    section: 'bg-gray-50',
    dotPattern: false,
    glowEffects: false,
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textAccent: 'text-purple-600',
  },
} as const;

// ── Quick Link Card Styles ───────────────────────────────────────────────────

export const QUICK_LINK_STYLES = {
  branded: {
    card: 'bg-white/[0.07] backdrop-blur-sm border border-white/10 hover:bg-white/[0.12] hover:border-purple-400/30 transition-all duration-200 rounded-xl cursor-pointer group',
    iconWrap: 'flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform',
    label: 'text-sm font-semibold text-white truncate',
    description: 'text-xs text-white/50 truncate',
  },
  classic: {
    card: 'h-full border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200 cursor-pointer',
    iconWrap: 'flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform',
    label: 'text-sm font-semibold text-gray-900 truncate',
    description: 'text-xs text-gray-500 truncate',
  },
} as const;

/**
 * Helper to select the active style set.
 */
export function themeStyle<T>(styles: Record<PortalTheme, T>): T {
  return styles[ACTIVE_THEME];
}
