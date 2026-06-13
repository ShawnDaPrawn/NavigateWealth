/**
 * Refund Clusters panel — entry point rendered inside the Locked module's
 * Accounts → Refund Clusters tab (already behind super-admin + access-code
 * gating in LockedModule).
 *
 * Lists clusters as cards with create / edit / archive / delete actions;
 * opening a cluster swaps to the ClusterDetailView.
 */

import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { ClusterFormDialog } from './components/ClusterFormDialog';
import { ClusterDetailView } from './components/ClusterDetailView';
import {
  useCreateCluster,
  useDeleteCluster,
  useRefundClusters,
  useUpdateCluster,
} from './hooks/useRefundClusters';
import type { RefundCluster } from './types';

export function RefundClustersPanel() {
  const { data: clusters = [], isLoading } = useRefundClusters();
  const createCluster = useCreateCluster();
  const updateCluster = useUpdateCluster();
  const deleteCluster = useDeleteCluster();

  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<RefundCluster | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RefundCluster | null>(null);

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
    if (editingCluster) {
      updateCluster.mutate(
        { clusterId: editingCluster.id, patch: values },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createCluster.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
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
        <Button
          onClick={() => {
            setEditingCluster(null);
            setFormOpen(true);
          }}
        >
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
              onEdit={() => {
                setEditingCluster(cluster);
                setFormOpen(true);
              }}
              onToggleArchive={() =>
                updateCluster.mutate({
                  clusterId: cluster.id,
                  patch: { archived: !cluster.archived },
                })
              }
              onDelete={() => setDeleteTarget(cluster)}
            />
          ))}
        </div>
      )}

      <ClusterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cluster={editingCluster}
        onSubmit={handleSubmit}
        isSubmitting={createCluster.isPending || updateCluster.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cluster?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `"${deleteTarget.name}" and every entity and document inside it will be permanently deleted. Consider archiving instead. This action is audit-logged and cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteCluster.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClusterCard({
  cluster,
  onOpen,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  cluster: RefundCluster;
  onOpen: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <button type="button" onClick={onOpen} className="w-full text-left space-y-1">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium truncate">{cluster.name}</span>
          </div>
          {cluster.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{cluster.description}</p>
          )}
        </button>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {cluster.entityCount ?? 0} entit{(cluster.entityCount ?? 0) === 1 ? 'y' : 'ies'}
          </Badge>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Edit cluster" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={cluster.archived ? 'Unarchive cluster' : 'Archive cluster'}
              onClick={onToggleArchive}
            >
              {cluster.archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete cluster" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
