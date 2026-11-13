import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Skeleton } from '../../../ui/skeleton';
import { Plus, Users, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Personnel, type SuperAdminProfile } from './types';
import type { InviteUserFormValues } from './schema';
import type { AdminModule } from '../../layout/types';
import { PageHeader, StatCard, useRecordInUrl } from '../../layout/page';

// Components
import { PersonnelTable } from './components/PersonnelTable';
import { PersonnelFilters } from './components/PersonnelFilters';
import { InviteUserDialog } from './components/InviteUserDialog';
import { PersonnelDrawer } from './components/drawer/PersonnelDrawer';
import { SuperAdminProfileCard } from './components/SuperAdminProfileCard';

// Hooks
import {
  usePersonnel,
  useSuperAdmin,
  usePersonnelClients,
  useInvitePersonnel,
  useCreatePersonnelAccount,
  useUpdatePersonnel,
  useUpdateSuperAdmin,
} from './hooks';
import { usePersonnelFilters } from './hooks/usePersonnelFilters';
import { useCurrentUserPermissions } from './hooks/usePermissions';
import { useAdminNavigation } from '../../layout/AdminNavigationContext';

// Constants
import { ROLE_LABELS, ROLE_COLORS } from './constants';

// ============================================================================
// SKELETON TABLE ROWS
// ============================================================================

