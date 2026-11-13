import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Skeleton } from '../../../ui/skeleton';
import { Plus, Users, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Personnel, type SuperAdminProfile } from './types';
import type { InviteUserFormValues } from './schema';
import type { AdminModule } from '../../layout/types';
import {
  PageHeader,
  StatCard,
  useBreadcrumbTrail,
  useRecordInUrl,
  useUrlState,
} from '../../layout/page';

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
import { usePersonnelFilters, type PersonnelStatusFilter } from './hooks/usePersonnelFilters';
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

/** The staff member page's tabs; the open one is in the address (?personTab=). */
const PERSON_TABS = ['profile', 'permissions', 'compliance', 'commission', 'clients'] as const;
const PROFILE_VIEWS = ['', 'me'] as const;

const PERSON_TAB_LABELS: Record<PersonTab, string> = {
  profile: 'Profile',
  permissions: 'Permissions',
  compliance: 'Compliance',
  commission: 'Commission',
  clients: 'Client book',
};
type PersonTab = (typeof PERSON_TABS)[number];

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
  const [activeTab, setActiveTabInUrl] = useUrlState<PersonTab>(
    'personTab',
    'profile',
    PERSON_TABS,
  );
  // Writing the same value again would still navigate; skip it.
  const setActiveTab = useCallback(
    (next: PersonTab) => {
      if (next !== activeTab) setActiveTabInUrl(next);
    },
    [activeTab, setActiveTabInUrl],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    canDo,
    isSuperAdmin,
    permissions: myPermissions,
    isLoading: myPermissionsLoading,
  } = useCurrentUserPermissions();
  const { pendingSelection, clearPendingSelection } = useAdminNavigation();

  // "Admin profile" (the account menu's Account settings) is in the address:
  // ?profile=me. The super admin sees their profile card above the list.
  const [profileView, setProfileView] = useUrlState<'' | 'me'>('profile', '', PROFILE_VIEWS);
  const showSuperAdmin = profileView === 'me' && isSuperAdmin;

  // Anyone else asking for their own profile gets their own staff page.
  useEffect(() => {
    if (profileView !== 'me' || myPermissionsLoading || !myPermissions || isSuperAdmin) return;
    if (isLoading) return;
    const selfId = myPermissions.personnelId;
    const self = selfId ? personnel.find((p) => p.id === selfId) : undefined;
    if (!self) toast.error('Your staff profile was not found');
    // One address change: drop ?profile and name the staff member.
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete('profile');
        if (self) params.set('person', self.id);
        return params;
      },
      { replace: true },
    );
  }, [
    profileView,
    myPermissions,
    myPermissionsLoading,
    isSuperAdmin,
    isLoading,
    personnel,
    setSearchParams,
  ]);

  // The staff member most recently asked for (row, search, address). The
  // address sync must not close one opened in the same update.
  const lastOpenedIdRef = useRef<string | null>(null);
  const showPerson = useCallback(
    (person: Personnel, { keepTab = false }: { keepTab?: boolean } = {}) => {
      lastOpenedIdRef.current = person.id;
      setSelectedPersonnel(person);
      if (!keepTab) setActiveTab('profile');
      setDrawerOpen(true);
    },
    [setActiveTab],
  );

  // Back to the list: the tab goes with the staff member, in one address
  // change. The address then closes the page (closeFromUrl below); closing
  // it here as well would let the record sync write the address again from
  // the old one and bring the tab back.
  const closePerson = useCallback(() => {
    if (!searchParams.has('person')) {
      setDrawerOpen(false);
      return;
    }
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete('person');
      params.delete('personTab');
      return params;
    });
  }, [searchParams, setSearchParams]);

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
      // A pasted link keeps its tab (?person=…&personTab=clients).
      showPerson(target, { keepTab: true });
      return 'opened';
    },
    closeFromUrl: (previousId) => {
      if (lastOpenedIdRef.current && lastOpenedIdRef.current !== previousId) return;
      setDrawerOpen(false);
    },
  });

  // Top-bar breadcrumb: Personnel / <name> / <tab>, or Personnel / Admin profile (/ Edit).
  const [editingAdminProfile, setEditingAdminProfile] = useState(false);
  const openPerson = drawerOpen ? selectedPersonnel : null;
  useBreadcrumbTrail(
    openPerson
      ? [
          {
            label: `${openPerson.firstName} ${openPerson.lastName}`.trim() || openPerson.email,
            onClick: () => setActiveTab('profile'),
          },
          { label: PERSON_TAB_LABELS[activeTab] },
        ]
      : showSuperAdmin
        ? editingAdminProfile
          ? [{ label: 'Admin profile' }, { label: 'Edit' }]
          : [{ label: 'Admin profile' }]
        : [],
  );

  const canInvite = canDo('personnel', 'create');

  // 2. Derived State (Filtering)
  const {
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    statusFilter,
    setStatusFilter,
    clearFilters,
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
  const { mutateAsync: updateUser } = useUpdatePersonnel();
  const { mutateAsync: updateSuperAdmin } = useUpdateSuperAdmin();

  // Handlers
  const handleRowClick = (person: Personnel) => showPerson(person);

  const handleTabChange = (value: string) => {
    if ((PERSON_TABS as readonly string[]).includes(value)) setActiveTab(value as PersonTab);
  };

  // The mutation shows the success / error toast; this reports the outcome.
  const handleUpdateProfile = async (id: string, data: Partial<Personnel>): Promise<boolean> => {
    try {
      await updateUser({ id, ...data });
      setSelectedPersonnel((prev) => (prev ? { ...prev, ...data } : null));
      return true;
    } catch {
      return false;
    }
  };

  const handleUpdateSuperAdmin = async (updates: Partial<SuperAdminProfile>): Promise<boolean> => {
    try {
      await updateSuperAdmin(updates);
      return true;
    } catch {
      return false;
    }
  };

  // Stat tiles filter the list; the active one clears it again.
  const statusTile = (status: PersonnelStatusFilter, label: string, value: number) => {
    const active = statusFilter === status;
    return (
      <button
        key={status}
        type="button"
        aria-pressed={active}
        onClick={() => setStatusFilter(active && status !== 'all' ? 'all' : status)}
        className={cn(
          'rounded-xl text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
          active && status !== 'all' && 'ring-2 ring-nw-violet',
        )}
      >
        <StatCard label={label} value={isLoading ? '—' : value} />
      </button>
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
          onOpenChange={(open) => {
            if (!open) closePerson();
          }}
          selectedPersonnel={selectedPersonnel}
          activeTab={activeTab}
          clients={clients}
          clientsLoading={clientsLoading}
          onTabChange={handleTabChange}
          onUpdate={handleUpdateProfile}
          onInviteCancelled={() => {
            closePerson();
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
        description="Manage staff access, compliance and commission structures."
        actions={
          <>
            {isSuperAdmin && (
              <Button
                variant="outline"
                aria-pressed={showSuperAdmin}
                onClick={() => setProfileView(showSuperAdmin ? '' : 'me')}
              >
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
          onUpdate={handleUpdateSuperAdmin}
          onEditingChange={setEditingAdminProfile}
        />
      )}

      {/* ── Figures ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statusTile('all', 'Total personnel', stats.total)}
        {statusTile('active', 'Active', stats.active)}
        {statusTile('suspended', 'Suspended', stats.suspended)}
        {statusTile('pending', 'Pending', stats.pending)}
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <PersonnelFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onClearFilters={clearFilters}
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
              {personnel.length === 0 ? 'No personnel yet' : 'No personnel match your filters'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {personnel.length === 0
                ? 'Get started by inviting your first team member.'
                : 'Change the search, status or role to see more people.'}
            </p>
            {personnel.length === 0 && canInvite && (
              <Button size="sm" className="mt-4 gap-2" onClick={() => setInviteDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Invite user
              </Button>
            )}
            {personnel.length > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
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
