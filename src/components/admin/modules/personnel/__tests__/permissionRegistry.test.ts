import { describe, expect, it } from 'vitest';
import type { AdminModule } from '../../../layout/types';
import { moduleGroups, operationsModules } from '../../../layout/config';
import {
  ALWAYS_ACCESSIBLE_MODULES,
  MODULE_CAPABILITIES,
  PERMISSIONED_MODULES,
  ROLE_MODULE_PRESETS,
} from '../constants';

const groupedModules = moduleGroups.flatMap((group) => group.modules);

describe('personnel permission registry', () => {
  it('keeps navigable modules assignable or explicitly always accessible', () => {
    const coveredModules = new Set<AdminModule>([
      ...PERMISSIONED_MODULES,
      ...ALWAYS_ACCESSIBLE_MODULES,
    ]);

    for (const module of groupedModules) {
      expect(coveredModules.has(module), `${module} is not covered by permission rules`).toBe(true);
    }
  });

  it('keeps badge-bearing modules in admin role presets', () => {
    const adminVisibleModules = new Set<AdminModule>([
      ...ROLE_MODULE_PRESETS.admin,
      ...ALWAYS_ACCESSIBLE_MODULES,
    ]);

    for (const module of operationsModules) {
      expect(adminVisibleModules.has(module), `${module} is missing from admin-visible modules`).toBe(true);
    }
  });

  it('keeps permissioned modules represented in the capabilities registry', () => {
    for (const module of PERMISSIONED_MODULES) {
      expect(module in MODULE_CAPABILITIES, `${module} is missing capability metadata`).toBe(true);
    }
  });
});
