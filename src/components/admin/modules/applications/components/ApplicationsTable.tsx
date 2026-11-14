/**
 * Applications table (design system: list with toolbar).
 *
 * Toolbar: search, Origin and Submitted chips, result count and Refresh.
 * Each row has one main action for its status (Review, Complete on behalf,
 * Open client, View) and the rest under ⋯. 25 rows a page.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Application, TabStatus } from '../types';
import { formatDate, normalizeApplicationData } from '../utils';
import { StatusBadge } from './StatusBadge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { Search, RefreshCw, Loader2, MoreHorizontal } from 'lucide-react';
import { ClearFiltersButton, FilterChip } from '../../../layout/page/FilterControls';

const PAGE_SIZE = 25;

type OriginFilter = 'all' | 'admin_invite' | 'admin_import' | 'self';
type SubmittedFilter = 'all' | '7' | '30' | '90' | '365';

interface ApplicationsTableProps {
  loading: boolean;
  refreshing: boolean;
  activeTab: TabStatus;
  applications: Application[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  onReview: (app: Application) => void;
  onApprove: (app: Application) => void;
  onDecline: (app: Application) => void;
  onResendInvite?: (app: Application) => void;
  onCompleteOnBehalf?: (app: Application) => void;
  onOpenClient?: (app: Application) => void;
  /** Incomplete: email the applicant to finish their application. */
  onSendReminder?: (app: Application) => void;
  /** Approved / rejected: the application as a PDF. */
  onDownloadPdf?: (app: Application) => void;
  onInvite?: () => void;
  resendingInviteId?: string | null;
  /** Approve / Reject show only with the approve permission. */
  canApprove?: boolean;
  canInvite?: boolean;
}

/** Tab-specific empty state (design system: one per tab). */
const EMPTY_STATE: Record<TabStatus, { title: string; description: string; invite?: boolean }> = {
  incomplete: {
    title: 'No incomplete applications',
    description: 'Clients who sign up but don’t finish their application will appear here.',
  },
  pending: {
    title: 'No pending applications',
    description:
      'New applications waiting for review appear here. Use Invite applicant to start one.',
  },
  invited: {
    title: 'No invited applicants',
    description: 'People you invite appear here until they submit their application.',
    invite: true,
  },
  approved: {
    title: 'No approved applications yet',
    description: 'Approved applications move here once the client profile is created.',
  },
  rejected: {
    title: 'No rejected applications',
    description: 'Rejected applications will be listed here for reference.',
  },
  all: {
    title: 'No applications',
    description: 'New applications appear here when clients sign up or you invite them.',
    invite: true,
  },
};

const ORIGIN_LABEL: Record<Exclude<OriginFilter, 'all'>, string> = {
  admin_invite: 'Invited',
  admin_import: 'Import',
  self: 'Self-service',
};

function originOf(app: Application): Exclude<OriginFilter, 'all'> {
  if (app.origin === 'admin_invite') return 'admin_invite';
  if (app.origin === 'admin_import') return 'admin_import';
  return 'self';
}

const ORIGIN_PILL: Record<Exclude<OriginFilter, 'all'>, string> = {
  admin_invite: 'bg-indigo-50 text-indigo-700',
  admin_import: 'bg-blue-50 text-blue-700',
  self: 'bg-gray-100 text-gray-700',
};

