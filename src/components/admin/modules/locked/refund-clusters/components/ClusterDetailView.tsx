/**
 * Detail view for an opened refund cluster: cluster info, entity list with
 * search + type filter, and add/edit/delete/document actions per entity.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Building2, FileText, Pencil, Plus, Search, Trash2, User } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { Skeleton } from '../../../../../ui/skeleton';
import { ENTITY_TYPE_LABELS, VAT_PERIOD_OPTIONS } from '../constants';
import { entityDisplayName, entityMatchesSearch } from '../formState';
import {
  useCreateEntity,
  useDeleteEntity,
  useRefundClusterDetail,
  useUpdateEntity,
} from '../hooks/useRefundClusters';
import type { RefundEntity, RefundEntityInput, RefundEntityType } from '../types';
import { EntityFormDialog } from './EntityFormDialog';
import { EntityDocumentsDialog } from './EntityDocumentsDialog';

interface ClusterDetailViewProps {
  clusterId: string;
  onBack: () => void;
}

type TypeFilter = 'all' | RefundEntityType;

export function ClusterDetailView({ clusterId, onBack }: ClusterDetailViewProps) {
  const { data, isLoading } = useRefundClusterDetail(clusterId);
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<RefundEntity | null>(null);
  const [documentsEntity, setDocumentsEntity] = useState<RefundEntity | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RefundEntity | null>(null);

  const entities = useMemo(() => {
    const all = data?.entities ?? [];
    return all.filter(
      (entity) =>
        (typeFilter === 'all' || entity.entityType === typeFilter) &&
        entityMatchesSearch(entity, search),
    );
  }, [data?.entities, search, typeFilter]);

  const handleSubmit = (payload: RefundEntityInput) => {
    if (editingEntity) {
      updateEntity.mutate(
        { clusterId, entityId: editingEntity.id, entity: payload },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createEntity.mutate({ clusterId, entity: payload }, { onSuccess: () => setFormOpen(false) });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data?.cluster) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to clusters
        </Button>
        <p className="text-sm text-muted-foreground">Cluster not found.</p>
      </div>
    );
  }

  const { cluster } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to clusters
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{cluster.name}</h2>
            {cluster.archived && <Badge variant="outline">Archived</Badge>}
          </div>
          {cluster.description && (
            <p className="text-sm text-muted-foreground">{cluster.description}</p>
          )}
        </div>
        <Button
          onClick={() => {
            setEditingEntity(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Entity
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, surname, company or registration number…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
          <SelectTrigger className="w-[200px]" aria-label="Filter by entity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            <SelectItem value="sole_proprietor">Sole Proprietors</SelectItem>
            <SelectItem value="company">Companies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {entities.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          {data.entities.length === 0
            ? 'No entities in this cluster yet. Click "Add Entity" to get started.'
            : 'No entities match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onEdit={() => {
                setEditingEntity(entity);
                setFormOpen(true);
              }}
              onDocuments={() => {
                setDocumentsEntity(entity);
                setDocumentsOpen(true);
              }}
              onDelete={() => setDeleteTarget(entity)}
            />
          ))}
        </div>
      )}

      <EntityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clusterId={clusterId}
        entity={editingEntity}
        onSubmit={handleSubmit}
        isSubmitting={createEntity.isPending || updateEntity.isPending}
      />

      <EntityDocumentsDialog
        open={documentsOpen}
        onOpenChange={setDocumentsOpen}
        entity={documentsEntity}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entity?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `"${entityDisplayName(deleteTarget)}" and all of its documents will be permanently deleted. This action is audit-logged and cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteEntity.mutate({ clusterId, entityId: deleteTarget.id });
                }
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

function EntityCard({
  entity,
  onEdit,
  onDocuments,
  onDelete,
}: {
  entity: RefundEntity;
  onEdit: () => void;
  onDocuments: () => void;
  onDelete: () => void;
}) {
  const Icon = entity.entityType === 'company' ? Building2 : User;
  const vatLabel = VAT_PERIOD_OPTIONS.find((o) => o.value === entity.taxDetails.vatPeriod)?.label;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{entityDisplayName(entity)}</p>
              <p className="text-xs text-muted-foreground">
                {ENTITY_TYPE_LABELS[entity.entityType]}
                {entity.entityType === 'company' &&
                  entity.businessDetails?.registrationNumber &&
                  ` · ${entity.businessDetails.registrationNumber}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" aria-label="Edit entity" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Entity documents" onClick={onDocuments}>
              <FileText className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete entity" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {vatLabel && <Badge variant="secondary">VAT {vatLabel}</Badge>}
          {entity.taxDetails.efilingUsername && <Badge variant="outline">eFiling linked</Badge>}
          {entity.taxDetails.hasEfilingPassword && <Badge variant="outline">Password stored</Badge>}
          {entity.bankingDetails.primary.bankName && (
            <Badge variant="outline">{entity.bankingDetails.primary.bankName}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
