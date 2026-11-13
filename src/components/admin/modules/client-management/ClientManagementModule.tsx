import React, { useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { Card, CardContent } from '../../../ui/card';
import {
  PageHeader,
  ErrorState,
  NavTabsList,
  NavTabsTrigger,
  useUrlState,
  useRecordInUrl,
  SoonBadge,
} from '../../layout/page';
import {
  Plus,
  ChevronLeft,
  Download,
  Users,
  Search,
  Building,
  Database,
  FileSpreadsheet,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ACCOUNT_STATUS_CONFIG, CONFIG } from './constants';
import { FilterStatCard, FilterChipMenu } from './components/ListFilters';
import { Crumbs } from './components/Crumbs';
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
const ClientGroupsTab = React.lazy(() =>
  import('./components/groups/ClientGroupsTab').then((m) => ({ default: m.ClientGroupsTab })),
);
const GroupEditorRoute = React.lazy(() =>
  import('./components/groups/GroupEditorRoute').then((m) => ({ default: m.GroupEditorRoute })),
);

const ClientFieldRepository = React.lazy(() =>
  import('./components/ClientFieldRepository').then((m) => ({ default: m.ClientFieldRepository })),
);
const AddClientPage = React.lazy(() =>
  import('./components/AddClientPage').then((m) => ({ default: m.AddClientPage })),
);
const FNAIntakeQueue = React.lazy(() =>
  import('./components/FNAIntakeQueue').then((m) => ({ default: m.FNAIntakeQueue })),
);
const IntakeWizardHandoff = React.lazy(() =>
  import('./components/IntakeWizardHandoff').then((m) => ({ default: m.IntakeWizardHandoff })),
);

const CLIENT_TABS = ['personal', 'groups', 'corporate', 'adviser'] as const;
const TAB_LABELS: Record<(typeof CLIENT_TABS)[number], string> = {
  personal: 'Personal clients',
  groups: 'Groups',
  corporate: 'Corporate clients',
  adviser: 'Adviser clients',
};
const ACCOUNT_FILTERS = ['all', 'active', 'suspended', 'closed'] as const;
type AccountFilter = (typeof ACCOUNT_FILTERS)[number];
const ACCOUNT_LABELS: Record<AccountFilter, string> = {
  all: 'All',
  active: 'Active',
  suspended: 'Suspended',
  closed: 'Closed',
};
const APPLICATION_FILTERS = ['all', 'approved', 'pending'] as const;
type ApplicationFilter = (typeof APPLICATION_FILTERS)[number];
const APPLICATION_LABELS: Record<ApplicationFilter, string> = {
  all: 'All',
  approved: 'Active',
  pending: 'In application',
};
const ADD_VIEWS = ['', 'single', 'bulk'] as const;
type AddParam = (typeof ADD_VIEWS)[number];

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
  const [searchParams, setSearchParams] = useSearchParams();
  // Search, account and application filters live in the address (?q=, ?account=, ?application=).
  const search = searchParams.get('q') ?? '';
  const setSearch = useCallback(
    (next: string) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next) params.set('q', next);
          else params.delete('q');
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const [accountFilter, setAccountFilter] = useUrlState<AccountFilter>(
    'account',
    'all',
    ACCOUNT_FILTERS,
  );
  const [applicationFilter, setApplicationFilter] = useUrlState<ApplicationFilter>(
    'application',
    'all',
    APPLICATION_FILTERS,
  );
  const filters: ClientFilters = useMemo(
    () => ({ search, accountStatus: accountFilter }),
    [search, accountFilter],
  );
  // Add client is a page of its own (?add=single|bulk). Opening it is a new
  // history entry so Back returns to the list; switching views replaces it.
  const [addView, setAddView] = useUrlState<AddParam>('add', '', ADD_VIEWS);
  const openAddClient = (view: 'single' | 'bulk') =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('add', view);
      return params;
    });
  // A group being created or edited is a page of its own (?group=<id|new>).
  const openGroupId = searchParams.get('group');
  const openGroup = (id: string) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('group', id);
      return params;
    });
  const closeGroup = () =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete('group');
        params.delete('gview');
        return params;
      },
      { replace: true },
    );
  const [blockSearchAutofill, setBlockSearchAutofill] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRepository, setShowRepository] = useState(false);
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
  // A client named in the address that is not in the list: an error page.
  const [missingClientId, setMissingClientId] = useState<string | null>(null);
  const showClient = useCallback((target: Client) => {
    lastOpenedIdRef.current = target.id;
    setMissingClientId(null);
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
        setMissingClientId(id);
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
    const filtered = filterClients(safeClients, filters).filter((c) => {
      if (applicationFilter === 'all') return true;
      const approved = c.applicationStatus === 'approved';
      return applicationFilter === 'approved' ? approved : !approved;
    });
    return [...filtered].sort((a, b) => {
      const fn = (a.firstName || '').trim().localeCompare((b.firstName || '').trim(), 'en-ZA', {
        sensitivity: 'base',
      });
      if (fn !== 0) return fn;
      return (a.lastName || '').trim().localeCompare((b.lastName || '').trim(), 'en-ZA', {
        sensitivity: 'base',
      });
    });
  }, [safeClients, filters, applicationFilter]);

  const baseClients = filterClients(safeClients, {});
  const totalStats = calculateGrowthStats(baseClients);

  // Status breakdown for stat cards
  const statusCounts = useMemo(() => countByStatus(baseClients), [baseClients]);

  const anyFilter = accountFilter !== 'all' || applicationFilter !== 'all' || search !== '';
  const clearFilters = () =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        ['q', 'account', 'application'].forEach((k) => params.delete(k));
        return params;
      },
      { replace: true },
    );
  // A stat card filters the table; clicking the active one clears it.
  const toggleAccount = (value: AccountFilter) =>
    setAccountFilter(accountFilter === value ? 'all' : value);

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
      title: 'ID or passport',
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
      title: 'Date joined',
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

  if (missingClientId) {
    const retry = async () => {
      const id = missingClientId;
      await refetch();
      setMissingClientId(null);
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('client', id);
        return params;
      });
    };
    return (
      <div className="flex flex-col gap-4 p-6 lg:p-8">
        <Crumbs
          trail={[
            { label: 'Personal clients', onClick: () => setMissingClientId(null) },
            { label: 'Client not found' },
          ]}
        />
        <button
          type="button"
          onClick={() => setMissingClientId(null)}
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Personal clients
        </button>
        <ErrorState
          title="This client could not be opened"
          description="It may have been deleted, or the link may be wrong."
          onRetry={() => void retry()}
          secondaryAction={
            <Button variant="outline" onClick={() => setMissingClientId(null)}>
              Back to clients
            </Button>
          }
        />
      </div>
    );
  }

  // Create / edit group is a page of its own.
  if (clientType === 'groups' && openGroupId) {
    return (
      <div className="p-6 lg:p-8">
        <Suspense fallback={<LazyFallback />}>
          <GroupEditorRoute groupId={openGroupId} onClose={closeGroup} />
        </Suspense>
      </div>
    );
  }

  // Add client is a page of its own.
  if (addView && canCreate) {
    return (
      <div className="p-6 lg:p-8">
        <Crumbs
          trail={[
            { label: 'Personal clients', onClick: () => setAddView('') },
            { label: addView === 'bulk' ? 'Bulk import' : 'Add client' },
          ]}
        />
        <Suspense fallback={<LazyFallback />}>
          <AddClientPage
            view={addView}
            onViewChange={setAddView}
            onClose={() => setAddView('')}
            onClientAdded={refetch}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Crumbs trail={[{ label: TAB_LABELS[clientType] }]} />
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
                {canCreate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openAddClient('bulk')}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                      Bulk import clients
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreate && (
              <Button onClick={() => openAddClient('single')}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add client
              </Button>
            )}
          </>
        }
      />

      {/* MAIN TABS */}
      <Tabs
        value={clientType}
        onValueChange={(v) => setClientType(v as (typeof CLIENT_TABS)[number])}
        className="gap-5"
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

        <TabsContent value="personal" className="mt-0 flex flex-col gap-4">
          {/* Attention banner: FNA intakes waiting for review (hidden when none). */}
          <Suspense fallback={null}>
            <FNAIntakeQueue
              onOpenClient={(clientId) => {
                const match = safeClients.find((c) => c.id === clientId);
                if (match) openClientDrawer(match);
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

          {/* The four figures filter the table (synced with the Account chip). */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Filter by account">
            <FilterStatCard
              label="All clients"
              value={baseClients.length}
              meta={`+${totalStats.growthRate}% vs last month`}
              active={accountFilter === 'all'}
              onClick={() => setAccountFilter('all')}
            />
            <FilterStatCard
              label="Active"
              value={statusCounts.active}
              meta="Active individual portfolios"
              active={accountFilter === 'active'}
              onClick={() => toggleAccount('active')}
            />
            <FilterStatCard
              label="Suspended"
              value={statusCounts.suspended}
              meta="Access temporarily suspended"
              tone={statusCounts.suspended > 0 ? 'attention' : 'default'}
              active={accountFilter === 'suspended'}
              onClick={() => toggleAccount('suspended')}
            />
            <FilterStatCard
              label="Closed"
              value={statusCounts.closed}
              meta="Soft-deleted or closed accounts"
              active={accountFilter === 'closed'}
              onClick={() => toggleAccount('closed')}
            />
          </div>

          <section
            aria-label="Personal clients"
            className="overflow-hidden rounded-xl border border-nw-line bg-white"
          >
            {/* Toolbar: search + filter chips */}
            <div className="flex flex-wrap items-center gap-2 border-b border-nw-line-2 px-4 py-3">
              <div className="relative w-full max-w-sm">
                <Search
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search name, email or ID"
                  aria-label="Search clients"
                  className="pl-8"
                  value={search}
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
                  aria-expanded={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setBlockSearchAutofill(false)}
                />
              </div>
              <FilterChipMenu
                field="Account"
                value={accountFilter}
                labels={ACCOUNT_LABELS}
                onChange={setAccountFilter}
              />
              <FilterChipMenu
                field="Application"
                value={applicationFilter}
                labels={APPLICATION_LABELS}
                onChange={setApplicationFilter}
              />
              {anyFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              <span className="ml-auto text-sm text-nw-text-3">
                {filteredSortedClients.length.toLocaleString()}{' '}
                {filteredSortedClients.length === 1 ? 'client' : 'clients'} · A–Z by first name
              </span>
            </div>
            <DataTable
              columns={personalColumns as unknown as Column<Record<string, unknown>>[]}
              data={filteredSortedClients as unknown as Record<string, unknown>[]}
              onRowClick={handleRowClick as unknown as (row: Record<string, unknown>) => void}
              loading={loading}
              searchable={false}
              exportable={false}
              pageSize={25}
              getRowKey={(row) => row.id as React.Key}
              emptyState={
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-nw-ink">No clients match</p>
                  {anyFilter && (
                    <Button variant="link" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="groups" className="mt-0">
          <Suspense fallback={<LazyFallback />}>
            <ClientGroupsTab onOpenGroup={openGroup} />
          </Suspense>
        </TabsContent>

        <TabsContent value="corporate" className="mt-0">
          <ComingSoonCard
            icon={Building}
            title="Corporate clients"
            text="Employee benefits and corporate scheme management is currently under development."
            action="Request early access"
          />
        </TabsContent>

        <TabsContent value="adviser" className="mt-0">
          <ComingSoonCard
            icon={Users}
            title="Adviser clients"
            text="The intermediary and adviser management portal is currently under development."
            action="Notify me when available"
          />
        </TabsContent>
      </Tabs>

      <Suspense fallback={<LazyFallback />}>
        <ClientFieldRepository open={showRepository} onOpenChange={setShowRepository} />
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

function ComingSoonCard({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  action: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Icon className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-medium text-nw-ink">{title}</h2>
        <p className="mb-4 max-w-sm text-sm text-nw-text-3">{text}</p>
        <Button variant="outline" disabled>
          {action} <SoonBadge />
        </Button>
      </CardContent>
    </Card>
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
