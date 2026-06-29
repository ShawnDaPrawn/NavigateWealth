/**
 * Shared sub-tab styling for the Locked module.
 *
 * One underline-style tab look, used for every sub-tab level below the top
 * Banking / Accounts / Trading pill row: the Accounts sub-tabs in
 * `LockedModule` and the Entities / Managers / Cluster Details sub-tabs in
 * `ClusterDetailView`. Centralised here so the two levels stay visually
 * identical (levels are told apart by breadcrumb + header context, not by a
 * third tab style). Lives inside the module so it deletes with it.
 */

export const SUBTAB_LIST =
  'w-full justify-start bg-transparent rounded-none p-0 h-auto border-b border-border gap-0';

export const SUBTAB_TRIGGER =
  'rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1 text-sm font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary disabled:opacity-50 disabled:pointer-events-none';
