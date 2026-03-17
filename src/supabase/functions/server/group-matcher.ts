/**
 * Group Matcher - Evaluates client membership based on filter criteria
 *
 * §5.4 — Consistent filter evaluation for communication groups.
 *
 * Filter types match the GroupFilterConfig from communication-types.ts:
 * - Range filters (netWorth, age, income, dependants, retirementAge) use { min?, max? } objects
 * - String filters (gender, country, maritalStatus, employmentStatus, occupation) use string[]
 * - Product filters use { provider?, type? } objects matched against client product data
 */

import { createModuleLogger } from './stderr-logger.ts';
import type { GroupFilterConfig } from './communication-types.ts';

const log = createModuleLogger('group-matcher');

export interface MatcherClient {
  id: string;
  gender?: string;
  country?: string;
  income?: number;
  occupation?: string;
  dependants?: number;
  retirementAge?: number;
  age?: number;
  maritalStatus?: string;
  employmentStatus?: string;
  netWorth?: number;
  /** Product associations: provider name + product type */
  products?: Array<{ provider?: string; type?: string }>;
  [key: string]: unknown;
}

interface MatcherGroup {
  id: string;
  name: string;
  type?: string;
  filterConfig?: GroupFilterConfig;
  clientIds?: string[];
  clientCount?: number;
  [key: string]: unknown;
}

/**
 * Checks whether any active filters exist in the config.
 * Empty arrays and undefined values are not considered active.
 */
function hasActiveFilters(filterConfig: GroupFilterConfig): boolean {
  if (!filterConfig) return false;

  const {
    productFilters,
    netWorthFilters,
    ageFilters,
    incomeFilters,
    dependantCountFilters,
    retirementAgeFilters,
    genderFilters,
    countryFilters,
    maritalStatusFilters,
    employmentStatusFilters,
    occupationFilters,
  } = filterConfig;

  if (genderFilters?.length) return true;
  if (countryFilters?.length) return true;
  if (maritalStatusFilters?.length) return true;
  if (employmentStatusFilters?.length) return true;
  if (occupationFilters?.length) return true;
  if (productFilters?.length) return true;
  if (netWorthFilters?.length) return true;
  if (ageFilters?.length) return true;
  if (incomeFilters?.length) return true;
  if (dependantCountFilters?.length) return true;
  if (retirementAgeFilters?.length) return true;

  return false;
}

/**
 * Check if a numeric value falls within any of the given { min?, max? } ranges.
 * Uses OR logic: passes if the value matches ANY range.
 */
function matchesRangeFilter(
  value: number | undefined,
  ranges: Array<{ min?: number; max?: number }>,
): boolean {
  // If client has no value for this field, they don't match range filters
  if (value === undefined || value === null) return false;

  return ranges.some(range => {
    const min = range.min ?? -Infinity;
    const max = range.max ?? Infinity;
    return value >= min && value <= max;
  });
}

/**
 * Check if a client matches a group's filter configuration.
 * All active filter categories must pass (AND logic between categories).
 * Within a category, multiple values use OR logic.
 */
