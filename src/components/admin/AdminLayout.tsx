import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { usePendingCounts } from './hooks/usePendingCounts';
import { toast } from 'sonner@2.0.3';
import { 
  Menu,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

// Import refactored layout components
import { Sidebar } from './layout/Sidebar';
import { GlobalSearch } from './layout/GlobalSearch';
import { AdminModule } from './layout/types';

interface AdminLayoutProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  children: React.ReactNode;
}

export function AdminLayout({ activeModule, onModuleChange, children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  const pendingCounts = usePendingCounts();
  const navigate = useNavigate();

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-72';
  const mainContentMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72';

  // Expose sidebar width as a CSS variable on :root so portals (Sheet, Dialog)
  // can reference it for responsive sizing — Guidelines §8.4.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      sidebarCollapsed ? '4rem' : '18rem',
    );
  }, [sidebarCollapsed]);

  return (
    <div
      className="h-screen bg-background overflow-hidden relative"
    >
      <Sidebar 
        activeModule={activeModule}
        onModuleChange={onModuleChange}
        pendingCounts={pendingCounts}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main Content */}
      <div className={cn("h-full flex flex-col transition-all duration-300", mainContentMargin)}>
        {/* Mobile menu button - floating */}
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden fixed top-4 left-4 z-40 bg-white shadow-md"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Global Search — uses AdminNavigationContext, no props needed */}
        <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b bg-white sticky top-0 z-30">
           <div className="flex-1 max-w-xl">
             <GlobalSearch />
           </div>
           <div className="flex items-center gap-4">
             {/* Add header actions here if needed */}
           </div>
        </div>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto">
          <div className={cn(
            "min-w-0",
            (activeModule === 'compliance' || activeModule === 'quotes' || activeModule === 'esign') && "h-full"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}