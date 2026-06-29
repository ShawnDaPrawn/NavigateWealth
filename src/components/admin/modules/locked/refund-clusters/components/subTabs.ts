/**
 * Shared tab styling for the Locked module — two distinct looks for two
 * distinct navigation levels, so they never read as the same control:
 *
 * - `SUBTAB_*` — underline tabs for the Accounts section nav (Overview /
 *   Refund Clusters / Disbursement) in `AccountsPanel`.
 * - `SEGMENT_*` — a compact segmented control (muted track, raised active
 *   pill) for the within-a-cluster nav (Entities / Managers / Cluster
 *   Details) in `ClusterDetailView`.
 *
 * These two bars are never shown at the same time (opening a cluster hides the
 * section nav), and they look different even side by side. Lives inside the
 * module so it deletes with it.
 */

export const SUBTAB_LIST =
  'w-full justify-start bg-transparent rounded-none p-0 h-auto border-b border-border gap-0';

export const SUBTAB_TRIGGER =
  'rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1 text-sm font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary disabled:opacity-50 disabled:pointer-events-none';

export const SEGMENT_LIST =
  'inline-flex h-auto w-auto items-center justify-start gap-1 rounded-lg bg-muted p-1';

export const SEGMENT_TRIGGER =
  'rounded-md border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm disabled:opacity-50 disabled:pointer-events-none';