export function clientMatchesFilters(client: MatcherClient, filterConfig: GroupFilterConfig): boolean {
  if (!filterConfig || !hasActiveFilters(filterConfig)) {
    return false; // No active filters = manual group, don't auto-assign
  }

  // Gender filter (OR within, AND with other categories)
  if (filterConfig.genderFilters?.length) {
    if (!client.gender) return false;
    const matches = filterConfig.genderFilters.some(
      f => f.toLowerCase() === client.gender!.toLowerCase()
    );
    if (!matches) return false;
  }

  // Country filter
  if (filterConfig.countryFilters?.length) {
    if (!client.country) return false;
    const matches = filterConfig.countryFilters.some(
      f => f.toLowerCase() === client.country!.toLowerCase()
    );
    if (!matches) return false;
  }

  // Marital status filter
  if (filterConfig.maritalStatusFilters?.length) {
    if (!client.maritalStatus) return false;
    const matches = filterConfig.maritalStatusFilters.some(
      f => f.toLowerCase() === client.maritalStatus!.toLowerCase()
    );
    if (!matches) return false;
  }

  // Employment status filter
  if (filterConfig.employmentStatusFilters?.length) {
    if (!client.employmentStatus) return false;
    const matches = filterConfig.employmentStatusFilters.some(
      f => f.toLowerCase() === client.employmentStatus!.toLowerCase()
    );
    if (!matches) return false;
  }

  // Occupation filter
  if (filterConfig.occupationFilters?.length) {
    if (!client.occupation) return false;
    const matches = filterConfig.occupationFilters.some(
      f => f.toLowerCase() === client.occupation!.toLowerCase()
    );
    if (!matches) return false;
  }

  // Net Worth filter (range objects)
  if (filterConfig.netWorthFilters?.length) {
    if (!matchesRangeFilter(client.netWorth, filterConfig.netWorthFilters)) {
      return false;
    }
  }

  // Age filter (range objects)
  if (filterConfig.ageFilters?.length) {
    if (!matchesRangeFilter(client.age, filterConfig.ageFilters)) {
      return false;
    }
  }

  // Income filter (range objects)
  if (filterConfig.incomeFilters?.length) {
    if (!matchesRangeFilter(client.income, filterConfig.incomeFilters)) {
      return false;
    }
  }

  // Dependant count filter (range objects)
  if (filterConfig.dependantCountFilters?.length) {
    if (!matchesRangeFilter(client.dependants, filterConfig.dependantCountFilters)) {
      return false;
    }
  }

  // Retirement age filter (range objects)
  if (filterConfig.retirementAgeFilters?.length) {
    if (!matchesRangeFilter(client.retirementAge, filterConfig.retirementAgeFilters)) {
      return false;
    }
  }

  // Product filter — matches against client.products array
  // OR logic: client must have at least one product matching ANY filter rule
  if (filterConfig.productFilters?.length) {
    if (!client.products || client.products.length === 0) return false;

    const matchesAnyProductRule = filterConfig.productFilters.some(rule => {
      return client.products!.some(product => {
        // If a provider is specified in the rule, the product must match it
        if (rule.provider && product.provider) {
          if (rule.provider.toLowerCase() !== product.provider.toLowerCase()) return false;
        } else if (rule.provider && !product.provider) {
          return false;
        }

        // If a type is specified in the rule, the product must match it
        if (rule.type && product.type) {
          if (rule.type.toLowerCase() !== product.type.toLowerCase()) return false;
        } else if (rule.type && !product.type) {
          return false;
        }

        return true; // All specified rule fields matched
      });
    });

    if (!matchesAnyProductRule) return false;
  }

  // All active filters passed
  return true;
}

/**
 * Recalculate membership for all dynamic groups based on current client data.
 * Manual groups (no active filters) are left unchanged.
 */
export function recalculateGroupMembership(
  groups: MatcherGroup[],
  clients: MatcherClient[]
): MatcherGroup[] {
  return groups.map(group => {
    // Skip manual groups (no filters or no active filters)
    if (!group.filterConfig || !hasActiveFilters(group.filterConfig)) {
      return group; // Keep existing clientIds for manual groups
    }

    // For dynamic groups, recalculate members based on filters
    const matchingClientIds = clients
      .filter(client => clientMatchesFilters(client, group.filterConfig!))
      .map(client => client.id);

    return {
      ...group,
      clientIds: matchingClientIds,
      clientCount: matchingClientIds.length,
      updatedAt: new Date().toISOString()
    };
  });
}

/**
 * Recalculate membership for a single group.
 */
export function recalculateSingleGroupMembership(
  group: MatcherGroup,
  clients: MatcherClient[]
): MatcherGroup {
  if (!group.filterConfig || !hasActiveFilters(group.filterConfig)) {
    return group;
  }

  const matchingClientIds = clients
    .filter(client => clientMatchesFilters(client, group.filterConfig!))
    .map(client => client.id);

  return {
    ...group,
    clientIds: matchingClientIds,
    clientCount: matchingClientIds.length,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get groups that a specific client should belong to
 */
export function getGroupsForClient(client: MatcherClient, groups: MatcherGroup[]): string[] {
  return groups
    .filter(group => {
      if (!group.filterConfig || !hasActiveFilters(group.filterConfig)) return false;
      return clientMatchesFilters(client, group.filterConfig);
    })
    .map(group => group.id);
}
