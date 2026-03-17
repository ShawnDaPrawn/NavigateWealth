/**
 * Provider Logos — Centralised Asset Registry
 *
 * Single source of truth for all financial provider logo imports.
 * Every page, modal, and carousel that displays provider logos must
 * import from this module instead of declaring its own figma:asset imports.
 *
 * This eliminates ~60 redundant import declarations across 11 files
 * and ensures logo references are consistent and maintainable.
 *
 * Guidelines §5.3 — centralised constants and configuration
 * Memory Audit §3 — image & vector control
 */

// ─── Individual logo imports (each asset resolved once) ───────────────────────
import allanGrayLogo from 'figma:asset/fd6511affe61694a459c9045604285d749d7eec8.png';
import brightRockLogo from 'figma:asset/7f3a830d4aaf877636e790293960ff63a842e4fa.png';
import capitalLegacyLogo from 'figma:asset/c505e16f603199f9f6e099328fa60863eea2b0a4.png';
import discoveryLogo from 'figma:asset/ec22996319fc583c67408cd6d525bfd9d80a3c28.png';
import ewSerfonteinLogo from 'figma:asset/5ad590314498c6876333b25d45ae64ea2938787f.png';
import hollardLogo from 'figma:asset/b0906bc7f1c0d8e245965e6df2752c0454fc4f4f.png';
import inn8Logo from 'figma:asset/796c1e649470eb0836626041af34ac621ac5579f.png';
import justLogo from 'figma:asset/b97811d5cc1be8c99fd6e9de8a94e3fa8dcff34a.png';
import libertyLogo from 'figma:asset/babc74c9965824d11fb6fe0aa9dd0133e10fd66b.png';
import momentumLogo from 'figma:asset/658982ebed7e0dfaed88848d4c25d44da4ec2b0d.png';
import oldMutualLogo from 'figma:asset/eeda4aac6f4cf8965f899a22c841c57c87562d12.png';
import profinLogo from 'figma:asset/e9ad412b6e704d27523e203d6d64cf4b018d8010.png';
import sanlamLogo from 'figma:asset/ad6ef49da98c4f2ada1c11054e5db1894b83bf2e.png';
import stanlibLogo from 'figma:asset/e599bccdec66ed4c52fa231161e6088f3e4c4b94.png';
import sygniaLogo from 'figma:asset/eb0a94d1f9889b9024b3266d68e2e1ceae56294e.png';
import yellowSquareLogo from 'figma:asset/131a8ec979ac2253c0267cb9f4d58cb3f56e8dfc.png';

// ─── Named exports ────────────────────────────────────────────────────────────
export {
  allanGrayLogo,
  brightRockLogo,
  capitalLegacyLogo,
  discoveryLogo,
  ewSerfonteinLogo,
  hollardLogo,
  inn8Logo,
  justLogo,
  libertyLogo,
  momentumLogo,
  oldMutualLogo,
  profinLogo,
  sanlamLogo,
  stanlibLogo,
  sygniaLogo,
  yellowSquareLogo,
};

// ─── Provider type (shared across consumers) ─────────────────────────────────
export interface ProviderInfo {
  id: string;
  name: string;
  logo: string;
  description: string;
  category: string;
  rating: number;
  established: string;
}

// ─── Lookup map for config-driven UI ──────────────────────────────────────────
export const PROVIDER_LOGO_MAP: Record<string, string> = {
  'allan-gray': allanGrayLogo,
  'brightrock': brightRockLogo,
  'capital-legacy': capitalLegacyLogo,
  'discovery': discoveryLogo,
  'ew-serfontein': ewSerfonteinLogo,
  'hollard': hollardLogo,
  'inn8': inn8Logo,
  'just': justLogo,
  'liberty': libertyLogo,
  'momentum': momentumLogo,
  'old-mutual': oldMutualLogo,
  'profin': profinLogo,
  'sanlam': sanlamLogo,
  'stanlib': stanlibLogo,
  'sygnia': sygniaLogo,
  'yellow-square': yellowSquareLogo,
} as const;
