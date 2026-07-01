/**
 * Detail view for an opened refund cluster.
 *
 * Uses the same pill-style tab row as the Locked page's main tab rows:
 * Entities (search + type filter + entity cards) and Cluster Details
 * (stored fields plus edit / archive / delete actions).
 */

import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
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
import {
  ENTITY_TYPE_LABELS,
  MONTH_OPTIONS,
  VAT_PERIOD_OPTIONS,
  YEAR_END_DEPENDENT_CATEGORIES,
  vatPeriodDescription,
} from '../constants';
import { entityDisplayName, entityMatchesSearch } from '../formState';
import {
  useClusterManagers,
  useCreateEntity,
  useDeleteCluster,
  useDeleteEntity,
  useEntitiesTransactions,
  useEntityTransactions,
  useRefundClusterDetail,
  useUpdateCluster,
  useUpdateEntity,
} from '../hooks/useRefundClusters';
import {
  currentVatPeriod,
  formatIsoDate,
  formatPeriodRange,
  formatZar,
  netVatLabel,
  round2,
  summarizeTransactions,
  vatSubmissionDueDate,
  type VatSummary,
} from '../vat';
import type {
  RefundCluster,
  RefundEntity,
  RefundEntityInput,
  RefundEntityType,
  VatPeriodCategory,
} from '../types';
import { ClusterFormDialog } from './ClusterFormDialog';
import { EntityFormDialog } from './EntityFormDialog';
import { EntityDocumentsDialog } from './EntityDocumentsDialog';
import { EntityTransactionsDialog } from './EntityTransactionsDialog';
import { ManagersTab } from './ManagersTab';
import { SEGMENT_LIST, SEGMENT_TRIGGER } from './subTabs';

interface ClusterDetailViewProps {
  clusterId: string;
  onBack: () => void;
}

type TypeFilter = 'all' | RefundEntityType;

