/**
 * CommunicationPage — Client Portal Inbox
 *
 * Thin composition of module components. No business logic here.
 * Guidelines refs: §4.1 (module entry), §7 (presentation layer)
 */

import { useState, useMemo } from 'react';
import { MessageSquare, Loader2, RefreshCw, Clock } from 'lucide-react';
import { Button } from '../../ui/button';
import { PortalPageHeader } from '../../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../../portal/portal-theme';
import { MESSAGE_RETENTION_DAYS } from './constants';
import { filterCommunications, deriveInboxStats } from './utils';
import { useCommunications, useMarkAsRead } from './hooks/useCommunications';
import { ContactAdviserCard } from './components/ContactAdviserCard';
import { InboxStats } from './components/InboxStats';
import { CommunicationFilters } from './components/CommunicationFilters';
import { CommunicationList } from './components/CommunicationList';
import { CommunicationDetail } from './components/CommunicationDetail';
import type { Communication, CommunicationFilters as Filters } from './types';

export function CommunicationPage() {
  const { data: communications = [], isLoading, refetch } = useCommunications();
  const markAsRead = useMarkAsRead();

  const [selected, setSelected] = useState<Communication | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    dateRange: 'all',
  });

  const hasActiveFilters =
    filters.search !== '' || filters.category !== 'all' || filters.dateRange !== 'all';

  const filtered = useMemo(
    () => filterCommunications(communications, filters),
    [communications, filters],
  );

  const stats = useMemo(() => deriveInboxStats(communications), [communications]);

  const handleSelect = (comm: Communication) => {
    setSelected(comm);
    if (!comm.read) markAsRead.mutate(comm.id);
  };

  const clearFilters = () => {
    setFilters({ search: '', category: 'all', dateRange: 'all' });
    setCurrentPage(1);
  };

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      <PortalPageHeader
        title="Communications"
        subtitle="Updates and notifications from your financial adviser"
        icon={MessageSquare}
        compact
      />

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <ContactAdviserCard />
            <InboxStats total={stats.total} unread={stats.unread} important={stats.important} />

            {/* Retention notice */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Messages are retained in your portal for <strong>{MESSAGE_RETENTION_DAYS} days</strong> from
                  receipt. Older messages are automatically removed.
                </p>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            <CommunicationFilters
              filters={filters}
              onSearchChange={(v) => { setFilters((f) => ({ ...f, search: v })); setCurrentPage(1); }}
              onCategoryChange={(v) => { setFilters((f) => ({ ...f, category: v })); setCurrentPage(1); }}
              onDateRangeChange={(v) => { setFilters((f) => ({ ...f, dateRange: v as Filters['dateRange'] })); setCurrentPage(1); }}
            />

            {/* Results bar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading messages...
                  </span>
                ) : (
                  <span>Showing {filtered.length} messages</span>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="text-gray-500 hover:text-gray-900"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-[#6d28d9] hover:text-[#5b21b6]"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            <CommunicationList
              communications={filtered}
              isLoading={isLoading}
              hasActiveFilters={hasActiveFilters}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onSelect={handleSelect}
            />
          </div>
        </div>

        <CommunicationDetail communication={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

export default CommunicationPage;
