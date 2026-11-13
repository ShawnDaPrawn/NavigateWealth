/**
 * TabPermissions — Module Access & Capability Editor
 *
 * Two-level permission grid:
 *  1. Module access toggles (Phase 1 — switch on/off)
 *  2. Granular capability checkboxes per module (Phase 2 — expand when enabled)
 *
 * Super admin users cannot have their permissions edited (hardcoded full access).
 *
 * @module personnel/drawer/TabPermissions
 */

import { useState, useEffect, useCallback, type MutableRefObject } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Switch } from '../../../../../ui/switch';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Label } from '../../../../../ui/label';
import { Loader2, Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import { usePermissions, useUpdatePermissions } from '../../hooks';
import { PERMISSIONED_MODULES, SUPER_ADMIN_EMAIL, MODULE_CAPABILITIES } from '../../constants';
import { moduleConfig, moduleGroups } from '../../../../layout/config';
import type { AdminModule } from '../../../../layout/types';
import type { Personnel, ModuleAccess, Capability } from '../../types';
import { PermissionAuditTrail } from '../PermissionAuditTrail';

interface TabPermissionsProps {
  selectedPersonnel: Personnel;
  /** Filled with this tab's save so the page header's Save can run it. */
  saveRef?: MutableRefObject<(() => void) | null>;
  /** Lets the page header enable its Save button. */
  onFormStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}

export function TabPermissions({
  selectedPersonnel,
  saveRef,
  onFormStateChange,
}: TabPermissionsProps) {
  const isSuperAdmin = selectedPersonnel.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isTargetSuperAdminRole = selectedPersonnel.role === 'super_admin';

  // Fetch current permissions for this personnel member
  const { data: permissionSet, isLoading } = usePermissions(selectedPersonnel.id, !isSuperAdmin);

  const { mutate: savePermissions, isPending: isSaving } = useUpdatePermissions();

  // Local toggle state (controlled, not persisted until save)
  const [localModules, setLocalModules] = useState<Partial<Record<AdminModule, ModuleAccess>>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when server data arrives
  useEffect(() => {
    if (permissionSet?.modules) {
      setLocalModules(permissionSet.modules);
      setIsDirty(false);
    }
  }, [permissionSet]);

  // ── Module access toggle ──────────────────────────────────────────────
  const handleToggle = useCallback((module: AdminModule, checked: boolean) => {
    setLocalModules((prev) => {
      const existing = prev[module];
      return {
        ...prev,
        [module]: {
          access: checked,
          // When toggling on, preserve existing capabilities or start empty
          capabilities: checked ? existing?.capabilities || [] : [],
        },
      };
    });
    setIsDirty(true);
  }, []);

  // ── Capability toggle ────────────────────────────────────────────────
  const handleCapabilityToggle = useCallback(
    (module: AdminModule, capability: Capability, checked: boolean) => {
      setLocalModules((prev) => {
        const existing = prev[module];
        if (!existing) return prev;

        const currentCaps = existing.capabilities || [];
        const updatedCaps = checked
          ? [...currentCaps, capability]
          : currentCaps.filter((c) => c !== capability);

        return {
          ...prev,
          [module]: {
            ...existing,
            capabilities: updatedCaps,
          },
        };
      });
      setIsDirty(true);
    },
    [],
  );

  // ── Bulk capability actions per module ────────────────────────────────
  const handleSelectAllCapabilities = useCallback((module: AdminModule) => {
    const caps = MODULE_CAPABILITIES[module];
    if (!caps) return;
    setLocalModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        access: true,
        capabilities: caps.map((c) => c.key),
      },
    }));
    setIsDirty(true);
  }, []);

  const handleDeselectAllCapabilities = useCallback((module: AdminModule) => {
    setLocalModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        access: prev[module]?.access ?? false,
        capabilities: [],
      },
    }));
    setIsDirty(true);
  }, []);

  // ── Module-level bulk actions ─────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    const allEnabled: Partial<Record<AdminModule, ModuleAccess>> = {};
    PERMISSIONED_MODULES.forEach((m) => {
      const caps = MODULE_CAPABILITIES[m];
      allEnabled[m] = {
        access: true,
        capabilities: caps.map((c) => c.key),
      };
    });
    setLocalModules(allEnabled);
    setIsDirty(true);
  }, []);

  const handleDeselectAll = useCallback(() => {
    const allDisabled: Partial<Record<AdminModule, ModuleAccess>> = {};
    PERMISSIONED_MODULES.forEach((m) => {
      allDisabled[m] = { access: false, capabilities: [] };
    });
    setLocalModules(allDisabled);
    setIsDirty(true);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────
  // The mutation toasts; a failed save keeps the changes so it can be retried.
  const handleSave = useCallback(() => {
    savePermissions(
      {
        personnelId: selectedPersonnel.id,
        modules: localModules,
      },
      { onSuccess: () => setIsDirty(false) },
    );
  }, [savePermissions, selectedPersonnel.id, localModules]);

  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = handleSave;
    return () => {
      saveRef.current = null;
    };
  }, [saveRef, handleSave]);

  useEffect(() => {
    onFormStateChange?.({ dirty: isDirty, saving: isSaving });
  }, [isDirty, isSaving, onFormStateChange]);

  // Leaving the tab takes its unsaved state with it.
  useEffect(() => () => onFormStateChange?.({ dirty: false, saving: false }), [onFormStateChange]);

  // ── Derived counts ────────────────────────────────────────────────────
  const enabledCount = PERMISSIONED_MODULES.filter((m) => localModules[m]?.access === true).length;

  const totalCapabilities = PERMISSIONED_MODULES.reduce((sum, m) => {
    return sum + (localModules[m]?.capabilities?.length || 0);
  }, 0);

  // ══════════════════════════════════════════════════════════════════════
  // SUPER ADMIN STATE
  // ══════════════════════════════════════════════════════════════════════
  if (isSuperAdmin || isTargetSuperAdminRole) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Module access</CardTitle>
          </div>
          <CardDescription>
            This user is the Super Admin and has unrestricted access to all modules and
            capabilities. This cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-900">Full access</p>
              <p className="text-xs text-purple-700 mt-1">
                Super admin permissions are enforced at the system level and cannot be modified
                through this interface. All {PERMISSIONED_MODULES.length} modules and all
                capabilities are accessible.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
        <span className="text-sm text-muted-foreground">Loading permissions...</span>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PERMISSION GRID
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Module access & capabilities</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {enabledCount} / {PERMISSIONED_MODULES.length} modules
              </Badge>
              {totalCapabilities > 0 && (
                <Badge variant="outline" className="text-xs bg-purple-50">
                  {totalCapabilities} capabilities
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Control which modules and actions{' '}
            <span className="font-medium text-gray-700">
              {selectedPersonnel.firstName} {selectedPersonnel.lastName}
            </span>{' '}
            can perform. Switch a module on to grant access, then pick its capabilities. View is
            always granted when a module is on; no capabilities selected means view only. Dashboard
            is always accessible. Changes apply after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-xs h-7">
              Grant all
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} className="text-xs h-7">
              Revoke all
            </Button>
          </div>

          {/* Module groups */}
          {moduleGroups
            .filter((group) => group.modules.some((m) => PERMISSIONED_MODULES.includes(m)))
            .map((group) => {
              const groupModules = group.modules.filter((m) => PERMISSIONED_MODULES.includes(m));
              if (groupModules.length === 0) return null;

              return (
                <div key={group.label} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </h4>
                  <div className="space-y-1.5">
                    {groupModules.map((module) => {
                      const config = moduleConfig[module];
                      const Icon = config.icon;
                      const isEnabled = localModules[module]?.access === true;
                      const capabilities = MODULE_CAPABILITIES[module] || [];
                      const activeCaps = localModules[module]?.capabilities || [];

                      return (
                        <div
                          key={module}
                          className={cn(
                            'flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors sm:flex-row sm:items-center',
                            isEnabled
                              ? 'border-purple-200 bg-purple-50/50'
                              : 'border-gray-200 bg-gray-50/50',
                          )}
                        >
                          {/* Module access */}
                          <div className="flex min-w-0 items-center gap-2.5 sm:w-56 sm:shrink-0">
                            <Switch
                              id={`perm-${module}`}
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleToggle(module, checked)}
                            />
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isEnabled ? 'text-purple-600' : 'text-gray-400',
                              )}
                              aria-hidden="true"
                            />
                            <Label
                              htmlFor={`perm-${module}`}
                              className={cn(
                                'cursor-pointer text-sm',
                                isEnabled ? 'font-medium text-gray-900' : 'text-gray-500',
                              )}
                            >
                              {config.label}
                            </Label>
                          </div>

                          {/* Capabilities as chips; view is implied when the module is on */}
                          {capabilities.length > 0 && (
                            <div
                              role="group"
                              aria-label={`${config.label} capabilities`}
                              className="flex flex-1 flex-wrap items-center gap-1.5"
                            >
                              {capabilities.map((cap) => {
                                const isChecked = isEnabled && activeCaps.includes(cap.key);
                                return (
                                  <button
                                    key={cap.key}
                                    type="button"
                                    aria-pressed={isChecked}
                                    disabled={!isEnabled}
                                    title={cap.description}
                                    onClick={() =>
                                      handleCapabilityToggle(module, cap.key, !isChecked)
                                    }
                                    className={cn(
                                      'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
                                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
                                      'disabled:cursor-not-allowed disabled:opacity-50',
                                      isChecked
                                        ? 'border-nw-violet bg-nw-violet text-white'
                                        : 'border-gray-200 bg-white text-nw-text-2 hover:border-purple-300',
                                    )}
                                  >
                                    {cap.label}
                                  </button>
                                );
                              })}
                              {isEnabled && activeCaps.length === 0 && (
                                <span className="text-xs text-amber-700">View only</span>
                              )}
                              {isEnabled && (
                                <span className="ml-auto flex items-center gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllCapabilities(module)}
                                    className="font-medium text-purple-700 hover:text-purple-900"
                                    aria-label={`Select all ${config.label} capabilities`}
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeselectAllCapabilities(module)}
                                    className="font-medium text-gray-500 hover:text-gray-700"
                                    aria-label={`Clear ${config.label} capabilities`}
                                  >
                                    None
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {/* Info note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-blue-800">
                <strong>Module access</strong> controls sidebar visibility.{' '}
                <strong>Capabilities</strong> control specific actions within each module (e.g.
                create, edit, delete, publish).
              </p>
              <p className="text-xs text-blue-700">
                If no capabilities are selected, the user has <strong>view-only</strong> access to
                that module. The Dashboard is always accessible. Changes take effect after saving.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <PermissionAuditTrail personnelId={selectedPersonnel.id} />
    </div>
  );
}
