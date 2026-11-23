import { useState, useEffect, useMemo, Fragment } from 'react';
import { usePendingCounts } from './hooks/usePendingCounts';
import { Menu, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';

import { Sidebar } from './layout/Sidebar';
import { GlobalSearch } from './layout/GlobalSearch';
import { AdminModule } from './layout/types';
import { moduleConfig, sidebarGroupOf } from './layout/config';
import { BreadcrumbContext, type Crumb } from './layout/page';
// The website's Navigator design, admin-wide (palette, shared components,
// cards, tables). Loaded with the admin chunk only.
import '../../styles/admin-navigator.css';

/** The <html> class that turns the admin theme on; see admin-navigator.css. */
export const ADMIN_THEME_CLASS = 'nw-admin-theme';

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

  // The theme lives on <html> rather than on this tree, so dialogs, sheets,
  // menus and tooltips (portalled to <body>) are themed too. It comes off
  // again when the admin unmounts, so the client portal and public site
  // never carry it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(ADMIN_THEME_CLASS);
    return () => root.classList.remove(ADMIN_THEME_CLASS);
  }, []);

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
  // Crumbs are quiet: muted links that turn ink with a hairline underline on
  // hover (violet is kept for actions).
  const crumbLink =
    'rounded-[4px] text-nw-muted transition-colors duration-[250ms] hover:text-nw-ink hover:underline hover:decoration-1 hover:underline-offset-[3px]';
  const iconButton =
    'inline-flex size-10 items-center justify-center rounded-[4px] border border-nw-line bg-white text-nw-ink transition-colors duration-[250ms] hover:border-nw-ink lg:hidden';

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
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-nw-line bg-white/[0.97] px-4 lg:px-8">
          <button
            type="button"
            className={iconButton}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-2 text-[13.5px] text-nw-muted">
              {group && (
                <li className="hidden items-center gap-2 sm:flex">
                  <span>{group}</span>
                  <ChevronRight className="size-3.5 text-nw-line-heavy" aria-hidden="true" />
                </li>
              )}
              {trail.length === 0 ? (
                <li
                  className="truncate font-semibold text-nw-ink max-sm:text-base"
                  aria-current="page"
                >
                  {moduleLabel}
                </li>
              ) : (
                <>
                  {/* On a phone only the last step shows, as the page title. */}
                  <li className="hidden items-center gap-2 sm:flex">
                    <button
                      type="button"
                      className={crumbLink}
                      onClick={() => onModuleChange(activeModule)}
                    >
                      {moduleLabel}
                    </button>
                    <ChevronRight className="size-3.5 text-nw-line-heavy" aria-hidden="true" />
                  </li>
                  {trail.map((crumb, i) => {
                    const last = i === trail.length - 1;
                    return (
                      <Fragment key={`${i}-${crumb.label}`}>
                        {last ? (
                          <li
                            className="truncate font-semibold text-nw-ink max-sm:text-base"
                            aria-current="page"
                          >
                            {crumb.label}
                          </li>
                        ) : (
                          <li className="hidden min-w-0 items-center gap-2 sm:flex">
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
                              className="size-3.5 shrink-0 text-nw-line-heavy"
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

          <div className="hidden w-full max-w-[380px] lg:block">
            <GlobalSearch />
          </div>
          <button
            type="button"
            className={iconButton}
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

        <main id="main-content" className="nw-admin flex-1 overflow-auto">
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
