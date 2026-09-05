import { useState } from 'react';
import { Settings, LogOut, ArrowLeftRight, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../ui/utils';
import { Logo } from '../../layout/Logo';
import { AdminModule, PendingCounts } from './types';
import {
  alwaysShowCounterModules,
  formatSidebarBadgeCount,
  formatPendingSummary,
  moduleConfig,
  moduleGroups,
  operationsModules,
} from './config';
import { useAuth } from '../../auth/AuthContext';
import { useCurrentUserPermissions } from '../modules/personnel';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { InstallAppMenuItem } from './InstallAppMenuItem';
import { InstallHelpDialog } from './InstallHelpDialog';
import { usePWAInstall } from '../../../hooks/usePWAInstall';

interface SidebarProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  pendingCounts: PendingCounts;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

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

  // Check if current user is super admin
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
    toast.success('Switching to personal client view...');
    navigate('/dashboard');
  };

  return (
    <div className="contents">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300',
          collapsed ? 'w-16' : 'w-72',
        )}
        aria-label="Admin navigation"
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto sidebar-scrollbar bg-sidebar border-r border-sidebar-border">
          <SidebarContent
            activeModule={activeModule}
            onModuleChange={onModuleChange}
            pendingCounts={pendingCounts}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            user={
              user as unknown as {
                [key: string]: unknown;
                id?: string;
                email?: string;
                user_metadata?: Record<string, unknown>;
              } | null
            }
            onLogout={handleLogout}
            onSwitchToPersonal={handleSwitchToPersonal}
            onInstallApp={installApp}
            installOptionVisible={showInstallOption}
            isInstallingApp={isInstalling}
            onShowInstallHelp={() => setShowInstallHelp(true)}
            isSuperAdmin={isSuperAdmin}
            isMobile={false}
          />
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div
          className="relative z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border">
            <SidebarContent
              activeModule={activeModule}
              onModuleChange={onModuleChange}
              pendingCounts={pendingCounts}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
              user={
                user as unknown as {
                  [key: string]: unknown;
                  id?: string;
                  email?: string;
                  user_metadata?: Record<string, unknown>;
                } | null
              }
              onLogout={handleLogout}
              onSwitchToPersonal={handleSwitchToPersonal}
              onInstallApp={installApp}
              installOptionVisible={showInstallOption}
              isInstallingApp={isInstalling}
              onShowInstallHelp={() => setShowInstallHelp(true)}
              isSuperAdmin={isSuperAdmin}
              isMobile={true}
            />
          </div>
        </div>
      )}

      {/* PWA Install Help Dialog */}
      <InstallHelpDialog open={showInstallHelp} onOpenChange={setShowInstallHelp} />
    </div>
  );
}

// Extracted SidebarContent component to prevent re-renders
interface SidebarContentProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  pendingCounts: PendingCounts;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  onLogout: () => void;
  onSwitchToPersonal: () => void;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | null>;
  installOptionVisible: boolean;
  isInstallingApp: boolean;
  onShowInstallHelp: () => void;
  isSuperAdmin: boolean;
  isMobile: boolean;
}

