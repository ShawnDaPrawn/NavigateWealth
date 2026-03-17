import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Skeleton } from '../../../ui/skeleton';
import {
  Plus,
  Users,
  UserCheck,
  UserX,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { Personnel, UserRole } from './types';
import type { InviteUserFormValues } from './schema';
import type { AdminModule } from '../../layout/types';

// Components
import { PersonnelTable } from './components/PersonnelTable';
import { PersonnelFilters } from './components/PersonnelFilters';
import { InviteUserDialog } from './components/InviteUserDialog';
import { PersonnelDrawer } from './components/drawer/PersonnelDrawer';
import { SuperAdminProfileCard } from './components/SuperAdminProfileCard';

// Hooks
import { usePersonnel, useSuperAdmin, usePersonnelClients, useInvitePersonnel, useCreatePersonnelAccount, useUpdatePersonnel, useUpdateSuperAdmin } from './hooks';
import { usePersonnelFilters } from './hooks/usePersonnelFilters';
import { useCurrentUserPermissions } from './hooks/usePermissions';
import { useAdminNavigation } from '../../layout/AdminNavigationContext';

// Constants
import { ROLE_LABELS, ROLE_COLORS } from './constants';

// ============================================================================
// STAT CARD (inline)
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, subtitle }: StatCardProps) {
  return (
    <Card className="border border-gray-200/80 shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold text-gray-900 leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
            className={cn(
              'flex items-center gap-4 px-6 py-4',
              i < 4 && 'border-b border-gray-100'
            )}
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

  // ── GlobalSearch deep-link: auto-open drawer for pending personnel selection ──
  useEffect(() => {
    if (
      pendingSelection?.type === 'personnel' &&
      !isLoading &&
      personnel.length > 0
    ) {
      const target = personnel.find(p => p.id === pendingSelection.id);
      if (target) {
        setSelectedPersonnel(target);
        setActiveTab('profile');
        setDrawerOpen(true);
      }
      clearPendingSelection();
    }
  }, [pendingSelection, isLoading, personnel, clearPendingSelection]);

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
    const active = personnel.filter(p => p.status === 'active').length;
    const suspended = personnel.filter(p => p.status === 'suspended').length;
    const pending = personnel.filter(p => p.status === 'pending').length;
    return { total, active, suspended, pending };
  }, [personnel]);

  // 4. Sub-resource Data (Clients) - Only fetch when needed
  const clientsEnabled = drawerOpen && activeTab === 'clients' && !!selectedPersonnel?.id;
  const {
    data: clients = [],
    isLoading: clientsLoading,
  } = usePersonnelClients(selectedPersonnel?.id || '', clientsEnabled);

  // 5. Mutations
  const { mutate: inviteUser } = useInvitePersonnel();
  const { mutateAsync: createAccount } = useCreatePersonnelAccount();
  const { mutate: updateUser } = useUpdatePersonnel();
  const { mutate: updateSuperAdmin } = useUpdateSuperAdmin();

  // Handlers
  const handleRowClick = (person: Personnel) => {
    setSelectedPersonnel(person);
    setActiveTab('profile');
    setDrawerOpen(true);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleUpdateProfile = async (id: string, data: Partial<Personnel>) => {
    updateUser(
      { id, ...data },
      {
        onSuccess: () => {
          setSelectedPersonnel(prev => (prev ? { ...prev, ...data } : null));
        },
      }
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
        }
      );
    });
  };

  const handleCreateAccount = async (
    values: InviteUserFormValues
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
    {} as Record<string, { label: string; color: string }>
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight leading-none">
                Personnel Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage staff access, compliance, and commission structures
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Super admin toggle (only show for super admins) */}
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-purple-700 border-purple-200 hover:bg-purple-50"
              onClick={() => setShowSuperAdmin(!showSuperAdmin)}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admin Profile</span>
              {showSuperAdmin ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {canInvite && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              size="sm"
              className="gap-2 bg-purple-600 hover:bg-purple-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Invite User
            </Button>
          )}
        </div>
      </div>

      {/* ── Super Admin Profile (Collapsible) ─────────────────── */}
      {isSuperAdmin && showSuperAdmin && (
        <SuperAdminProfileCard
          profile={superAdminProfile}
          loading={superAdminLoading}
          onUpdate={updateSuperAdmin}
        />
      )}

      {/* ── Stat Cards ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-gray-200/80 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-6 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Personnel"
            value={stats.total}
            icon={Users}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={UserCheck}
            iconColor="text-green-600"
            iconBg="bg-green-50"
          />
          <StatCard
            label="Suspended"
            value={stats.suspended}
            icon={UserX}
            iconColor="text-red-600"
            iconBg="bg-red-50"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>
      )}

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
              {personnel.length === 0
                ? 'No personnel yet'
                : 'No results found'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {personnel.length === 0
                ? 'Get started by inviting your first team member.'
                : 'Try adjusting your search or filters to find what you\'re looking for.'}
            </p>
            {personnel.length === 0 && canInvite && (
              <Button
                size="sm"
                className="mt-4 gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => setInviteDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Invite User
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
                Clear Filters
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

      {/* Drawer */}
      <PersonnelDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        selectedPersonnel={selectedPersonnel}
        clients={clients}
        clientsLoading={clientsLoading}
        onTabChange={handleTabChange}
        onUpload={handleFileUpload}
        onUpdate={handleUpdateProfile}
        onInviteCancelled={() => {
          setDrawerOpen(false);
          setSelectedPersonnel(null);
        }}
      />

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={handleInvite}
        onCreateAccount={handleCreateAccount}
      />
    </div>
  );
}