function TableSkeleton() {
  return (
    <Card className="border border-gray-200/80 shadow-none">
      <CardContent className="p-0">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 px-6 py-3 border-b bg-gray-50/50">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn('flex items-center gap-4 px-6 py-4', i < 4 && 'border-b border-gray-100')}
          >
            <div className="flex items-center gap-3 w-60">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN MODULE
// ============================================================================

export function PersonnelModule() {
  // 1. Data & State
  const { data: personnel = [], isLoading } = usePersonnel();
  const { data: superAdminProfile, isLoading: superAdminLoading } = useSuperAdmin();
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const { canDo, isSuperAdmin } = useCurrentUserPermissions();
  const { pendingSelection, clearPendingSelection } = useAdminNavigation();

  // Auto-expand super admin card when user is super admin
  useEffect(() => {
    if (isSuperAdmin) {
      setShowSuperAdmin(true);
    }
  }, [isSuperAdmin]);

  // The staff member most recently asked for (row, search, address). The
  // address sync must not close one opened in the same update.
  const lastOpenedIdRef = useRef<string | null>(null);
  const showPerson = useCallback((person: Personnel) => {
    lastOpenedIdRef.current = person.id;
    setSelectedPersonnel(person);
    setActiveTab('profile');
    setDrawerOpen(true);
  }, []);

  // ── GlobalSearch deep-link: auto-open drawer for pending personnel selection ──
  useEffect(() => {
    if (pendingSelection?.type === 'personnel' && !isLoading && personnel.length > 0) {
      const target = personnel.find((p) => p.id === pendingSelection.id);
      if (target) showPerson(target);
      clearPendingSelection();
    }
  }, [pendingSelection, isLoading, personnel, clearPendingSelection, showPerson]);

  // An open staff member is a page with its own address (?person=<id>).
  useRecordInUrl('person', drawerOpen && selectedPersonnel ? selectedPersonnel.id : null, {
    ready: !isLoading && personnel.length > 0,
    openFromUrl: (id) => {
      if (isLoading || personnel.length === 0) return 'waiting';
      const target = personnel.find((p) => p.id === id);
      if (!target) {
        toast.error('Staff member not found');
        return 'missing';
      }
      showPerson(target);
      return 'opened';
    },
    closeFromUrl: (previousId) => {
      if (lastOpenedIdRef.current && lastOpenedIdRef.current !== previousId) return;
      setDrawerOpen(false);
    },
  });

  const canInvite = canDo('personnel', 'create');

  // 2. Derived State (Filtering)
  const {
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    statusFilter,
    setStatusFilter,
    filteredPersonnel,
  } = usePersonnelFilters(personnel);

  // 3. Stats
  const stats = useMemo(() => {
    const total = personnel.length;
    const active = personnel.filter((p) => p.status === 'active').length;
    const suspended = personnel.filter((p) => p.status === 'suspended').length;
    const pending = personnel.filter((p) => p.status === 'pending').length;
    return { total, active, suspended, pending };
  }, [personnel]);

  // 4. Sub-resource Data (Clients) - Only fetch when needed
  const clientsEnabled = drawerOpen && activeTab === 'clients' && !!selectedPersonnel?.id;
  const { data: clients = [], isLoading: clientsLoading } = usePersonnelClients(
    selectedPersonnel?.id || '',
    clientsEnabled,
  );

  // 5. Mutations
  const { mutate: inviteUser } = useInvitePersonnel();
  const { mutateAsync: createAccount } = useCreatePersonnelAccount();
  const { mutate: updateUser } = useUpdatePersonnel();
  const { mutate: updateSuperAdmin } = useUpdateSuperAdmin();

  // Handlers
  const handleRowClick = (person: Personnel) => showPerson(person);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleUpdateProfile = async (id: string, data: Partial<Personnel>) => {
    updateUser(
      { id, ...data },
      {
        onSuccess: () => {
          setSelectedPersonnel((prev) => (prev ? { ...prev, ...data } : null));
        },
      },
    );
  };

  const handleInvite = async (values: InviteUserFormValues): Promise<boolean> => {
    return new Promise((resolve) => {
      const { moduleAccess, ...inviteValues } = values;
      inviteUser(
        { ...inviteValues, initialModuleAccess: moduleAccess as AdminModule[] | undefined },
        {
          onSuccess: () => {
            resolve(true);
          },
          onError: () => {
            resolve(false);
          },
        },
      );
    });
  };

  const handleCreateAccount = async (
    values: InviteUserFormValues,
  ): Promise<{ recoveryLink: string | null } | false> => {
    try {
      const { moduleAccess, ...createValues } = values;
      const result = await createAccount({
        ...createValues,
        initialModuleAccess: moduleAccess as AdminModule[] | undefined,
      });
      return { recoveryLink: result.recoveryLink };
    } catch {
      return false;
    }
  };

  const handleFileUpload = async (type: string) => {
    if (!selectedPersonnel) return;
    toast.info(`File upload for ${type} is coming soon`);
  };

  // Prepare roles object for backward compatibility
  const PERSONNEL_ROLES = Object.entries(ROLE_LABELS).reduce(
    (acc, [key, label]) => {
      acc[key as keyof typeof ROLE_LABELS] = {
        label,
        color: ROLE_COLORS[key as keyof typeof ROLE_COLORS],
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  );

  // Dialogs opened from the module itself; they render in list and page mode.
  const dialogs = (
    <InviteUserDialog
      open={inviteDialogOpen}
      onOpenChange={setInviteDialogOpen}
      onInvite={handleInvite}
      onCreateAccount={handleCreateAccount}
    />
  );

  // A staff member is open: their page replaces the list.
  if (drawerOpen && selectedPersonnel) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <PersonnelDrawer
          key={selectedPersonnel.id}
          open
          onOpenChange={setDrawerOpen}
          selectedPersonnel={selectedPersonnel}
          activeTab={activeTab}
          clients={clients}
          clientsLoading={clientsLoading}
          onTabChange={handleTabChange}
          onUpload={handleFileUpload}
          onUpdate={
            handleUpdateProfile as unknown as (
              id: string,
              data: Partial<Personnel>,
            ) => Promise<boolean>
          }
          onInviteCancelled={() => {
            setDrawerOpen(false);
            setSelectedPersonnel(null);
          }}
        />
        {dialogs}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Personnel"
        description="Staff access, compliance and commission structures."
        actions={
          <>
            {isSuperAdmin && (
              <Button variant="outline" onClick={() => setShowSuperAdmin(!showSuperAdmin)}>
                <Shield className="h-4 w-4" aria-hidden="true" />
                Admin profile
                {showSuperAdmin ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}
            {canInvite && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Invite user
              </Button>
            )}
          </>
        }
      />

      {/* ── Super Admin Profile (Collapsible) ─────────────────── */}
      {isSuperAdmin && showSuperAdmin && (
        <SuperAdminProfileCard
          profile={superAdminProfile ?? null}
          loading={superAdminLoading}
          onUpdate={
            updateSuperAdmin as unknown as (updates: Partial<SuperAdminProfile>) => Promise<boolean>
          }
        />
      )}

      {/* ── Figures ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total personnel" value={isLoading ? '—' : stats.total} />
        <StatCard label="Active" value={isLoading ? '—' : stats.active} />
        <StatCard label="Suspended" value={isLoading ? '—' : stats.suspended} />
        <StatCard label="Pending" value={isLoading ? '—' : stats.pending} />
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <PersonnelFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        roles={PERSONNEL_ROLES}
        totalCount={personnel.length}
        filteredCount={filteredPersonnel.length}
      />

      {/* ── Data Table ────────────────────────────────────────── */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredPersonnel.length === 0 ? (
        <Card className="border border-gray-200/80 shadow-none">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-100 mb-4">
              <Users className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {personnel.length === 0 ? 'No personnel yet' : 'No results found'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {personnel.length === 0
                ? 'Get started by inviting your first team member.'
                : "Try adjusting your search or filters to find what you're looking for."}
            </p>
            {personnel.length === 0 && canInvite && (
              <Button
                size="sm"
                className="mt-4 gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => setInviteDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Invite user
              </Button>
            )}
            {personnel.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('all');
                  setStatusFilter('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <PersonnelTable
          data={filteredPersonnel}
          onRowClick={handleRowClick}
          roles={PERSONNEL_ROLES}
        />
      )}

      {dialogs}
    </div>
  );
}
