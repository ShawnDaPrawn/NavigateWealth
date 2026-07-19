/**
 * Portal Theme Configuration
 *
 * Centralised styles for the branded client portal UI.
 *
 * Guidelines refs: §5.3 (constants), §8.1 (preserve existing standards)
 */

// ── Dashboard Navigation Styles ──────────────────────────────────────────────

export const NAV_STYLES = {
  wrapper: 'bg-gradient-to-r from-[#1a1e36] via-[#252a47] to-[#1a1e36] border-b border-white/10',
  container: 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12',
  linkBase:
    'flex items-center space-x-2 py-3.5 px-3 border-b-2 whitespace-nowrap transition-all duration-200',
  linkActive: 'border-purple-400 text-white',
  linkInactive: 'border-transparent text-white/60 hover:text-white hover:border-white/30',
  iconClass: 'h-4 w-4',
  labelClass: 'text-sm hidden sm:inline font-medium',
} as const;

// ── Quick Link Card Styles ───────────────────────────────────────────────────

export const QUICK_LINK_STYLES = {
  card: 'bg-white/[0.07] backdrop-blur-sm border border-white/10 hover:bg-white/[0.12] hover:border-purple-400/30 transition-all duration-200 rounded-xl cursor-pointer group',
  iconWrap:
    'flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform',
  label: 'text-sm font-semibold text-white truncate',
  description: 'text-xs text-white/50 truncate',
} as const;