export function ApplicationsTable({
  loading,
  refreshing,
  activeTab,
  applications,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onReview,
  onApprove,
  onDecline,
  onResendInvite,
  onCompleteOnBehalf,
  onOpenClient,
  onSendReminder,
  onDownloadPdf,
  onInvite,
  resendingInviteId,
  canApprove = true,
  canInvite = true,
}: ApplicationsTableProps) {
  const searchInputGuard = useSearchInputAutofillGuard({ id: 'applications-table-search' });
  const [origin, setOrigin] = useState<OriginFilter>('all');
  const [submitted, setSubmitted] = useState<SubmittedFilter>('all');
  const [page, setPage] = useState(0);

  // Rows belong to the open tab (the list may still hold the previous one
  // for a moment while the next loads).
  const statusMap: Record<TabStatus, string[] | null> = {
    incomplete: ['draft', 'in_progress'],
    pending: ['submitted'],
    approved: ['approved'],
    rejected: ['declined'],
    invited: ['invited'],
    all: null,
  };

  const filtered = useMemo(() => {
    const statuses = statusMap[activeTab];
    const since = submitted === 'all' ? null : Date.now() - Number(submitted) * 24 * 60 * 60 * 1000;
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      if (statuses && !statuses.includes(app.status)) return false;
      if (origin !== 'all' && originOf(app) !== origin) return false;
      if (since !== null) {
        const when = new Date(app.submitted_at || app.created_at).getTime();
        if (!(when >= since)) return false;
      }
      if (!q) return true;
      const data = normalizeApplicationData(app.application_data);
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
      const email = (data.emailAddress || app.user_email || '').toLowerCase();
      const phone = (data.cellphoneNumber || '').toLowerCase();
      const id = (data.idNumber || '').toLowerCase();
      const appNumber = (app.application_number || '').toLowerCase();
      return (
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        id.includes(q) ||
        appNumber.includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statusMap is constant
  }, [applications, activeTab, origin, submitted, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [activeTab, origin, submitted, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const filtersActive = origin !== 'all' || submitted !== 'all' || searchQuery.trim() !== '';

  const getInitials = (app: Application) => {
    const first = app.application_data.firstName?.[0] || '';
    const last = app.application_data.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const getFullName = (app: Application) => {
    const parts = [
      app.application_data.title,
      app.application_data.firstName,
      app.application_data.lastName,
    ].filter(Boolean);
    return parts.join(' ') || app.user_name || 'Unknown';
  };

  /** The one main action for a row, by its status. */
  const rowActions = (app: Application) => {
    const name = getFullName(app);
    const isSubmitted = app.status === 'submitted';
    const isInvited = app.status === 'invited';
    const isIncomplete = app.status === 'draft' || app.status === 'in_progress';
    const isApproved = app.status === 'approved';
    const isRejected = app.status === 'declined';

    let main: React.ReactNode;
    if (isIncomplete && onCompleteOnBehalf) {
      main = (
        <Button size="sm" variant="outline" onClick={() => onCompleteOnBehalf(app)}>
          Complete on behalf
        </Button>
      );
    } else if (isApproved && onOpenClient && app.user_id) {
      main = (
        <Button size="sm" variant="outline" onClick={() => onOpenClient(app)}>
          Open client
        </Button>
      );
    } else if (isApproved || isRejected) {
      main = (
        <Button size="sm" variant="outline" onClick={() => onReview(app)}>
          View
        </Button>
      );
    } else {
      main = (
        <Button size="sm" variant="outline" onClick={() => onReview(app)}>
          Review
        </Button>
      );
    }

    const items: React.ReactNode[] = [];
    if (isIncomplete || (isApproved && onOpenClient && app.user_id)) {
      items.push(
        <DropdownMenuItem key="view" onSelect={() => onReview(app)}>
          {isApproved ? 'View application' : 'Review details'}
        </DropdownMenuItem>,
      );
    }
    if ((isSubmitted || isInvited || isIncomplete) && canApprove) {
      items.push(
        <DropdownMenuItem key="approve" onSelect={() => onApprove(app)}>
          Approve
        </DropdownMenuItem>,
      );
    }
    if ((isSubmitted || isInvited) && onCompleteOnBehalf) {
      items.push(
        <DropdownMenuItem key="behalf" onSelect={() => onCompleteOnBehalf(app)}>
          Complete on behalf
        </DropdownMenuItem>,
      );
    }
    if (isInvited && onResendInvite) {
      items.push(
        <DropdownMenuItem
          key="resend"
          onSelect={() => onResendInvite(app)}
          disabled={resendingInviteId === app.id}
        >
          {resendingInviteId === app.id && (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          Resend invite
        </DropdownMenuItem>,
      );
    }
    if (isIncomplete && onSendReminder) {
      items.push(
        <DropdownMenuItem key="remind" onSelect={() => onSendReminder(app)}>
          Send reminder
        </DropdownMenuItem>,
      );
    }
    if (isRejected && app.review_notes) {
      items.push(
        <DropdownMenuItem key="reason" disabled className="max-w-64 whitespace-normal">
          Reason: {app.review_notes}
        </DropdownMenuItem>,
      );
    }
    if ((isApproved || isRejected) && onDownloadPdf) {
      items.push(
        <DropdownMenuItem key="pdf" onSelect={() => onDownloadPdf(app)}>
          Download PDF
        </DropdownMenuItem>,
      );
    }
    if ((isSubmitted || isInvited || isIncomplete) && canApprove) {
      items.push(<DropdownMenuSeparator key="sep" />);
      items.push(
        <DropdownMenuItem
          key="reject"
          onSelect={() => onDecline(app)}
          className="text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          Reject…
        </DropdownMenuItem>,
      );
    }

    return (
      <div className="flex items-center justify-end gap-1">
        {main}
        {items.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`More actions for ${name}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {items}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-nw-line p-3">
      <div className="relative w-full sm:w-80">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          {...searchInputGuard}
          aria-label="Search applications"
          placeholder="Search name, email, phone or APP-number…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-9 text-sm"
        />
      </div>
      <FilterChip
        label="Origin"
        value={origin}
        allValue="all"
        onChange={setOrigin}
        options={(Object.keys(ORIGIN_LABEL) as Exclude<OriginFilter, 'all'>[]).map((o) => ({
          value: o,
          label: ORIGIN_LABEL[o],
        }))}
      />
      <FilterChip
        label="Submitted"
        value={submitted}
        allValue="all"
        allLabel="Any time"
        onChange={setSubmitted}
        options={[
          { value: '7', label: 'Last 7 days' },
          { value: '30', label: 'Last 30 days' },
          { value: '90', label: 'Last 90 days' },
          { value: '365', label: 'Last 12 months' },
        ]}
      />
      {filtersActive && (
        <ClearFiltersButton
          onClick={() => {
            setOrigin('all');
            setSubmitted('all');
            setSearchQuery('');
          }}
        />
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-nw-text-3">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
        <Button
          onClick={onRefresh}
          variant="ghost"
          size="icon"
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <section
        className="overflow-hidden rounded-xl border border-nw-line bg-white"
        aria-busy="true"
      >
        <p className="sr-only" role="status">
          Loading applications, please wait…
        </p>
        <div className="border-b border-nw-line p-3">
          <Skeleton className="h-9 w-80 rounded-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-nw-line-2 px-4 py-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-8 w-20 rounded-md" />
          </div>
        ))}
      </section>
    );
  }

  const empty = EMPTY_STATE[activeTab];

  return (
    <section className="overflow-hidden rounded-xl border border-nw-line bg-white">
      {toolbar}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <h3 className="text-base font-semibold text-nw-ink">
            {filtersActive ? 'No applications match your filters' : empty.title}
          </h3>
          <p className="max-w-sm text-sm text-nw-text-3">
            {filtersActive ? 'Try a different search or clear the filters.' : empty.description}
          </p>
          {filtersActive && (
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                setOrigin('all');
                setSubmitted('all');
                setSearchQuery('');
              }}
            >
              Clear filters
            </Button>
          )}
          {!filtersActive && empty.invite && onInvite && canInvite && (
            <Button className="mt-2" onClick={onInvite}>
              Invite applicant
            </Button>
          )}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Applicant</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>ID number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  {activeTab === 'invited'
                    ? 'Invited'
                    : activeTab === 'incomplete'
                      ? 'Signed up'
                      : 'Submitted'}
                </TableHead>
                <TableHead>Origin</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((app) => {
                const data = normalizeApplicationData(app.application_data);
                const o = originOf(app);
                return (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => onReview(app)}>
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nw-violet-50 text-xs font-semibold text-nw-violet-600"
                          aria-hidden="true"
                        >
                          {getInitials(app)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-nw-ink">
                            {getFullName(app)}
                          </p>
                          {app.application_number && (
                            <p className="font-mono text-[11px] text-nw-text-3">
                              {app.application_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <p className="max-w-[200px] truncate text-sm text-nw-text-2">
                        {data.emailAddress || app.user_email || '—'}
                      </p>
                      {data.cellphoneNumber && (
                        <p className="text-xs text-nw-text-3">{data.cellphoneNumber}</p>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {data.idNumber ? (
                        <span
                          className="font-mono text-xs text-nw-text-2"
                          title={`${data.idType === 'passport' ? 'Passport' : 'SA ID'}, partly hidden`}
                        >
                          {data.idNumber.slice(0, 6)}••••{data.idNumber.slice(-2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="py-3 text-[13px] whitespace-nowrap text-nw-text-2">
                      {formatDate(app.submitted_at || app.created_at)}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORIGIN_PILL[o]}`}
                      >
                        {ORIGIN_LABEL[o]}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      {rowActions(app)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-2 border-t border-nw-line px-4 py-3 text-sm text-nw-text-3">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of{' '}
              {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