export function ClusterDetailView({ clusterId, onBack }: ClusterDetailViewProps) {
  const { data, isLoading } = useRefundClusterDetail(clusterId);
  const { data: managers = [] } = useClusterManagers(clusterId);
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();

  const managerNames = useMemo(() => new Map(managers.map((m) => [m.id, m.name])), [managers]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<RefundEntity | null>(null);
  const [documentsEntity, setDocumentsEntity] = useState<RefundEntity | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [transactionsEntity, setTransactionsEntity] = useState<RefundEntity | null>(null);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
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
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{cluster.name}</h2>
          {cluster.archived && <Badge variant="outline">Archived</Badge>}
        </div>
        {cluster.description && (
          <p className="text-sm text-muted-foreground">{cluster.description}</p>
        )}
      </div>

      {/* Segmented control — a compact, distinct look from the Accounts section
          nav (underline) and the top-level pill tabs, so it reads clearly as the
          switcher for sections *within this cluster*. Overview (the VAT summary)
          is the landing tab. */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="w-full overflow-x-auto">
          <TabsList className={SEGMENT_LIST}>
            <TabsTrigger value="overview" className={SEGMENT_TRIGGER}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="entities" className={SEGMENT_TRIGGER}>
              Entities
            </TabsTrigger>
            <TabsTrigger value="managers" className={SEGMENT_TRIGGER}>
              Managers
            </TabsTrigger>
            <TabsTrigger value="details" className={SEGMENT_TRIGGER}>
              Cluster Details
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ClusterVatOverview
            cluster={cluster}
            entities={data.entities}
            managerNames={managerNames}
          />
        </TabsContent>

        <TabsContent value="entities" className="space-y-4">
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
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger className="w-[200px]" aria-label="Filter by entity type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                <SelectItem value="sole_proprietor">Sole Proprietors</SelectItem>
                <SelectItem value="company">Companies</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditingEntity(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Entity
            </Button>
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
                  cluster={cluster}
                  managerName={entity.managerId ? managerNames.get(entity.managerId) : undefined}
                  onEdit={() => {
                    setEditingEntity(entity);
                    setFormOpen(true);
                  }}
                  onTransactions={() => {
                    setTransactionsEntity(entity);
                    setTransactionsOpen(true);
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
        </TabsContent>

        <TabsContent value="managers">
          <ManagersTab clusterId={clusterId} />
        </TabsContent>

        <TabsContent value="details">
          <ClusterDetailsTab cluster={cluster} entityCount={data.entities.length} onBack={onBack} />
        </TabsContent>
      </Tabs>

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

      <EntityTransactionsDialog
        open={transactionsOpen}
        onOpenChange={setTransactionsOpen}
        entity={transactionsEntity}
        vatPeriod={cluster.vatPeriod}
        vatYearEndMonth={cluster.vatYearEndMonth}
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

/**
 * Top-of-page VAT overview: the submission period the cluster is currently on
 * (period range + the date the VAT201 return is due) and a per-entity table of
 * output vs input VAT, totalled into the cluster's net payable / refund position.
 */
function ClusterVatOverview({
  cluster,
  entities,
  managerNames,
}: {
  cluster: RefundCluster;
  entities: RefundEntity[];
  managerNames: Map<string, string>;
}) {
  const period = useMemo(
    () => currentVatPeriod(cluster.vatPeriod, undefined, cluster.vatYearEndMonth),
    [cluster.vatPeriod, cluster.vatYearEndMonth],
  );
  const dueDate = period ? vatSubmissionDueDate(period) : null;

  const entityIds = useMemo(() => entities.map((e) => e.id), [entities]);
  const results = useEntitiesTransactions(cluster.id, entityIds);

  const rows = entities.map((entity, index) => ({
    entity,
    summary: summarizeTransactions(results[index]?.data ?? [], period),
  }));
  const isLoading = results.some((r) => r.isLoading);

  const totalOutput = round2(rows.reduce((sum, r) => sum + r.summary.outputVat, 0));
  const totalInput = round2(rows.reduce((sum, r) => sum + r.summary.inputVat, 0));
  const netVat = round2(totalOutput - totalInput);
  const netStatus = netVat < 0 ? 'refundable' : netVat > 0 ? 'payable' : 'nil';
  const netLabel =
    netStatus === 'payable'
      ? 'Net VAT payable to SARS'
      : netStatus === 'refundable'
        ? 'Net VAT refund due'
        : 'Net VAT — nil';
  const netClass =
    netStatus === 'refundable'
      ? 'text-green-700'
      : netStatus === 'payable'
        ? 'text-amber-700'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Current submission period
              </p>
              {period ? (
                <>
                  <p className="text-lg font-semibold leading-tight">{period.label}</p>
                  <p className="text-sm text-muted-foreground">{formatPeriodRange(period)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No VAT category set — set one in Cluster Details to track periods.
                </p>
              )}
            </div>
          </div>
          {dueDate && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Return due by</p>
              <p className="text-lg font-semibold leading-tight">{formatIsoDate(dueDate)}</p>
              <p className="text-xs text-muted-foreground">eFiling deadline</p>
            </div>
          )}
        </div>

        {entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add entities to see their VAT output and input for this period.
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">VAT Output</TableHead>
                  <TableHead className="text-right">VAT Input</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ entity, summary }) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entityDisplayName(entity)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entity.managerId
                        ? (managerNames.get(entity.managerId) ?? 'Unassigned')
                        : 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZar(summary.outputVat)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZar(summary.inputVat)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Totals{isLoading ? ' (loading…)' : ''}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZar(totalOutput)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatZar(totalInput)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className={`font-semibold ${netClass}`}>
                    {netLabel}
                  </TableCell>
                  <TableCell
                    colSpan={2}
                    className={`text-right tabular-nums font-semibold ${netClass}`}
                  >
                    {formatZar(Math.abs(netVat))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Cluster Details tab — stored fields plus edit / archive / delete actions. */
function ClusterDetailsTab({
  cluster,
  entityCount,
  onBack,
}: {
  cluster: RefundCluster;
  entityCount: number;
  onBack: () => void;
}) {
  const updateCluster = useUpdateCluster();
  const deleteCluster = useDeleteCluster();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const clusterPeriod = useMemo(
    () => currentVatPeriod(cluster.vatPeriod, undefined, cluster.vatYearEndMonth),
    [cluster.vatPeriod, cluster.vatYearEndMonth],
  );
  const clusterPeriodLabel = clusterPeriod ? formatPeriodRange(clusterPeriod) : '';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold">Cluster Details</h3>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Cluster Name</dt>
              <dd className="font-medium">{cluster.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={cluster.archived ? 'outline' : 'secondary'}>
                  {cluster.archived ? 'Archived' : 'Active'}
                </Badge>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">VAT Category</dt>
              <dd>
                {VAT_PERIOD_OPTIONS.find((o) => o.value === cluster.vatPeriod)?.label ?? 'Not set'}
                {clusterPeriod && (
                  <span className="text-muted-foreground">
                    {' '}
                    · Current period: {clusterPeriodLabel}
                  </span>
                )}
              </dd>
              {vatPeriodDescription(cluster.vatPeriod) ? (
                <dd className="text-xs text-muted-foreground mt-1">
                  {vatPeriodDescription(cluster.vatPeriod)}
                </dd>
              ) : (
                <dd className="text-xs text-muted-foreground mt-1">
                  No VAT category set — entity VAT summaries show all transactions. Use Edit to set
                  one.
                </dd>
              )}
              {YEAR_END_DEPENDENT_CATEGORIES.includes(cluster.vatPeriod as VatPeriodCategory) && (
                <dd className="text-xs text-muted-foreground mt-1">
                  Tax year-end:{' '}
                  {MONTH_OPTIONS.find((o) => o.value === (cluster.vatYearEndMonth ?? 2))?.label ??
                    'February'}
                </dd>
              )}
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd>{cluster.description || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entities</dt>
              <dd>{entityCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(cluster.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Updated</dt>
              <dd>{new Date(cluster.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-destructive">Danger zone</h3>
            <p className="text-sm text-muted-foreground">
              Archive to hide this cluster while keeping its data, or permanently delete it and
              everything inside.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                updateCluster.mutate({
                  clusterId: cluster.id,
                  patch: { archived: !cluster.archived },
                })
              }
              disabled={updateCluster.isPending}
            >
              {cluster.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-1" /> Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Cluster
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClusterFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cluster={cluster}
        onSubmit={(values) =>
          updateCluster.mutate(
            { clusterId: cluster.id, patch: values },
            { onSuccess: () => setEditOpen(false) },
          )
        }
        isSubmitting={updateCluster.isPending}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cluster?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${cluster.name}" and every entity and document inside it will be permanently deleted. Consider archiving instead. This action is audit-logged and cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                deleteCluster.mutate(cluster.id, { onSuccess: onBack });
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
  cluster,
  managerName,
  onEdit,
  onTransactions,
  onDocuments,
  onDelete,
}: {
  entity: RefundEntity;
  cluster: RefundCluster;
  managerName?: string;
  onEdit: () => void;
  onTransactions: () => void;
  onDocuments: () => void;
  onDelete: () => void;
}) {
  const Icon = entity.entityType === 'company' ? Building2 : User;
  const { data: transactions = [] } = useEntityTransactions(cluster.id, entity.id);
  const period = useMemo(
    () => currentVatPeriod(cluster.vatPeriod, undefined, cluster.vatYearEndMonth),
    [cluster.vatPeriod, cluster.vatYearEndMonth],
  );
  const summary = useMemo(
    () => summarizeTransactions(transactions, period),
    [transactions, period],
  );

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
            <Button
              size="icon"
              variant="ghost"
              aria-label="Entity transactions"
              onClick={onTransactions}
            >
              <Receipt className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Entity documents" onClick={onDocuments}>
              <FileText className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete entity" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <NetVatBadge summary={summary} hasPeriod={!!period} />
          <Badge variant="secondary" className="gap-1">
            <User className="h-3 w-3" />
            {managerName ? managerName : 'No manager'}
          </Badge>
          {entity.taxDetails.efilingUsername && <Badge variant="outline">eFiling linked</Badge>}
          {entity.bankingDetails.primary.bankName && (
            <Badge variant="outline">{entity.bankingDetails.primary.bankName}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Current-period net VAT badge: green when refundable (input), amber when payable (output). */
function NetVatBadge({ summary, hasPeriod }: { summary: VatSummary; hasPeriod: boolean }) {
  if (summary.count === 0) {
    return (
      <Badge className="bg-muted text-muted-foreground hover:bg-muted">
        VAT {formatZar(0)} · No VAT{hasPeriod ? ' this period' : ' yet'}
      </Badge>
    );
  }
  const cls =
    summary.status === 'refundable'
      ? 'bg-green-100 text-green-800 hover:bg-green-100'
      : summary.status === 'payable'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
        : 'bg-muted text-muted-foreground hover:bg-muted';
  return (
    <Badge className={cls}>
      VAT {formatZar(summary.netVat)} · {netVatLabel(summary.status)}
    </Badge>
  );
}
