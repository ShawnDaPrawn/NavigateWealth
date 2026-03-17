/**
 * Personnel Permissions Service
 * 
 * Manages module-level access permissions and granular capabilities
 * for personnel members.
 * 
 * Permissions are stored separately from personnel profiles in the KV store
 * to allow independent evolution without touching profile records.
 * 
 * Key pattern: permissions:{personnelId}
 * 
 * Data shape:
 *   {
 *     personnelId: string,
 *     modules: {
 *       [moduleName]: {
 *         access: boolean,
 *         capabilities?: string[]   // Phase 2 — granular actions
 *       }
 *     },
 *     updatedAt: string,
 *     updatedBy: string
 *   }
 * 
 * Security:
 *  - Super admin (shawn@navigatewealth.co) bypasses all checks (hardcoded, never stored)
 *  - Only super_admin and admin roles can read/write permissions
 *  - Default for new personnel: no module access (secure by default)
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { SUPER_ADMIN_EMAIL } from './constants.ts';

const log = createModuleLogger('permissions');

const PERMISSIONS_PREFIX = 'permissions:';

// Types (server-side, mirrors frontend types)
interface ModuleAccess {
  access: boolean;
  capabilities?: string[];
}

interface PermissionSet {
  personnelId: string;
  modules: Record<string, ModuleAccess>;
  updatedAt: string;
  updatedBy: string;
}

export const PermissionsService = {
  /**
   * Check if an email is the super admin (hardcoded bypass)
   */
  isSuperAdmin(email: string): boolean {
    return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  },

  /**
   * Get permissions for a personnel member
   * Returns null if no permissions have been set (implies no access)
   */
  async getPermissions(personnelId: string): Promise<PermissionSet | null> {
    try {
      const data = await kv.get(`${PERMISSIONS_PREFIX}${personnelId}`);
      return data as PermissionSet | null;
    } catch (error) {
      log.error('Failed to get permissions', { personnelId, error });
      return null;
    }
  },

  /**
   * Set permissions for a personnel member.
   * Merges with existing permissions (partial update supported).
   * Capabilities arrays are replaced per-module, not merged.
   */
  async setPermissions(
    personnelId: string,
    modules: Record<string, ModuleAccess>,
    updatedBy: string
  ): Promise<PermissionSet> {
    const existing = await this.getPermissions(personnelId);

    // Deep merge: for each incoming module, replace the full entry
    const mergedModules: Record<string, ModuleAccess> = {
      ...(existing?.modules || {}),
    };

    for (const [mod, access] of Object.entries(modules)) {
      mergedModules[mod] = {
        access: access.access,
        capabilities: access.capabilities || [],
      };
    }

    const updated: PermissionSet = {
      personnelId,
      modules: mergedModules,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await kv.set(`${PERMISSIONS_PREFIX}${personnelId}`, updated);

    // Count total capabilities for logging
    const totalCaps = Object.values(mergedModules).reduce(
      (sum, m) => sum + (m.capabilities?.length || 0),
      0
    );

    log.info('Permissions updated', {
      personnelId,
      updatedBy,
      moduleCount: Object.keys(mergedModules).length,
      enabledModules: Object.values(mergedModules).filter((m) => m.access).length,
      totalCapabilities: totalCaps,
    });

    return updated;
  },

  /**
   * Delete permissions for a personnel member (used on personnel deletion)
   */
  async deletePermissions(personnelId: string): Promise<void> {
    try {
      await kv.del(`${PERMISSIONS_PREFIX}${personnelId}`);
      log.info('Permissions deleted', { personnelId });
    } catch (error) {
      log.error('Failed to delete permissions', { personnelId, error });
    }
  },

  /**
   * Get permissions for multiple personnel members
   */
  async getAllPermissions(): Promise<PermissionSet[]> {
    try {
      const results = await kv.getByPrefix(PERMISSIONS_PREFIX);
      return results as PermissionSet[];
    } catch (error) {
      log.error('Failed to get all permissions', { error });
      return [];
    }
  },

  /**
   * Check if a personnel member has access to a specific module
   */
  async hasModuleAccess(personnelId: string, module: string): Promise<boolean> {
    const permissions = await this.getPermissions(personnelId);
    if (!permissions) return false;
    return permissions.modules[module]?.access === true;
  },

  /**
   * Check if a personnel member has a specific capability in a module.
   * Returns true if:
   *  - Module has access: true AND
   *  - capabilities array includes the capability, OR
   *  - capabilities array is empty/undefined (backwards-compatible full access)
   */
  async hasCapability(
    personnelId: string,
    module: string,
    capability: string
  ): Promise<boolean> {
    const permissions = await this.getPermissions(personnelId);
    if (!permissions) return false;

    const modulePerms = permissions.modules[module];
    if (!modulePerms?.access) return false;

    // View is always granted when module is accessible
    if (capability === 'view') return true;

    // Backwards compat: no capabilities = full access
    if (!modulePerms.capabilities || modulePerms.capabilities.length === 0) {
      return true;
    }

    return modulePerms.capabilities.includes(capability);
  },
};