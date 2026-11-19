/**
 * The product providers Navigate Wealth works with, grouped by service.
 *
 * Read by the "View All Partners" list in both website designs. Each provider
 * appears only under the services where it actually operates — the lists
 * mirror each service page's partner logos.
 */
import {
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
  sanlamLogo,
  stanlibLogo,
  sygniaLogo,
} from './assets/provider-logos';

export interface ProviderEntry {
  name: string;
  logo: string | null;
}

export type ProviderGroupId = 'risk' | 'medical-aid' | 'investment' | 'group-benefits' | 'estate';

export interface ProviderGroup {
  id: ProviderGroupId;
  title: string;
  providers: readonly ProviderEntry[];
}

export const PROVIDER_GROUPS: readonly ProviderGroup[] = [
  {
    id: 'risk',
    title: 'Risk Management',
    providers: [
      { name: 'Discovery', logo: discoveryLogo },
      { name: 'Sanlam', logo: sanlamLogo },
      { name: 'Momentum', logo: momentumLogo },
      { name: 'Liberty', logo: libertyLogo },
      { name: 'Old Mutual', logo: oldMutualLogo },
      { name: 'BrightRock', logo: brightRockLogo },
      { name: 'Hollard', logo: hollardLogo },
    ],
  },
  {
    id: 'medical-aid',
    title: 'Medical Aid',
    providers: [
      { name: 'Discovery Health', logo: discoveryLogo },
      { name: 'Momentum Health', logo: momentumLogo },
    ],
  },
  {
    id: 'investment',
    title: 'Investment Management',
    providers: [
      { name: 'Allan Gray', logo: allanGrayLogo },
      { name: 'Sygnia', logo: sygniaLogo },
      { name: 'Discovery', logo: discoveryLogo },
      { name: 'Liberty', logo: libertyLogo },
      { name: 'Stanlib', logo: stanlibLogo },
      { name: 'INN8', logo: inn8Logo },
      { name: 'Old Mutual', logo: oldMutualLogo },
      { name: 'Sanlam', logo: sanlamLogo },
      { name: 'Momentum', logo: momentumLogo },
      { name: 'JUST', logo: justLogo },
    ],
  },
  {
    id: 'group-benefits',
    title: 'Group Benefits',
    providers: [
      { name: 'Discovery', logo: discoveryLogo },
      { name: 'Momentum', logo: momentumLogo },
      { name: 'Liberty', logo: libertyLogo },
      { name: 'BrightRock', logo: brightRockLogo },
      { name: 'Sanlam', logo: sanlamLogo },
      { name: 'Old Mutual', logo: oldMutualLogo },
      { name: 'Allan Gray', logo: allanGrayLogo },
      { name: 'Sygnia', logo: sygniaLogo },
      { name: 'Hollard', logo: hollardLogo },
      { name: 'Stanlib', logo: stanlibLogo },
      { name: 'INN8', logo: inn8Logo },
      { name: 'JUST', logo: justLogo },
      { name: 'Capital Legacy', logo: capitalLegacyLogo },
    ],
  },
  {
    id: 'estate',
    title: 'Estate Planning',
    providers: [
      { name: 'Capital Legacy', logo: capitalLegacyLogo },
      { name: 'EW Serfontein & Associates', logo: ewSerfonteinLogo },
    ],
  },
];
