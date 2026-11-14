import { useState, useEffect, useMemo, Fragment } from 'react';
import { usePendingCounts } from './hooks/usePendingCounts';
import { Menu, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';

import { Sidebar } from './layout/Sidebar';
import { GlobalSearch } from './layout/GlobalSearch';
import { AdminModule } from './layout/types';
import { moduleConfig, sidebarGroupOf } from './layout/config';
import { BreadcrumbContext, type Crumb } from './layout/page';

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
  // Below lg the top bar has no room for the search field: a search button
  // opens it in a row under the bar (design: PH-* boards).
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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

  // Steps after the module (tab, record, sub-page), set by the module.
  const [trail, setTrail] = useState<Crumb[]>([]);
  const breadcrumb = useMemo(() => ({ trail, setTrail }), [trail]);
  const crumbLink =
    'rounded text-nw-violet-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60';

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
                  <span className="text-nw-violet-600">{group}</span>
                  <ChevronRight className="size-3.5 text-gray-300" aria-hidden="true" />
                </li>
              )}
              {trail.length === 0 ? (
                <li
                  className="truncate font-medium text-nw-ink max-sm:text-base max-sm:font-semibold"
                  aria-current="page"
                >
                  {moduleLabel}
                </li>
              ) : (
                <>
                  {/* On a phone only the last step shows, as the page title. */}
                  <li className="hidden items-center gap-1.5 sm:flex">
                    <button
                      type="button"
                      className={crumbLink}
                      onClick={() => onModuleChange(activeModule)}
                    >
                      {moduleLabel}
                    </button>
                    <ChevronRight className="size-3.5 text-gray-300" aria-hidden="true" />
                  </li>
                  {trail.map((crumb, i) => {
                    const last = i === trail.length - 1;
                    return (
                      <Fragment key={`${i}-${crumb.label}`}>
                        {last ? (
                          <li
                            className="truncate font-medium text-nw-ink max-sm:text-base max-sm:font-semibold"
                            aria-current="page"
                          >
                            {crumb.label}
                          </li>
                        ) : (
                          <li className="hidden min-w-0 items-center gap-1.5 sm:flex">
                            {crumb.onClick ? (
                              <button
                                type="button"
                                className={cn(crumbLink, 'truncate')}
                                onClick={crumb.onClick}
                              >
                                {crumb.label}
                              </button>
                            ) : (
                              <span className="truncate">{crumb.label}</span>
                            )}
                            <ChevronRight
                              className="size-3.5 shrink-0 text-gray-300"
                              aria-hidden="true"
                            />
                          </li>
                        )}
                      </Fragment>
                    );
                  })}
                </>
              )}
            </ol>
          </nav>

          <div className="hidden w-full max-w-sm lg:block">
            <GlobalSearch />
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-nw-text-2 hover:bg-nw-nav-hover hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 lg:hidden"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label={mobileSearchOpen ? 'Close search' : 'Search clients and staff'}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Search className="size-5" aria-hidden="true" />
            )}
          </button>
        </header>
        {mobileSearchOpen && (
          <div className="border-b border-nw-line bg-white px-4 py-2 lg:hidden">
            <GlobalSearch />
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-auto">
          <div
            className={cn(
              'min-w-0',
              (activeModule === 'compliance' || activeModule === 'esign') && 'h-full',
            )}
          >
            <BreadcrumbContext.Provider value={breadcrumb}>{children}</BreadcrumbContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
