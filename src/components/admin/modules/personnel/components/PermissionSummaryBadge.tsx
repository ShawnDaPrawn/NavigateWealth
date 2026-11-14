/**
 * PermissionSummaryBadge — Compact permission summary for personnel table rows.
 *
 * Shows a mini badge with module count and capability count.
 * Super admin and no-permissions states are handled distinctly.
 *
 * @module personnel/components/PermissionSummaryBadge
 */

import { Badge } from '../../../../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/tooltip';

import type { PermissionSet } from '../types';
import { moduleConfig } from '../../../layout/config';
import { SUPER_ADMIN_EMAIL, PERMISSIONED_MODULES } from '../constants';
import type { AdminModule } from '../../../layout/types';

interface PermissionSummaryBadgeProps {
  /** The personnel member's email */
  email: string;
  /** The personnel member's role */
  role: string;
  /** Permission set from the bulk query (may be undefined if not yet loaded) */
  permissionSet?: PermissionSet;
  /** Whether permissions data is still loading */
  isLoading?: boolean;
}

export function PermissionSummaryBadge({
  email,
  role,
  permissionSet,
  isLoading,
}: PermissionSummaryBadgeProps) {
  const isSuperAdmin =
    email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || role === 'super_admin';

  // ── Super admin ────────────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <span className="ds-pill brand cursor-default">Full access</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs font-medium">Super Admin — Full Access</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All {PERMISSIONED_MODULES.length} modules and all capabilities are accessible. This
              cannot be modified.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Loading ────────────────────────────────────────────────────
  if (isLoading) {
    return <span className="ds-pill animate-pulse">Loading…</span>;
  }

  // ── No permissions set ─────────────────────────────────────────
  if (!permissionSet || !permissionSet.modules) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <span className="ds-pill bad cursor-default">No access</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              No module permissions have been configured yet. Click to open the Permissions tab.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Count enabled modules and capabilities ─────────────────────
  const modules = permissionSet.modules;
  const enabledModules = Object.entries(modules).filter(([_, v]) => v?.access === true);
  const enabledCount = enabledModules.length;
  const totalCaps = enabledModules.reduce((sum, [_, v]) => sum + (v?.capabilities?.length || 0), 0);

  // Build tooltip content — list accessible modules
  const accessibleModuleNames = enabledModules
    .map(([key]) => {
      const config = moduleConfig[key as AdminModule];
      return config?.label || key;
    })
    .sort();

  if (enabledCount === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <span className="ds-pill warn cursor-default">View only</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              All module access switches are off. The user can only view the Dashboard.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <span className="ds-pill cursor-default">
              {enabledCount} module{enabledCount !== 1 ? 's' : ''}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs">
          <p className="text-xs font-medium mb-1">
            {enabledCount} of {PERMISSIONED_MODULES.length} modules enabled
            {totalCaps > 0 && ` · ${totalCaps} capabilities`}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {accessibleModuleNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                {name}
              </Badge>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
