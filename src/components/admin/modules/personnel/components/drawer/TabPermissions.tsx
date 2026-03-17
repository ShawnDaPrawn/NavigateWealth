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

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Switch } from '../../../../../ui/switch';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/tooltip';
import {
  Loader2,
  Save,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import { usePermissions, useUpdatePermissions } from '../../hooks';
import {
  PERMISSIONED_MODULES,
  SUPER_ADMIN_EMAIL,
  MODULE_CAPABILITIES,
  CAPABILITY_COLORS,
} from '../../constants';
import { moduleConfig, moduleGroups } from '../../../../layout/config';
import type { AdminModule } from '../../../../layout/types';
import type { Personnel, ModuleAccess, Capability } from '../../types';
import { PermissionAuditTrail } from '../PermissionAuditTrail';

interface TabPermissionsProps {
  selectedPersonnel: Personnel;
}

export function TabPermissions({ selectedPersonnel }: TabPermissionsProps) {
  const isSuperAdmin =
    selectedPersonnel.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isTargetSuperAdminRole = selectedPersonnel.role === 'super_admin';

  // Fetch current permissions for this personnel member
  const { data: permissionSet, isLoading } = usePermissions(
    selectedPersonnel.id,
    !isSuperAdmin
  );

  const { mutate: savePermissions, isPending: isSaving } =
    useUpdatePermissions();

  // Local toggle state (controlled, not persisted until save)
  const [localModules, setLocalModules] = useState<
    Partial<Record<AdminModule, ModuleAccess>>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<AdminModule>>(
    new Set()
  );

  // Sync local state when server data arrives
  useEffect(() => {
    if (permissionSet?.modules) {
      setLocalModules(permissionSet.modules);
      setIsDirty(false);
    }
  }, [permissionSet]);

  // ── Module access toggle ──────────────────────────────────────────────
  const handleToggle = useCallback(
    (module: AdminModule, checked: boolean) => {
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
      // Auto-expand when enabling
      if (checked) {
        setExpandedModules((prev) => new Set([...prev, module]));
      }
      setIsDirty(true);
    },
    []
  );

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
    []
  );

  // ── Bulk capability actions per module ────────────────────────────────
  const handleSelectAllCapabilities = useCallback(
    (module: AdminModule) => {
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
    },
    []
  );

  const handleDeselectAllCapabilities = useCallback(
    (module: AdminModule) => {
      setLocalModules((prev) => ({
        ...prev,
        [module]: {
          ...prev[module],
          access: prev[module]?.access ?? false,
          capabilities: [],
        },
      }));
      setIsDirty(true);
    },
    []
  );

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

  // ── Expand / collapse ────────────────────────────────────────────────
  const toggleExpand = useCallback((module: AdminModule) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    savePermissions({
      personnelId: selectedPersonnel.id,
      modules: localModules,
    });
    setIsDirty(false);
  }, [savePermissions, selectedPersonnel.id, localModules]);

  // ── Derived counts ────────────────────────────────────────────────────
  const enabledCount = PERMISSIONED_MODULES.filter(
    (m) => localModules[m]?.access === true
  ).length;

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
            <CardTitle className="text-lg">Module Access</CardTitle>
          </div>
          <CardDescription>
            This user is the Super Admin and has unrestricted access to all
            modules and capabilities. This cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-900">
                Full Access (Hardcoded)
              </p>
              <p className="text-xs text-purple-700 mt-1">
                Super admin permissions are enforced at the system level and
                cannot be modified through this interface. All{' '}
                {PERMISSIONED_MODULES.length} modules and all capabilities are
                accessible.
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
        <span className="text-sm text-muted-foreground">
          Loading permissions...
        </span>
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
              <CardTitle className="text-lg">Module Access & Capabilities</CardTitle>
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
              {isDirty && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Control which modules and actions{' '}
            <span className="font-medium text-gray-700">
              {selectedPersonnel.firstName} {selectedPersonnel.lastName}
            </span>{' '}
            can perform. Toggle a module on to grant access, then configure
            specific capabilities. Dashboard is always accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs h-7"
            >
              Grant All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="text-xs h-7"
            >
              Revoke All
            </Button>
          </div>

          {/* Module groups */}
          {moduleGroups
            .filter((group) =>
              group.modules.some((m) => PERMISSIONED_MODULES.includes(m))
            )
            .map((group) => {
              const groupModules = group.modules.filter((m) =>
                PERMISSIONED_MODULES.includes(m)
              );
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
                      const hasCaps = capabilities.length > 0;
                      const isExpanded =
                        expandedModules.has(module) && isEnabled && hasCaps;
                      const activeCaps =
                        localModules[module]?.capabilities || [];
                      const allCapsGranted =
                        hasCaps &&
                        capabilities.every((c) =>
                          activeCaps.includes(c.key)
                        );
                      const someCapsGranted =
                        hasCaps &&
                        activeCaps.length > 0 &&
                        !allCapsGranted;

                      return (
                        <div
                          key={module}
                          className={cn(
                            'rounded-lg border transition-colors',
                            isEnabled
                              ? 'bg-purple-50/50 border-purple-200'
                              : 'bg-gray-50/50 border-gray-200'
                          )}
                        >
                          {/* Module row */}
                          <div className="flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {/* Expand chevron (only when module is enabled and has capabilities) */}
                              {isEnabled && hasCaps ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(module)}
                                  className="p-0.5 rounded hover:bg-purple-100 transition-colors"
                                  aria-label={isExpanded ? 'Collapse capabilities' : 'Expand capabilities'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-purple-600" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-[18px]" /> /* spacer */
                              )}
                              <Icon
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  isEnabled
                                    ? 'text-purple-600'
                                    : 'text-gray-400'
                                )}
                              />
                              <Label
                                htmlFor={`perm-${module}`}
                                className={cn(
                                  'text-sm cursor-pointer',
                                  isEnabled
                                    ? 'text-gray-900 font-medium'
                                    : 'text-gray-500'
                                )}
                              >
                                {config.label}
                              </Label>
                              {/* Capability summary badges */}
                              {isEnabled && hasCaps && !isExpanded && (
                                <div className="flex items-center gap-1 ml-1">
                                  {/* View is always implicit */}
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 h-4 bg-gray-50 text-gray-500 border-gray-200"
                                  >
                                    <Eye className="h-2.5 w-2.5 mr-0.5" />
                                    View
                                  </Badge>
                                  {activeCaps.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200"
                                    >
                                      +{activeCaps.length}
                                    </Badge>
                                  )}
                                  {activeCaps.length === 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200"
                                    >
                                      View only
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <Switch
                              id={`perm-${module}`}
                              checked={isEnabled}
                              onCheckedChange={(checked) =>
                                handleToggle(module, checked)
                              }
                            />
                          </div>

                          {/* Capabilities panel (expanded) */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="ml-[18px] pl-2.5 border-l-2 border-purple-200">
                                {/* Implicit view indicator */}
                                <div className="flex items-center gap-2 py-1.5 px-2 mb-1">
                                  <Eye className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    View — always granted when module is
                                    enabled
                                  </span>
                                </div>

                                {/* Capability checkboxes */}
                                <div className="space-y-0.5">
                                  {capabilities.map((cap) => {
                                    const isChecked = activeCaps.includes(
                                      cap.key
                                    );
                                    return (
                                      <TooltipProvider key={cap.key}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <label
                                              htmlFor={`cap-${module}-${cap.key}`}
                                              className={cn(
                                                'flex items-center gap-2.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
                                                isChecked
                                                  ? 'bg-purple-50 hover:bg-purple-100'
                                                  : 'hover:bg-gray-100'
                                              )}
                                            >
                                              <Checkbox
                                                id={`cap-${module}-${cap.key}`}
                                                checked={isChecked}
                                                onCheckedChange={(
                                                  checked
                                                ) =>
                                                  handleCapabilityToggle(
                                                    module,
                                                    cap.key,
                                                    checked === true
                                                  )
                                                }
                                              />
                                              <span
                                                className={cn(
                                                  'text-xs font-medium',
                                                  CAPABILITY_COLORS[cap.key]
                                                )}
                                              >
                                                {cap.label}
                                              </span>
                                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                                — {cap.description}
                                              </span>
                                            </label>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="right"
                                            className="sm:hidden"
                                          >
                                            <p className="text-xs">
                                              {cap.description}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                </div>

                                {/* Per-module bulk */}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-purple-100">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectAllCapabilities(module)
                                    }
                                    className="text-[10px] text-purple-600 hover:text-purple-800 font-medium"
                                  >
                                    Select all
                                  </button>
                                  <span className="text-gray-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeselectAllCapabilities(module)
                                    }
                                    className="text-[10px] text-gray-500 hover:text-gray-700 font-medium"
                                  >
                                    Clear all
                                  </button>
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    {activeCaps.length} / {capabilities.length}
                                  </span>
                                </div>
                              </div>
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
                <strong>Capabilities</strong> control specific actions within
                each module (e.g. create, edit, delete, publish).
              </p>
              <p className="text-xs text-blue-700">
                If no capabilities are selected, the user has{' '}
                <strong>view-only</strong> access to that module. The Dashboard
                is always accessible. Changes take effect after saving.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <PermissionAuditTrail personnelId={selectedPersonnel.id} />
    </div>
  );
}