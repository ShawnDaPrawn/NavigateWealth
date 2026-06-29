/**
 * Refund Clusters panel — entry point rendered inside the Locked module's
 * Accounts → Refund Clusters tab (already behind super-admin + access-code
 * gating in LockedModule).
 *
 * Lists clusters as cards. A card is a single click target that opens the
 * ClusterDetailView — editing, archiving and deleting live inside that view's
 * Cluster Details tab, never on this screen, so a stray click here can never
 * archive or delete a cluster.
 */

import { useMemo, useState } from 'react';
import { FolderOpen, Layers, Plus, Search } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import { ClusterFormDialog } from './components/ClusterFormDialog';
import { ClusterDetailView } from './components/ClusterDetailView';
import { useCreateCluster, useRefundClusters } from './hooks/useRefundClusters';
import type { RefundCluster } from './types';

export function RefundClustersPanel() {
  const { data: clusters = [], isLoading } = useRefundClusters();
  const createCluster = useCreateCluster();

  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const visibleClusters = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clusters.filter(
      (cluster) =>
        cluster.archived === showArchived &&
        (!term ||
          cluster.name.toLowerCase().includes(term) ||
          cluster.description.toLowerCase().includes(term)),
    );
  }, [clusters, search, showArchived]);

  const archivedCount = useMemo(() => clusters.filter((c) => c.archived).length, [clusters]);

  if (openClusterId) {
    return <ClusterDetailView clusterId={openClusterId} onBack={() => setOpenClusterId(null)} />;
  }

  const handleSubmit = (values: {
    name: string;
    description: string;
    vatPeriod: RefundCluster['vatPeriod'];
  }) => {
    createCluster.mutate(values, { onSuccess: () => setFormOpen(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Refund Clusters</h2>
            <p className="text-sm text-muted-foreground">
              Group entities and capture their tax, banking and identity details.
            </p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create New Cluster
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clusters…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Show active' : `Show archived (${archivedCount})`}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : visibleClusters.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          {showArchived
            ? 'No archived clusters.'
            : clusters.length === 0
              ? 'No refund clusters yet. Click "Create New Cluster" to add the first one.'
              : 'No clusters match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleClusters.map((cluster) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              onOpen={() => setOpenClusterId(cluster.id)}
            />
          ))}
        </div>
      )}

      <ClusterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cluster={null}
        onSubmit={handleSubmit}
        isSubmitting={createCluster.isPending}
      />
    </div>
  );
}

/**
 * A cluster card is one big click target — the whole card opens the cluster.
 * No edit/archive/delete buttons live here: those are in the cluster's own
 * Cluster Details tab so they can't be triggered by a misplaced click.
 */
function ClusterCard({ cluster, onOpen }: { cluster: RefundCluster; onOpen: () => void }) {
  return (
    <Card className="group p-0 transition-all duration-150 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-primary/40">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${cluster.name}`}
        className="w-full text-left rounded-[inherit] focus:outline-none"
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary shrink-0 transition-transform duration-150 group-hover:scale-110" />
            <span className="font-medium truncate">{cluster.name}</span>
          </div>
          {cluster.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{cluster.description}</p>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {cluster.entityCount ?? 0} entit{(cluster.entityCount ?? 0) === 1 ? 'y' : 'ies'}
            </Badge>
            {cluster.archived && <Badge variant="outline">Archived</Badge>}
          </div>
        </CardContent>
      </button>
    </Card>
  );
}
