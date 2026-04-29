import React, { useState } from 'react';
import { 
  Settings,
  LogOut,
  ArrowLeftRight,
  Menu,
  X
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../ui/utils';
import { Logo } from '../../layout/Logo';
import { AdminModule, PendingCounts } from './types';
import { alwaysShowCounterModules, moduleConfig, moduleGroups, operationsModules } from './config';
import { useAuth } from '../../auth/AuthContext';
import { useCurrentUserPermissions } from '../modules/personnel/hooks/usePermissions';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { InstallAppMenuItem } from './InstallAppMenuItem';
import { InstallHelpDialog } from './InstallHelpDialog';

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
  setMobileOpen 
}: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

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
           "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300",
           collapsed ? "w-16" : "w-72"
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
            user={user}
            onLogout={handleLogout}
            onSwitchToPersonal={handleSwitchToPersonal}
            onShowInstallHelp={() => setShowInstallHelp(true)}
            isSuperAdmin={isSuperAdmin}
            isMobile={false}
          />
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="relative z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
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
              user={user}
              onLogout={handleLogout}
              onSwitchToPersonal={handleSwitchToPersonal}
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
  user: { id?: string; email?: string; user_metadata?: Record<string, unknown>; [key: string]: unknown } | null;
  onLogout: () => void;
  onSwitchToPersonal: () => void;
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
  onShowInstallHelp,
  isSuperAdmin,
  isMobile
}: SidebarContentProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { can } = useCurrentUserPermissions();

  const shouldShowBadge = (module: AdminModule): boolean => {
    const count = pendingCounts[module]?.count || 0;
    return operationsModules.includes(module) && (count > 0 || alwaysShowCounterModules.includes(module));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Header */}
      <div className={cn(
        "flex h-16 items-center px-4 border-b border-sidebar-border transition-all duration-200",
        collapsed && !isMobile && "px-2 justify-center"
      )}>
        {collapsed && !isMobile ? (
          <button 
            className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center cursor-pointer hover:bg-sidebar-primary/90 transition-colors"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
          >
            <span className="text-sidebar-primary-foreground font-bold text-sm">N</span>
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Logo variant="admin-white" />
            </div>
            {!isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 ml-auto hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                 <ArrowLeftRight className="h-3 w-3" />
              </Button>
            )}
            {isMobile && (
               <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
                 <X className="h-4 w-4" />
               </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scrollbar py-4" aria-label="Admin modules">
        {moduleGroups.map((section, sectionIdx) => {
          // Filter modules by permission — only show modules the user can access
          const visibleModules = section.modules.filter(m => can(m));
          if (visibleModules.length === 0) return null;

          return (
            <div key={sectionIdx} className={cn("mb-6", collapsed && !isMobile && "mb-4")}>
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
                      aria-label={collapsed && !isMobile ? config.label : undefined}
                      className={cn(
                        'relative transition-all duration-200',
                        collapsed && !isMobile ? 'w-10 h-10 p-0 justify-center' : 'w-full justify-start gap-3',
                        isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <Icon className={cn('shrink-0', collapsed && !isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                      {(!collapsed || isMobile) && <span>{config.label}</span>}
                      {showBadge && (!collapsed || isMobile) && (
                        <Badge 
                          variant="secondary"
                          className="ml-auto text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground border-transparent"
                        >
                          {pendingData.count}
                        </Badge>
                      )}
                      {showBadge && collapsed && !isMobile && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-sidebar-primary text-sidebar-primary-foreground rounded-full flex items-center justify-center text-xs font-medium border-2 border-sidebar">
                          {pendingData.count > 99 ? '99+' : pendingData.count}
                        </div>
                      )}
                    </Button>
                  );

                  // Wrap in Tooltip when collapsed
                  if (collapsed && !isMobile) {
                    return (
                      <TooltipProvider key={itemIdx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {buttonContent}
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="flex flex-col">
                              <p className="font-medium">{config.label}</p>
                              {showBadge && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pendingData.count} pending item{pendingData.count !== 1 ? 's' : ''}
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
      <div className={cn("p-4 border-t border-sidebar-border", collapsed && !isMobile && "px-2")}>
        <DropdownMenu open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && !isMobile ? "w-10 h-10 px-0 justify-center" : "w-full justify-start gap-3 h-12"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                <AvatarImage src="/api/placeholder/32/32" alt="" />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{user?.name?.[0] || 'A'}</AvatarFallback>
              </Avatar>
              {(!collapsed || isMobile) && (
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{user?.name || 'Admin User'}</p>
                  <p className="text-xs text-sidebar-foreground/70">{user?.role || 'Administrator'}</p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56" 
            sideOffset={8}
          >
            <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <InstallAppMenuItem onShowInstallHelp={onShowInstallHelp} />
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
