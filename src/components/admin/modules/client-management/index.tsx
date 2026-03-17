import React, { useState, useMemo, Suspense } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { 
  Plus, 
  Filter, 
  Download,
  Users,
  Search,
  Building,
  Database,
  UserCheck,
  Ban,
  XCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { DataTable, Column } from '../../components/DataTable';
import { Client, ClientFilters } from './types';
import { useClientList } from './hooks/useClientList';
import {
  calculateGrowthStats,
  filterClients,
  generateClientCSV,
  deriveAccountStatus,
  countByStatus,
} from './utils';
import { ACCOUNT_STATUS_CONFIG, ACCOUNT_STATUS_FILTER_OPTIONS } from './constants';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';
import { useAdminNavigation } from '../../layout/AdminNavigationContext';

// Heavy sub-components — lazy-loaded (only rendered on user action)
const ClientDrawer = React.lazy(() => import('./components/ClientDrawer').then(m => ({ default: m.ClientDrawer })));
const ClientFieldRepository = React.lazy(() => import('./components/ClientFieldRepository').then(m => ({ default: m.ClientFieldRepository })));
const CustomGroupManager = React.lazy(() => import('../communication/components/CustomGroupManager').then(m => ({ default: m.CustomGroupManager })));
const AddClientDialog = React.lazy(() => import('./components/AddClientDialog').then(m => ({ default: m.AddClientDialog })));

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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRepository, setShowRepository] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientType, setClientType] = useState('personal');
  const { canDo } = useCurrentUserPermissions();
  const { pendingSelection, clearPendingSelection } = useAdminNavigation();

  // Defensive: ensure clients is always an array (§10 — never swallow errors silently)
  const safeClients = Array.isArray(clients) ? clients : [];

  // ── GlobalSearch deep-link: auto-open drawer for pending client selection ──
  React.useEffect(() => {
    if (
      pendingSelection?.type === 'client' &&
      !loading &&
      safeClients.length > 0
    ) {
      const target = safeClients.find(c => c.id === pendingSelection.id);
      if (target) {
        setSelectedClient(target);
        setDrawerOpen(true);
      }
      clearPendingSelection();
    }
  }, [pendingSelection, loading, safeClients, clearPendingSelection]);

  const canCreate = canDo('clients', 'create');
  const canExport = canDo('clients', 'export');
  const canEditClient = canDo('clients', 'edit');
  const canDeleteClient = canDo('clients', 'delete');

  const handleRowClick = (client: Client) => {
    setSelectedClient(client);
    setDrawerOpen(true);
  };

  // Filter clients using utility
  const filteredClients = filterClients(safeClients, filters);
  
  // Calculate base stats (all non-admin clients, no search applied)
  const baseClients = filterClients(safeClients, {});
  const totalStats = calculateGrowthStats(baseClients);

  // Status breakdown for stat cards
  const statusCounts = useMemo(() => countByStatus(baseClients), [baseClients]);

  // Currently active filter label for the status dropdown
  const activeStatusFilter = filters.accountStatus || 'all';
  const activeStatusLabel =
    ACCOUNT_STATUS_FILTER_OPTIONS.find(o => o.value === activeStatusFilter)?.label || 'All Statuses';

  const handleExport = () => {
    generateClientCSV(filteredClients);
  };

  // Personal clients table columns configuration
  const personalColumns: Column<Client>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      render: (_, client) => {
        const status = deriveAccountStatus(client);
        const cfg = ACCOUNT_STATUS_CONFIG[status];
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/api/placeholder/32/32`} />
                <AvatarFallback>
                  {client.firstName[0]}{client.lastName[0]}
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
              <div className="font-medium">{client.firstName} {client.lastName}</div>
              <div className="text-sm text-muted-foreground">{client.email}</div>
            </div>
          </div>
        );
      },
      width: '350px'
    },
    {
      key: 'idNumber',
      title: 'ID or Passport',
      render: (idNumber) => (
        <span className="font-mono text-sm">
          {idNumber && idNumber !== 'Not provided'
            ? `${idNumber.slice(0, 6)}***${idNumber.slice(-2)}`
            : <span className="text-muted-foreground">Not provided</span>
          }
        </span>
      ),
      width: '180px'
    },
    {
      key: 'createdAt',
      title: 'Date Joined',
      sortable: true,
      render: (date) => new Date(date).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      width: '150px'
    },
    {
      key: 'accountStatus',
      title: 'Account',
      render: (_, client) => {
        const status = deriveAccountStatus(client);
        const cfg = ACCOUNT_STATUS_CONFIG[status];
        return (
          <Badge className={cfg.badgeClass}>
            {cfg.label}
          </Badge>
        );
      },
      width: '120px'
    },
    {
      key: 'status',
      title: 'Application',
      render: (_, client) => {
        const isActive = client.applicationStatus === 'approved';
        return (
          <Badge 
            variant={isActive ? 'default' : 'secondary'}
            className={isActive ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isActive ? 'Active' : 'Application'}
          </Badge>
        );
      },
      width: '120px'
    }
  ];

  if (showGroupManager) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <Suspense fallback={<LazyFallback />}>
          <CustomGroupManager 
            onClose={() => setShowGroupManager(false)} 
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Client Management</h2>
          <p className="text-muted-foreground">
            Manage client profiles, policies, and compliance documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGroupManager(true)}>
            <Users className="mr-2 h-4 w-4" />
            Manage Groups
          </Button>
          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowAddClient(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <div className="rounded-md bg-gray-50 p-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{baseClients.length}</div>
            <p className="text-xs text-muted-foreground">
              +{totalStats.growthRate}% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="rounded-md bg-green-50 p-1.5">
              <UserCheck className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.active}</div>
            <p className="text-xs text-muted-foreground">
              Active individual portfolios
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <div className="rounded-md bg-amber-50 p-1.5">
              <Ban className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.suspended}</div>
            <p className="text-xs text-muted-foreground">
              Accounts temporarily suspended
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <div className="rounded-md bg-red-50 p-1.5">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.closed}</div>
            <p className="text-xs text-muted-foreground">
              Soft-deleted or closed accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MAIN TABS */}
      <Tabs value={clientType} onValueChange={setClientType} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal Clients</TabsTrigger>
          <TabsTrigger value="corporate">Corporate Clients</TabsTrigger>
          <TabsTrigger value="adviser">Adviser Clients</TabsTrigger>
        </TabsList>

        {/* Filter bar */}
        <div className="flex items-center gap-2 my-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              className="pl-8"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
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
                {ACCOUNT_STATUS_FILTER_OPTIONS.map(opt => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowRepository(true)}
            title="Field Repository"
            aria-label="Field Repository"
          >
            <Database className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        
        <TabsContent value="personal" className="space-y-4">
          <DataTable 
            columns={personalColumns} 
            data={filteredClients} 
            onRowClick={handleRowClick}
            loading={loading}
            searchable={false}
            exportable={false}
          />
        </TabsContent>
        
        <TabsContent value="corporate">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Building className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Corporate Clients Module</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Employee benefits and corporate scheme management is currently under development.
              </p>
              <Button variant="outline">Request Early Access</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="adviser">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Adviser Clients</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Intermediary and adviser management portal is currently under development.
              </p>
              <Button variant="outline">Notify Me When Available</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Suspense fallback={<LazyFallback />}>
        <ClientDrawer 
          client={selectedClient}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          canEdit={canEditClient}
          canDelete={canDeleteClient}
        />
      </Suspense>
      
      <Suspense fallback={<LazyFallback />}>
        <ClientFieldRepository 
          open={showRepository}
          onOpenChange={setShowRepository}
        />
      </Suspense>
      
      <Suspense fallback={<LazyFallback />}>
        <AddClientDialog 
          open={showAddClient}
          onOpenChange={setShowAddClient}
          onClientAdded={refetch}
        />
      </Suspense>

    </div>
  );
}