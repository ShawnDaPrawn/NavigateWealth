import { useState } from 'react';
import {
  Settings,
  LogOut,
  ArrowLeftRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../ui/utils';
import { Logo } from '../../layout/Logo';
import { AdminModule, PendingCounts } from './types';
import {
  alwaysShowCounterModules,
  formatSidebarBadgeCount,
  formatPendingSummary,
  formatRole,
  moduleConfig,
  operationsModules,
  sidebarFooterModules,
  sidebarGroups,
  sidebarHomeModules,
} from './config';
import { useAuth } from '../../auth/AuthContext';
import { useCurrentUserPermissions } from '../modules/personnel/shell';
import { preloadAdminModule } from '../moduleLoaders';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { InstallAppMenuItem } from './InstallAppMenuItem';
import { InstallHelpDialog } from './InstallHelpDialog';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { readClosedGroups, writeClosedGroups } from './sidebarState';

interface SidebarProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  pendingCounts: PendingCounts;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

type SidebarUser = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
} | null;

export function Sidebar({
  activeModule,
  onModuleChange,
  pendingCounts,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { installApp, isInstalling, showInstallOption } = usePWAInstall();

  const isSuperAdmin = user?.role === 'super_admin';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('You have been successfully logged out');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

  const handleSwitchToPersonal = () => {
    toast.success('Switching to client view…');
    navigate('/dashboard');
  };

  const shared = {
    activeModule,
    onModuleChange,
    pendingCounts,
    setCollapsed,
    setMobileOpen,
    user: user as unknown as SidebarUser,
    onLogout: handleLogout,
    onSwitchToPersonal: handleSwitchToPersonal,
    onInstallApp: installApp,
    installOptionVisible: showInstallOption,
    isInstallingApp: isInstalling,
    onShowInstallHelp: () => setShowInstallHelp(true),
    // Account settings is the signed-in admin's own profile in Personnel.
    onOpenAccountSettings: () => {
      navigate('/admin?module=personnel&profile=me');
    },
    isSuperAdmin,
  };

  return (
    <div className="contents">
      {/* Desktop sidebar: 248px, or a 64px rail when collapsed */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-62',
        )}
        aria-label="Admin navigation"
      >
        <SidebarContent {...shared} rail={collapsed} isMobile={false} />
      </aside>

      {/* Phone and tablet: the same sidebar as a drawer */}
      {mobileOpen && (
        <div
          className="relative z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col">
            <SidebarContent {...shared} rail={false} isMobile />
          </div>
        </div>
      )}

      <InstallHelpDialog open={showInstallHelp} onOpenChange={setShowInstallHelp} />
    </div>
  );
}

interface SidebarContentProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  pendingCounts: PendingCounts;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  user: SidebarUser;
  onLogout: () => void;
  onSwitchToPersonal: () => void;
  onOpenAccountSettings: () => void;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | null>;
  installOptionVisible: boolean;
  isInstallingApp: boolean;
  onShowInstallHelp: () => void;
  isSuperAdmin: boolean;
  /** Collapsed desktop rail: icons only. */
  rail: boolean;
  isMobile: boolean;
}

