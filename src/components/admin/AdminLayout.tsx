import { useState, useEffect } from 'react';
import { usePendingCounts } from './hooks/usePendingCounts';
import { Menu, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';

import { Sidebar } from './layout/Sidebar';
import { GlobalSearch } from './layout/GlobalSearch';
import { AdminModule } from './layout/types';
import { moduleConfig, sidebarGroupOf } from './layout/config';

interface AdminLayoutProps {
  activeModule: AdminModule;
  onModuleChange: (module: AdminModule) => void;
  children: React.ReactNode;
}

/** Sidebar widths from the design system: 248px open, 64px rail. */
const SIDEBAR_OPEN = '15.5rem';
const SIDEBAR_RAIL = '4rem';

export function AdminLayout({ activeModule, onModuleChange, children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pendingCounts = usePendingCounts();

  // Expose sidebar width as a CSS variable on :root so portals (Sheet, Dialog)
  // can reference it for responsive sizing — Guidelines §8.4.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      sidebarCollapsed ? SIDEBAR_RAIL : SIDEBAR_OPEN,
    );
  }, [sidebarCollapsed]);

  const group = sidebarGroupOf(activeModule);
  const moduleLabel = moduleConfig[activeModule]?.label ?? '';

  return (
    <div className="relative h-screen overflow-hidden bg-nw-bg">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={onModuleChange}
        pendingCounts={pendingCounts}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div
        className={cn(
          'flex h-full flex-col transition-[margin] duration-200',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-62',
        )}
      >
        {/* Top bar: breadcrumb and global search */}
        <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-nw-line bg-white px-4 lg:px-8">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-nw-text-2 hover:bg-nw-nav-hover hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-nw-text-3">
              {group && (
                <li className="hidden items-center gap-1.5 sm:flex">
                  <span>{group}</span>
                  <ChevronRight className="size-3.5 text-gray-300" aria-hidden="true" />
                </li>
              )}
              <li className="truncate font-medium text-nw-ink" aria-current="page">
                {moduleLabel}
              </li>
            </ol>
          </nav>

          <div className="hidden w-full max-w-sm lg:block">
            <GlobalSearch />
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto">
          <div
            className={cn(
              'min-w-0',
              (activeModule === 'compliance' || activeModule === 'esign') && 'h-full',
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
