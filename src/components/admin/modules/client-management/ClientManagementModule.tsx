import React, { useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { Card, CardContent } from '../../../ui/card';
import {
  PageHeader,
  StatCard,
  NavTabsList,
  NavTabsTrigger,
  useUrlState,
  useRecordInUrl,
  SoonBadge,
} from '../../layout/page';
import {
  Plus,
  Filter,
  Download,
  Users,
  Search,
  Building,
  Database,
  ChevronDown,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { DataTable, Column } from '../../components/DataTable';
import { Client, ClientFilters } from './types';
import { useClientList } from './hooks/useClientList';
import { useClientDeepLink } from './hooks/useClientDeepLink';
import {
  calculateGrowthStats,
  filterClients,
  generateClientCSV,
  deriveAccountStatus,
  countByStatus,
} from './utils';
import { ACCOUNT_STATUS_CONFIG, ACCOUNT_STATUS_FILTER_OPTIONS, CONFIG } from './constants';
import { useCurrentUserPermissions } from '../personnel';
import { useAdminNavigation } from '../../layout/AdminNavigationContext';
import { useOptionalUnsavedChangesRegistry } from '../../../shared/unsaved-changes';
import type { IntakeHandoffState } from './components/IntakeWizardHandoff';
import { FNA_POLICY_CATEGORY, type FNAListFocus } from '../fna';
import { useInvalidateFnaBatchStatus } from '@/shared/fna-intake/hooks/useFnaBatchStatus';

// Heavy sub-components — lazy-loaded (only rendered on user action)
const ClientDrawer = React.lazy(() =>
  import('./components/ClientDrawer').then((m) => ({ default: m.ClientDrawer })),
);
import { CustomGroupManager } from '../communication';
import { FNAIntakeQueueSkeleton } from './components/FNAIntakeQueueSkeleton';

const ClientFieldRepository = React.lazy(() =>
  import('./components/ClientFieldRepository').then((m) => ({ default: m.ClientFieldRepository })),
);
const AddClientDialog = React.lazy(() =>
  import('./components/AddClientDialog').then((m) => ({ default: m.AddClientDialog })),
);
const FNAIntakeQueue = React.lazy(() =>
  import('./components/FNAIntakeQueue').then((m) => ({ default: m.FNAIntakeQueue })),
);
const IntakeWizardHandoff = React.lazy(() =>
  import('./components/IntakeWizardHandoff').then((m) => ({ default: m.IntakeWizardHandoff })),
);

const CLIENT_TABS = ['personal', 'groups', 'corporate', 'adviser'] as const;

/** Shared spinner for lazy-loaded sub-components */
function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

export function ClientManagementModule() {
  const { clients, loading, refetch } = useClientList();
  const [filters, setFilters] = useState<ClientFilters>({});
  const [blockSearchAutofill, setBlockSearchAutofill] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRepository, setShowRepository] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [intakeHandoff, setIntakeHandoff] = useState<IntakeHandoffState | null>(null);
  // Set when a publish should open the drawer on that FNA's list; the nonce
  // remounts the drawer so it opens there even if it was already open.
  const [drawerFnaFocus, setDrawerFnaFocus] = useState<(FNAListFocus & { nonce: number }) | null>(
    null,
  );
  const invalidateFnaBatchStatus = useInvalidateFnaBatchStatus();
  const [clientType, setClientType] = useUrlState('tab', 'personal', CLIENT_TABS);
  const { canDo } = useCurrentUserPermissions();
  const { pendingSelection, clearPendingSelection } = useAdminNavigation();
  const unsavedChangesRegistry = useOptionalUnsavedChangesRegistry();

  // Defensive: ensure clients is always an array (§10 — never swallow errors silently)
  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);

  // Keep drawer header / table selection in sync when the client list refreshes (e.g. after name save).
  React.useEffect(() => {
    const id = selectedClient?.id;
    if (!id) return;
    const fresh = safeClients.find((c) => c.id === id);
    if (!fresh) return;
    setSelectedClient((prev) => {
      if (!prev || prev.id !== id) return prev;
      if (
        fresh.firstName === prev.firstName &&
        fresh.lastName === prev.lastName &&
        fresh.email === prev.email &&
        fresh.applicationNumber === prev.applicationNumber
      ) {
        return prev;
      }
      return fresh;
    });
  }, [safeClients, selectedClient?.id]);

  // The id of the client most recently asked for, by any route (row, search,
  // deep link, intake). The address sync below must not close a client that
  // was opened in the same update as the old one's address was cleared.
  const lastOpenedIdRef = useRef<string | null>(null);
  const showClient = useCallback((target: Client) => {
    lastOpenedIdRef.current = target.id;
    setSelectedClient(target);
    setDrawerOpen(true);
  }, []);

  // ── GlobalSearch deep-link: auto-open drawer for pending client selection ──
  React.useEffect(() => {
    if (pendingSelection?.type === 'client' && !loading && safeClients.length > 0) {
      const target = safeClients.find((c) => c.id === pendingSelection.id);
      if (target) showClient(target);
      clearPendingSelection();
    }
  }, [pendingSelection, loading, safeClients, clearPendingSelection, showClient]);

  // Deep link: /admin?module=clients&clientId=… (prefill banner, external form
  // link, submissions). Opens the drawer once, then drops the id from the URL.
  const openDeepLinkedClient = showClient;
  useClientDeepLink(safeClients, loading, openDeepLinkedClient);

  // An open client is a page with its own address (?client=<id>).
  useRecordInUrl('client', drawerOpen && selectedClient ? selectedClient.id : null, {
    ready: !loading && safeClients.length > 0,
    openFromUrl: (id) => {
      if (loading || safeClients.length === 0) return 'waiting';
      const target = safeClients.find((c) => c.id === id);
      if (!target) {
        toast.error('Client not found');
        return 'missing';
      }
      setDrawerFnaFocus(null);
      showClient(target);
      return 'opened';
    },
    closeFromUrl: (previousId) => {
      if (lastOpenedIdRef.current && lastOpenedIdRef.current !== previousId) return;
      setDrawerOpen(false);
    },
  });

  const canCreate = canDo('clients', 'create');
  const canExport = canDo('clients', 'export');
  const canEditClient = canDo('clients', 'edit');
  const canDeleteClient = canDo('clients', 'delete');

  const openClientDrawer = (client: Client) => {
    setDrawerFnaFocus(null);
    showClient(client);
  };

  // A wizard opened from an accepted intake lands, on publish, where the FNA
  // now lives: the client's Policy Details → that category → FNA list.
  const handleIntakeFNAPublished = (fnaId: string, handoff: IntakeHandoffState) => {
    invalidateFnaBatchStatus(handoff.clientId);
    const target = safeClients.find((c) => c.id === handoff.clientId);
    if (!target) return;
    setDrawerFnaFocus({
      categorySubtabId: FNA_POLICY_CATEGORY[handoff.domain],
      fnaId,
      nonce: Date.now(),
    });
    showClient(target);
  };

  const handleRowClick = (client: Client) => {
    if (drawerOpen && selectedClient && selectedClient.id !== client.id) {
      unsavedChangesRegistry?.tryLeaveAny(() => openClientDrawer(client));
      return;
    }
    openClientDrawer(client);
  };

  // Filter clients, then alphabetical by first name → surname (en-ZA, case-insensitive)
  const filteredSortedClients = useMemo(() => {
    const filtered = filterClients(safeClients, filters);
    return [...filtered].sort((a, b) => {
      const fn = (a.firstName || '').trim().localeCompare((b.firstName || '').trim(), 'en-ZA', {
        sensitivity: 'base',
      });
      if (fn !== 0) return fn;
      return (a.lastName || '').trim().localeCompare((b.lastName || '').trim(), 'en-ZA', {
        sensitivity: 'base',
      });
    });
  }, [safeClients, filters]);

  const baseClients = filterClients(safeClients, {});
  const totalStats = calculateGrowthStats(baseClients);

  // Status breakdown for stat cards
  const statusCounts = useMemo(() => countByStatus(baseClients), [baseClients]);

  // Currently active filter label for the status dropdown
  const activeStatusFilter = filters.accountStatus || 'all';
  const activeStatusLabel =
    ACCOUNT_STATUS_FILTER_OPTIONS.find((o) => o.value === activeStatusFilter)?.label ||
    'All Statuses';

  const handleExport = () => {
    generateClientCSV(filteredSortedClients);
  };

  // Personal clients table columns configuration
  const personalColumns: Column<Client>[] = [
    {
      key: 'name',
      title: 'Name',
      render: (_, client) => {
        const status = deriveAccountStatus(client);
        const cfg = ACCOUNT_STATUS_CONFIG[status];
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/api/placeholder/32/32`} />
                <AvatarFallback>
                  {client.firstName[0]}
                  {client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {/* Status dot overlay */}
              {status !== 'active' && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${cfg.dotClass}`}
                  title={cfg.label}
                />
              )}
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                {client.firstName} {client.lastName}
                {client.email?.toLowerCase() === CONFIG.SUPER_ADMIN_EMAIL.toLowerCase() && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Staff test profile
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{client.email}</div>
            </div>
          </div>
        );
      },
      width: '350px',
    },
    {
      key: 'idNumber',
      title: 'ID or Passport',
      render: (idNumber) => (
        <span className="font-mono text-sm">
          {idNumber && idNumber !== 'Not provided' ? (
            `${(idNumber as string).slice(0, 6)}***${(idNumber as string).slice(-2)}`
          ) : (
            <span className="text-muted-foreground">Not provided</span>
          )}
        </span>
      ),
      width: '180px',
    },
    {
      key: 'createdAt',
      title: 'Date Joined',
      render: (date) =>
        new Date(date as string).toLocaleDateString('en-ZA', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      width: '150px',
    },
    {
      key: 'accountStatus',
      title: 'Account',
      render: (_, client) => {
        const status = deriveAccountStatus(client);
        const cfg = ACCOUNT_STATUS_CONFIG[status];
        return <Badge className={cfg.badgeClass}>{cfg.label}</Badge>;
      },
      width: '120px',
    },
    {
      key: 'status',
      title: 'Application',
      render: (_, client) => {
        const isActive = client.applicationStatus === 'approved';
        return (
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={isActive ? 'bg-green-600 text-white hover:bg-green-700' : ''}
          >
            {isActive ? 'Active' : 'Application'}
          </Badge>
        );
      },
      width: '120px',
    },
  ];

  // A client is open: show its page instead of the list.
  if (drawerOpen && selectedClient) {
    return (
      <div className="p-6 lg:p-8">
        <Suspense fallback={<LazyFallback />}>
          <ClientDrawer
            key={`${selectedClient.id}:${drawerFnaFocus?.nonce ?? 0}`}
            client={selectedClient}
            fnaFocus={drawerFnaFocus ?? undefined}
            open
            onOpenChange={setDrawerOpen}
            canEdit={canEditClient}
            canDelete={canDeleteClient}
          />
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          <IntakeWizardHandoff
            handoff={intakeHandoff}
            onClose={() => setIntakeHandoff(null)}
            onFNAComplete={handleIntakeFNAPublished}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title="Client Management"
        description="Client profiles, policies and compliance documentation."
        actions={
          <>
            {canExport && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowRepository(true)}>
                  <Database className="mr-2 h-4 w-4" aria-hidden="true" />
                  Field repository
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreate && (
              <Button onClick={() => setShowAddClient(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add client
              </Button>
            )}
          </>
        }
      />

      <Suspense fallback={<FNAIntakeQueueSkeleton />}>
        <FNAIntakeQueue
          onOpenClient={(clientId) => {
            const match = safeClients.find((c) => c.id === clientId);
            if (match) setSelectedClient(match);
          }}
          onAccept={(handoff) => {
            const match = safeClients.find((c) => c.id === handoff.clientId);
            setIntakeHandoff({
              ...handoff,
              clientName: match ? `${match.firstName} ${match.lastName}` : undefined,
            });
          }}
        />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="All clients"
          value={baseClients.length}
          meta={`+${totalStats.growthRate}% vs last month`}
        />
        <StatCard label="Active" value={statusCounts.active} meta="Active individual portfolios" />
        <StatCard
          label="Suspended"
          value={statusCounts.suspended}
          meta="Access temporarily suspended"
          tone={statusCounts.suspended > 0 ? 'attention' : 'default'}
        />
        <StatCard
          label="Closed"
          value={statusCounts.closed}
          meta="Soft-deleted or closed accounts"
        />
      </div>

      {/* MAIN TABS */}
      <Tabs
        value={clientType}
        onValueChange={(v) => setClientType(v as (typeof CLIENT_TABS)[number])}
        className="gap-4"
      >
        <NavTabsList aria-label="Client Management">
          <NavTabsTrigger value="personal" count={baseClients.length}>
            Personal clients
          </NavTabsTrigger>
          <NavTabsTrigger value="groups">Groups</NavTabsTrigger>
          <NavTabsTrigger value="corporate">
            Corporate clients
            <SoonTag />
          </NavTabsTrigger>
          <NavTabsTrigger value="adviser">
            Adviser clients
            <SoonTag />
          </NavTabsTrigger>
        </NavTabsList>

        <TabsContent value="personal" className="mt-0 space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-8"
                value={filters.search || ''}
                readOnly={blockSearchAutofill}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name="nw-client-management-search"
                id="nw-client-management-search"
                type="text"
                inputMode="search"
                role="combobox"
                aria-autocomplete="list"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onFocus={() => setBlockSearchAutofill(false)}
              />
            </div>

            {/* Account status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[140px] justify-between">
                  <div className="contents">
                    <Filter className="mr-2 h-4 w-4" />
                    {activeStatusLabel}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuRadioGroup
                  value={activeStatusFilter}
                  onValueChange={(v) =>
                    setFilters({ ...filters, accountStatus: v as ClientFilters['accountStatus'] })
                  }
                >
                  {ACCOUNT_STATUS_FILTER_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DataTable
            columns={personalColumns as unknown as Column<Record<string, unknown>>[]}
            data={filteredSortedClients as unknown as Record<string, unknown>[]}
            onRowClick={handleRowClick as unknown as (row: Record<string, unknown>) => void}
            loading={loading}
            searchable={false}
            exportable={false}
            paginate={false}
            getRowKey={(row) => row.id as React.Key}
          />
        </TabsContent>

        <TabsContent value="groups" className="mt-0">
          <Suspense fallback={<LazyFallback />}>
            <CustomGroupManager />
          </Suspense>
        </TabsContent>

        <TabsContent value="corporate" className="mt-0">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Building className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Corporate Clients Module</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Employee benefits and corporate scheme management is currently under development.
              </p>
              <Button variant="outline" disabled>
                Request early access <SoonBadge />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adviser" className="mt-0">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Adviser Clients</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Intermediary and adviser management portal is currently under development.
              </p>
              <Button variant="outline" disabled>
                Notify me when available <SoonBadge />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Suspense fallback={<LazyFallback />}>
        <ClientFieldRepository open={showRepository} onOpenChange={setShowRepository} />
      </Suspense>

      <Suspense fallback={<LazyFallback />}>
        <AddClientDialog
          open={showAddClient}
          onOpenChange={setShowAddClient}
          onClientAdded={refetch}
        />
      </Suspense>

      <Suspense fallback={<LazyFallback />}>
        <IntakeWizardHandoff
          handoff={intakeHandoff}
          onClose={() => setIntakeHandoff(null)}
          onFNAComplete={handleIntakeFNAPublished}
        />
      </Suspense>
    </div>
  );
}

/** Marks a tab whose feature is not switched on yet. */
function SoonTag() {
  return (
    <span className="rounded-full border border-dashed border-gray-300 px-1.5 text-[10px] font-semibold tracking-wide text-nw-text-3 uppercase">
      Soon
    </span>
  );
}