function SidebarContent({
  activeModule,
  onModuleChange,
  pendingCounts,
  setCollapsed,
  setMobileOpen,
  user,
  onLogout,
  onSwitchToPersonal,
  onOpenAccountSettings,
  onInstallApp,
  installOptionVisible,
  isInstallingApp,
  onShowInstallHelp,
  isSuperAdmin,
  rail,
  isMobile,
}: SidebarContentProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>(readClosedGroups);
  const { can } = useCurrentUserPermissions();

  const countOf = (module: AdminModule) => pendingCounts[module]?.count || 0;
  const showsCount = (module: AdminModule): boolean =>
    operationsModules.includes(module) &&
    (countOf(module) > 0 || alwaysShowCounterModules.includes(module));

  const toggleGroup = (label: string) => {
    const next = closedGroups.includes(label)
      ? closedGroups.filter((g) => g !== label)
      : [...closedGroups, label];
    setClosedGroups(next);
    writeClosedGroups(next);
  };

  const userName = (user?.name as string) || 'Admin User';
  const userRole = formatRole(user?.role as string | undefined);

  const renderItem = (module: AdminModule) => {
    const config = moduleConfig[module];
    const Icon = config.icon;
    const isActive = activeModule === module;
    const count = countOf(module);
    const counted = showsCount(module);
    const waiting = counted && count > 0;

    const item = (
      <button
        key={module}
        type="button"
        onClick={() => {
          onModuleChange(module);
          setMobileOpen(false);
        }}
        // Navigation intent: start the module's chunk downloading while the
        // pointer is still on the item. Idempotent and fire-and-forget.
        onMouseEnter={() => preloadAdminModule(module)}
        onFocus={() => preloadAdminModule(module)}
        onTouchStart={() => preloadAdminModule(module)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={
          rail
            ? counted
              ? `${config.label}, ${formatPendingSummary(count)}`
              : config.label
            : undefined
        }
        className={cn(
          'group/item relative flex items-center rounded-lg text-[13.5px] outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-nw-violet/60',
          rail
            ? 'h-10 w-11 justify-center'
            : cn(
                'w-full gap-2.5 px-2.5 text-left',
                // Phone and tablet drawer: 44px touch targets (design system).
                isMobile ? 'h-11' : 'h-[34px]',
              ),
          isActive
            ? 'bg-nw-nav-active font-semibold text-nw-violet-600'
            : 'text-nw-nav-text hover:bg-nw-nav-hover hover:text-nw-ink',
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            'size-[18px] shrink-0',
            isActive ? 'text-nw-violet' : 'text-nw-nav-icon group-hover/item:text-nw-text-3',
          )}
        />
        {!rail && <span className="min-w-0 flex-1 truncate">{config.label}</span>}
        {!rail && counted && (
          <span
            className={cn(
              'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-[7px] text-[11.5px] font-semibold tabular-nums',
              isActive
                ? 'bg-white text-nw-violet-600'
                : waiting
                  ? 'bg-nw-amber-100 text-nw-amber-700'
                  : 'bg-nw-count text-nw-text-2',
            )}
          >
            {count.toLocaleString()}
          </span>
        )}
        {rail && waiting && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-nw-amber-100 px-1 text-[10px] font-semibold leading-none tabular-nums text-nw-amber-700 ring-2 ring-nw-nav-bg"
          >
            {formatSidebarBadgeCount(count)}
          </span>
        )}
      </button>
    );

    if (!rail) return item;
    return (
      <Tooltip key={module}>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <div className="flex flex-col">
            <p className="font-medium">{config.label}</p>
            {counted && (
              <p className="mt-0.5 text-xs text-primary-foreground/85">
                {formatPendingSummary(count)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const home = sidebarHomeModules.filter((m) => can(m));
  const footer = sidebarFooterModules.filter((m) => can(m));

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex h-full flex-col border-r border-nw-nav-line bg-nw-nav-bg text-sm text-nw-ink',
          rail ? 'items-center px-2 pt-3.5 pb-3' : 'px-3 pt-3.5 pb-3',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex shrink-0 items-center',
            rail ? 'flex-col gap-3 pb-3' : 'gap-2.5 px-2 pb-3.5',
          )}
        >
          {rail ? (
            <img
              src="/brand-assets/navigate-wealth-icon-only-brand.svg"
              alt="Navigate Wealth"
              className="h-7 w-7"
            />
          ) : (
            <Logo variant="admin" className="min-w-0 flex-1" />
          )}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed(!rail)}
              aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
              title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
              className="inline-flex size-8 items-center justify-center rounded-lg text-nw-text-3 hover:bg-nw-nav-hover hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
            >
              {rail ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex size-8 items-center justify-center rounded-lg text-nw-text-3 hover:bg-nw-nav-hover hover:text-nw-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Modules */}
        <nav
          className={cn(
            'sidebar-scrollbar -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1',
            rail && 'items-center',
          )}
          aria-label="Admin modules"
        >
          {home.length > 0 && (
            <div className={cn('mb-1.5 flex flex-col gap-px', rail && 'items-center')}>
              {home.map(renderItem)}
            </div>
          )}

          {sidebarGroups.map((group) => {
            const visible = group.modules.filter((m) => can(m));
            if (visible.length === 0) return null;
            const open = rail || !closedGroups.includes(group.label);
            const waitingInGroup = visible.some((m) => showsCount(m) && countOf(m) > 0);
            const listId = `nav-group-${group.label.toLowerCase()}`;

            if (rail) {
              return (
                <div key={group.label} className="flex flex-col items-center gap-px">
                  <div className="my-2 h-px w-6 bg-nw-line" aria-hidden="true" />
                  {visible.map(renderItem)}
                </div>
              );
            }

            return (
              <div key={group.label} className="mt-2.5 flex flex-col gap-px">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  aria-controls={listId}
                  className="flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-left text-xs font-semibold text-nw-text-3 outline-none hover:bg-gray-100 hover:text-nw-ink focus-visible:ring-2 focus-visible:ring-nw-violet/60"
                >
                  <span className="flex-1">{group.label}</span>
                  {!open && waitingInGroup && (
                    <span
                      className="size-[7px] rounded-full bg-nw-amber-dot"
                      aria-label="Items waiting"
                      role="img"
                    />
                  )}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-3.5 transition-transform', !open && '-rotate-90')}
                  />
                </button>
                {open && (
                  <div id={listId} className="flex flex-col gap-px">
                    {visible.map(renderItem)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: Locked and the account menu */}
        <div
          className={cn(
            'mt-2.5 flex shrink-0 flex-col gap-0.5 border-t border-nw-line pt-2.5',
            rail && 'w-full items-center',
          )}
        >
          {footer.map(renderItem)}
          <DropdownMenu open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={rail ? `${userName}, account menu` : undefined}
                className={cn(
                  'flex items-center rounded-lg text-left outline-none hover:bg-nw-nav-hover focus-visible:ring-2 focus-visible:ring-nw-violet/60',
                  rail ? 'size-11 justify-center' : 'w-full gap-2.5 px-2 pt-2 pb-1.5',
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-nw-violet-100 text-xs font-semibold text-nw-violet-600"
                >
                  {userName[0]?.toUpperCase() || 'A'}
                </span>
                {!rail && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{userName}</span>
                    <span className="block truncate text-xs text-nw-text-3">{userRole}</span>
                  </span>
                )}
                {!rail && <ChevronsUpDown className="size-4 text-nw-text-3" aria-hidden="true" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-[13px] font-semibold text-nw-ink">
                  {userName}
                </span>
                <span className="block truncate text-xs text-nw-text-3">
                  {userRole}
                  {user?.email ? ` · ${user.email}` : ''}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setUserDropdownOpen(false);
                  setMobileOpen(false);
                  onOpenAccountSettings();
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Account settings
              </DropdownMenuItem>
              {isSuperAdmin && (
                <DropdownMenuItem
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onSwitchToPersonal();
                  }}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Switch to client view
                </DropdownMenuItem>
              )}
              <InstallAppMenuItem
                isInstalling={isInstallingApp}
                isVisible={installOptionVisible}
                onInstallApp={onInstallApp}
                onShowInstallHelp={onShowInstallHelp}
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setUserDropdownOpen(false);
                  onLogout();
                }}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}
