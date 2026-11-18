/**
 * The partner roster by service, shown by the home page's "View All Partners"
 * dialog in both designs. Provider-to-category assignments mirror the service
 * page partnerLogos arrays (§5.3 — centralised constants).
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
} from '../shared/assets/provider-logos';

export interface ProviderEntry {
  name: string;
  logo: string | null;
}

/**
 * Provider lists per category — sourced from each service page's partnerLogos array.
 * Each provider appears only in the categories where they actually operate.
 */
export const riskProviders: ProviderEntry[] = [
  { name: 'Discovery', logo: discoveryLogo },
  { name: 'Sanlam', logo: sanlamLogo },
  { name: 'Momentum', logo: momentumLogo },
  { name: 'Liberty', logo: libertyLogo },
  { name: 'Old Mutual', logo: oldMutualLogo },
  { name: 'BrightRock', logo: brightRockLogo },
  { name: 'Hollard', logo: hollardLogo },
];

export const medicalAidProviders: ProviderEntry[] = [
  { name: 'Discovery Health', logo: discoveryLogo },
  { name: 'Momentum Health', logo: momentumLogo },
];

export const investmentProviders: ProviderEntry[] = [
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
];

export const groupBenefitsProviders: ProviderEntry[] = [
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
];

export const estatePlanningProviders: ProviderEntry[] = [
  { name: 'Capital Legacy', logo: capitalLegacyLogo },
  { name: 'EW Serfontein & Associates', logo: ewSerfonteinLogo },
];

/** Every category in the order the dialog lists them. */
export const PROVIDER_GROUPS: { title: string; providers: ProviderEntry[] }[] = [
  { title: 'Risk Management', providers: riskProviders },
  { title: 'Medical Aid', providers: medicalAidProviders },
  { title: 'Investment Management', providers: investmentProviders },
  { title: 'Group Benefits', providers: groupBenefitsProviders },
  { title: 'Estate Planning', providers: estatePlanningProviders },
];