function SidebarContent({
  activeModule,
  onModuleChange,
  pendingCounts,
  collapsed,
  setCollapsed,
  setMobileOpen,
  user,
  onLogout,
  onSwitchToPersonal,
  onInstallApp,
  installOptionVisible,
  isInstallingApp,
  onShowInstallHelp,
  isSuperAdmin,
  isMobile,
}: SidebarContentProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { can } = useCurrentUserPermissions();

  const shouldShowBadge = (module: AdminModule): boolean => {
    const count = pendingCounts[module]?.count || 0;
    return (
      operationsModules.includes(module) && (count > 0 || alwaysShowCounterModules.includes(module))
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Header */}
      <div
        className={cn(
          'flex h-16 items-center px-4 border-b border-sidebar-border transition-all duration-200',
          collapsed && !isMobile && 'px-2 justify-center',
        )}
      >
        {collapsed && !isMobile ? (
          <div
            className="w-9 h-9 rounded-full border border-sidebar-foreground/25 flex items-center justify-center select-none"
            aria-hidden="true"
          >
            <span className="text-sidebar-foreground font-bold text-sm">N</span>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Logo variant="admin-white" />
            </div>
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-auto hidden lg:flex text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Expand control - only in the collapsed desktop rail */}
      {collapsed && !isMobile && (
        <div className="flex justify-center px-2 pt-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-10 rounded-lg border border-dashed border-sidebar-foreground/30 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-foreground/50"
                  onClick={() => setCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scrollbar py-4" aria-label="Admin modules">
        {moduleGroups.map((section, sectionIdx) => {
          // Filter modules by permission — only show modules the user can access
          const visibleModules = section.modules.filter((m) => can(m));
          if (visibleModules.length === 0) return null;

          return (
            <div key={sectionIdx} className={cn('mb-6', collapsed && !isMobile && 'mb-3')}>
              {/* Collapsed rail: a divider keeps the section grouping visible without a title */}
              {collapsed && !isMobile && sectionIdx > 0 && (
                <div
                  className="mx-4 mb-3 border-t border-sidebar-foreground/15"
                  aria-hidden="true"
                />
              )}
              {/* Section title - only show when not collapsed */}
              {(!collapsed || isMobile) && (
                <div className="px-4 mb-2">
                  <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                    {section.label}
                  </h3>
                </div>
              )}

              {/* Menu Items */}
              <div className="space-y-1 px-2">
                {visibleModules.map((module, itemIdx) => {
                  const config = moduleConfig[module];
                  const Icon = config.icon;
                  const isActive = activeModule === module;

                  const pendingData = pendingCounts[module] || { count: 0 };
                  const showBadge = shouldShowBadge(module);

                  const buttonContent = (
                    <Button
                      key={itemIdx}
                      onClick={() => {
                        onModuleChange(module);
                        setMobileOpen(false);
                      }}
                      variant="ghost"
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={
                        collapsed && !isMobile
                          ? showBadge
                            ? `${config.label}, ${formatPendingSummary(pendingData.count)}`
                            : config.label
                          : undefined
                      }
                      className={cn(
                        'relative overflow-visible transition-all duration-200',
                        collapsed && !isMobile
                          ? 'w-10 h-10 p-0 justify-center rounded-lg'
                          : 'w-full justify-start gap-3',
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      {/* size-* (not h-/w-) so the Button's default svg sizing rule does not override it */}
                      <Icon
                        className={cn('shrink-0', collapsed && !isMobile ? 'size-5' : 'size-4')}
                      />
                      {(!collapsed || isMobile) && <span>{config.label}</span>}
                      {showBadge && (!collapsed || isMobile) && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 min-w-5 px-1.5 py-0 text-xs tabular-nums bg-sidebar-badge text-sidebar-badge-foreground border-transparent hover:bg-sidebar-badge"
                        >
                          {pendingData.count.toLocaleString()}
                        </Badge>
                      )}
                      {showBadge && collapsed && !isMobile && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -top-2.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-badge px-1 text-[10px] font-semibold leading-none tabular-nums text-sidebar-badge-foreground ring-2 ring-sidebar"
                        >
                          {formatSidebarBadgeCount(pendingData.count)}
                        </span>
                      )}
                    </Button>
                  );

                  // Wrap in Tooltip when collapsed
                  if (collapsed && !isMobile) {
                    return (
                      <TooltipProvider key={itemIdx}>
                        <Tooltip>
                          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            <div className="flex flex-col">
                              <p className="font-medium">{config.label}</p>
                              {showBadge && (
                                <p className="mt-0.5 text-xs text-primary-foreground/85">
                                  {formatPendingSummary(pendingData.count)}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  return buttonContent;
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className={cn('p-4 border-t border-sidebar-border', collapsed && !isMobile && 'px-2')}>
        <DropdownMenu open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && !isMobile
                  ? 'w-10 h-10 px-0 justify-center'
                  : 'w-full justify-start gap-3 h-12',
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                <AvatarImage src="/api/placeholder/32/32" alt="" />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {(user?.name as string)?.[0] || 'A'}
                </AvatarFallback>
              </Avatar>
              {(!collapsed || isMobile) && (
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{(user?.name as string) || 'Admin User'}</p>
                  <p className="text-xs text-sidebar-foreground/70">
                    {(user?.role as string) || 'Administrator'}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <InstallAppMenuItem
              isInstalling={isInstallingApp}
              isVisible={installOptionVisible}
              onInstallApp={onInstallApp}
              onShowInstallHelp={onShowInstallHelp}
            />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            {isSuperAdmin && (
              <DropdownMenuItem
                onClick={() => {
                  setUserDropdownOpen(false);
                  onSwitchToPersonal();
                }}
                className="text-blue-600 focus:text-blue-600 focus:bg-blue-50"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Switch to Personal View
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                setUserDropdownOpen(false);
                onLogout();
              }}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
