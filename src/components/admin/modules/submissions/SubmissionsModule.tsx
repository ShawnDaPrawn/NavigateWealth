/**
 * Submissions Manager
 *
 * Central inbox for all incoming web submissions:
 *   - Quote Requests   (from public-facing quote/contact forms)
 *   - Will Drafts      (client or admin-initiated will planning)
 *   - Tax Planning     (completed tax planning assessments)
 *   - Consultations    (scheduled via the consultation modal)
 *   - Contact Enquiries (from the contact form)
 *   - Client Signups   (auto-created when a new client registers)
 *
 * Board layout: New -> Pending -> Completed (3-column kanban)
 * Archived submissions live in a separate table view.
 * Drag-and-drop between columns changes status.
 *
 * UI aligned to TaskManagementModule pattern (§8.1).
 * §3.2 - Frontend -> Server -> KV store (no direct Supabase access).
 * §7   - No business logic in UI; hooks own data flow.
 * §8.3 - Status colours follow platform vocabulary.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Skeleton } from '../../../ui/skeleton';
import { Inbox, RefreshCw, Search, Send } from 'lucide-react';
import { cn } from '../../../ui/utils';
import { toast } from 'sonner';
import { useSubmissions } from './hooks/useSubmissions';
import { submissionsApi } from './api';
import { SubmissionCard } from './components/SubmissionCard';
import { SubmissionPage } from './components/SubmissionPage';
import { ArchivedSubmissionsView } from './components/ArchivedSubmissionsView';
import { SubmissionInviteModal } from './components/SubmissionInviteModal';
import { BOARD_COLUMNS, SUBMISSION_STATUS_CONFIG, SUBMISSION_TYPE_CONFIG } from './constants';
import type { Submission, SubmissionStatus, SubmissionType } from './types';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';
import { Tabs } from '../../../ui/tabs';
import {
  ErrorState,
  NavTabsList,
  NavTabsTrigger,
  PageHeader,
  useBreadcrumbTrail,
  useConfirm,
  useRecordInUrl,
  useUrlState,
} from '../../layout/page';
import { ClearFiltersButton, FilterChip, FilterStatCard } from '../../layout/page/FilterControls';

const SUBMISSION_TABS = ['board', 'archived'] as const;
/** The board's status filter: a stat card sets it ("Active" = every column). */
const STATUS_FILTERS = ['all', 'new', 'pending', 'completed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SUBMISSION_TYPES = Object.keys(SUBMISSION_TYPE_CONFIG) as SubmissionType[];
const TYPE_FILTERS = ['all', ...SUBMISSION_TYPES] as const;

// ── Status config for columns — matches TaskColumn pattern ────────────────────

const COLUMN_STATUS_CONFIG: Record<
  SubmissionStatus,
  {
    bg: string;
    border: string;
    text: string;
    badge: string;
    label: string;
  }
> = {
  new: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    label: 'New',
  },
  pending: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Pending',
  },
  completed: {
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    label: 'Completed',
  },
  archived: {
    bg: 'bg-gray-50',
    border: 'border-gray-100',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
    label: 'Archived',
  },
};

// ── Droppable Column — matches TaskColumn exactly ─────────────────────────────

function KanbanColumn({
  columnId,
  submissions,
  onView,
  onStatusChange,
  onDelete,
}: {
  columnId: SubmissionStatus;
  submissions: Submission[];
  onView: (s: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
  onDelete: (s: Submission) => void;
}) {
  const config = COLUMN_STATUS_CONFIG[columnId];

  return (
    <div className="flex-1 min-w-[350px] h-full flex flex-col rounded-xl bg-gray-100/50 border border-gray-200">
      {/* Column Header — matches TaskColumn */}
      <div className="p-3 rounded-t-xl border-b bg-white flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.badge.split(' ')[0])} />
          <h3 className="font-semibold text-gray-900 text-sm">{config.label}</h3>
        </div>
        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
          {submissions.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 overflow-y-auto p-3',
              'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
              snapshot.isDraggingOver && 'bg-purple-50/50',
            )}
          >
            {submissions.length === 0 ? (
              <div className="m-1 flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 px-4 text-center text-sm text-nw-text-3">
                Drop a card here while you work on it.
              </div>
            ) : (
              submissions.map((s, index) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  index={index}
                  onView={onView}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────

export function SubmissionsModule() {
  const searchInputGuard = useSearchInputAutofillGuard({ id: 'submissions-module-search' });
  const { confirm, confirmDialog } = useConfirm();

  // Board / Archived, the type filter and the status filter live in the
  // address (?tab=archived, ?type=quote, ?status=new); so does an open
  // submission (?id=<id>, which the old ?type=&id= links still use).
  const [tab, setTab] = useUrlState('tab', 'board', SUBMISSION_TABS);
  const [typeFilter, setTypeFilter] = useUrlState<(typeof TYPE_FILTERS)[number]>(
    'type',
    'all',
    TYPE_FILTERS,
  );
  const [statusFilter, setStatusFilter] = useUrlState<StatusFilter>(
    'status',
    'all',
    STATUS_FILTERS,
  );
  const [, setSearchParams] = useSearchParams();
  const showArchived = tab === 'archived';
  const [search, setSearch] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { submissions, isLoading, error, updateSubmission, deleteSubmission, refetch } =
    useSubmissions(typeFilter !== 'all' ? { type: typeFilter } : undefined);

  // ── The open submission in the address ──
  // A link may name a submission outside the current list (another type, or
  // not loaded yet): fetch it by id; an unknown id is dropped with a message.
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const missingIds = useRef(new Map<string, string>());
  useRecordInUrl('id', selectedSubmission?.id ?? null, {
    ready: !isLoading && fetchingId === null,
    openFromUrl: (id) => {
      const found = submissions.find((s) => s.id === id);
      if (found) {
        setSelectedSubmission(found);
        return 'opened';
      }
      if (isLoading) return 'waiting';
      if (missingIds.current.has(id)) {
        const reason = missingIds.current.get(id);
        missingIds.current.delete(id);
        if (reason) {
          toast.error("Couldn't open the submission", { description: reason });
        } else {
          toast.error('Submission not found', {
            description: 'It may have been deleted. You are back on the board.',
          });
        }
        return 'missing';
      }
      if (fetchingId !== id) {
        setFetchingId(id);
        submissionsApi
          .getById(id)
          .then((sub) => {
            if (sub) setSelectedSubmission(sub);
            else missingIds.current.set(id, '');
          })
          .catch((err) => {
            console.error('Failed to load deep-linked submission:', err);
            // A 404 is "not found"; anything else is a failure to load.
            const message = err instanceof Error ? err.message : String(err);
            missingIds.current.set(id, /not found|404/i.test(message) ? '' : message);
          })
          .finally(() => setFetchingId(null));
      }
      return 'waiting';
    },
    closeFromUrl: () => setSelectedSubmission(null),
  });

  // Client-side search filter
  const filteredSubmissions = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter(
      (s) =>
        s.submitterName?.toLowerCase().includes(q) ||
        s.submitterEmail?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        Object.values(s.payload).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [submissions, search]);

  const groupByStatus = (list: Submission[]) => {
    const map: Record<SubmissionStatus, Submission[]> = {
      new: [],
      pending: [],
      completed: [],
      archived: [],
    };
    for (const s of list) map[s.status]?.push(s);
    return map;
  };
  // Columns follow the search; the figures and tab counts do not.
  const byStatus = useMemo(() => groupByStatus(filteredSubmissions), [filteredSubmissions]);
  const counts = useMemo(() => groupByStatus(submissions), [submissions]);

  // ── Handlers ──

  const handleStatusChange = useCallback(
    async (id: string, status: SubmissionStatus) => {
      const result = await updateSubmission(id, { status });
      if (result.success) {
        toast.success(`Moved to ${SUBMISSION_STATUS_CONFIG[status].label}`);
        // Keep the open page in sync
        setSelectedSubmission((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      } else {
        toast.error('Failed to update status');
      }
    },
    [updateSubmission],
  );

  const handleNotesChange = useCallback(
    async (id: string, notes: string) => {
      return updateSubmission(id, { notes });
    },
    [updateSubmission],
  );

  const deleteNow = useCallback(
    async (id: string, message = 'Submission deleted') => {
      const result = await deleteSubmission(id);
      if (result.success) {
        toast.success(message);
        setSelectedSubmission((prev) => (prev?.id === id ? null : prev));
      } else {
        toast.error('Failed to delete submission');
      }
    },
    [deleteSubmission],
  );

  // From a board card: ask first.
  const handleDeleteFromBoard = useCallback(
    async (submission: Submission) => {
      const ok = await confirm({
        title: 'Delete submission?',
        description: 'This permanently deletes the submission. This action cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (ok) await deleteNow(submission.id);
    },
    [confirm, deleteNow],
  );

  // ── Drag & Drop Handler ──
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
      }
      if (destination.droppableId !== source.droppableId) {
        await handleStatusChange(draggableId, destination.droppableId as SubmissionStatus);
      }
    },
    [handleStatusChange],
  );

  const inviteDialog = (
    <SubmissionInviteModal open={showInviteModal} onClose={() => setShowInviteModal(false)} />
  );

  // Top-bar breadcrumb: Work / Submissions / Board (/ the submitter).
  const listLabel = (selectedSubmission ? selectedSubmission.status === 'archived' : showArchived)
    ? 'Archived'
    : 'Board';
  useBreadcrumbTrail(
    selectedSubmission
      ? [
          { label: listLabel, onClick: () => setSelectedSubmission(null) },
          { label: selectedSubmission.submitterName || 'Submission' },
        ]
      : [{ label: listLabel }],
  );

  // ── Render: an open submission is a page ──
  if (selectedSubmission) {
    const current = submissions.find((s) => s.id === selectedSubmission.id) ?? selectedSubmission;
    return (
      <SubmissionPage
        key={current.id}
        submission={current}
        onClose={() => setSelectedSubmission(null)}
        backLabel={current.status === 'archived' ? 'archived submissions' : 'board'}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
        onDelete={(id) => deleteNow(id)}
      />
    );
  }

  const activeCount = counts.new.length + counts.pending.length + counts.completed.length;
  const visibleColumns = BOARD_COLUMNS.filter(
    (col) => statusFilter === 'all' || col.id === statusFilter,
  );
  const toggleStatus = (next: StatusFilter) => {
    setStatusFilter(statusFilter === next && next !== 'all' ? 'all' : next);
  };
  const filtersActive = typeFilter !== 'all' || statusFilter !== 'all' || search.trim() !== '';
  const clearAllFilters = () => {
    setSearch('');
    // One address change for both filters.
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('type');
        next.delete('status');
        return next;
      },
      { replace: true },
    );
  };
  const isEmpty = !isLoading && !error && submissions.length === 0 && typeFilter === 'all';

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 p-6 lg:p-8">
        <PageHeader
          title="Submissions"
          description="Quotes, consultations, contact enquiries, client signups and change requests."
          actions={
            <>
              {!showArchived && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void refetch()}
                  disabled={isLoading}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isLoading && 'animate-spin')}
                    aria-hidden="true"
                  />
                </Button>
              )}
              <Button onClick={() => setShowInviteModal(true)}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Invite a client
              </Button>
            </>
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof SUBMISSION_TABS)[number])}>
          <NavTabsList aria-label="Submissions views">
            <NavTabsTrigger value="board" count={isLoading || error ? undefined : activeCount}>
              Board
            </NavTabsTrigger>
            <NavTabsTrigger
              value="archived"
              count={isLoading || error ? undefined : counts.archived.length}
            >
              Archived
            </NavTabsTrigger>
          </NavTabsList>
        </Tabs>

        {isLoading ? (
          <div role="status" aria-label="Loading submissions" className="space-y-5">
            <span className="sr-only">Loading submissions…</span>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[92px] rounded-xl" />
              ))}
            </div>
            <div className="flex h-[420px] gap-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="min-w-[300px] flex-1 rounded-xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load submissions"
            description="Something went wrong while loading submissions. Nothing you entered was lost."
            onRetry={() => void refetch()}
            details={error}
          />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-nw-line bg-white px-6 py-16 text-center">
            <Inbox className="mb-4 h-10 w-10 text-gray-300" aria-hidden="true" />
            <h3 className="text-base font-semibold text-nw-ink">No submissions yet</h3>
            <p className="mt-1 mb-5 max-w-sm text-sm text-nw-text-3">
              Website form submissions appear here as they arrive.
            </p>
            <Button onClick={() => setShowInviteModal(true)}>Send a form link</Button>
          </div>
        ) : showArchived ? (
          <ArchivedSubmissionsView
            submissions={counts.archived}
            onView={setSelectedSubmission}
            onStatusChange={handleStatusChange}
            onDelete={(id) => void deleteNow(id, 'Submission permanently deleted')}
          />
        ) : (
          <>
            <div
              role="group"
              aria-label="Filter submissions by status"
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <FilterStatCard
                label="Active"
                value={activeCount}
                meta="On the board"
                active={statusFilter === 'all'}
                onClick={() => toggleStatus('all')}
              />
              <FilterStatCard
                label="New"
                value={counts.new.length}
                meta="Needs attention"
                tone={counts.new.length > 0 ? 'attention' : 'default'}
                active={statusFilter === 'new'}
                onClick={() => toggleStatus('new')}
              />
              <FilterStatCard
                label="Pending"
                value={counts.pending.length}
                meta="Being reviewed"
                active={statusFilter === 'pending'}
                onClick={() => toggleStatus('pending')}
              />
              <FilterStatCard
                label="Completed"
                value={counts.completed.length}
                meta="Fully resolved"
                active={statusFilter === 'completed'}
                onClick={() => toggleStatus('completed')}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  {...searchInputGuard}
                  aria-label="Search submissions"
                  placeholder="Search name, email or submission ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <FilterChip
                  label="Type"
                  value={typeFilter}
                  allValue="all"
                  onChange={setTypeFilter}
                  options={SUBMISSION_TYPES.map((t) => ({
                    value: t,
                    label: SUBMISSION_TYPE_CONFIG[t].label,
                  }))}
                />
                {filtersActive && <ClearFiltersButton onClick={clearAllFilters} />}
              </div>
            </div>

            {filtersActive && visibleColumns.every((col) => byStatus[col.id].length === 0) && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-4 py-3 text-sm text-nw-text-2"
              >
                <span className="flex-1">No submissions match your filters.</span>
                <ClearFiltersButton onClick={clearAllFilters} />
              </div>
            )}

            <div className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex h-full gap-6 overflow-x-auto px-1 pb-4">
                  {visibleColumns.map((col) => (
                    <KanbanColumn
                      key={col.id}
                      columnId={col.id}
                      submissions={byStatus[col.id]}
                      onView={setSelectedSubmission}
                      onStatusChange={handleStatusChange}
                      onDelete={(sub) => void handleDeleteFromBoard(sub)}
                    />
                  ))}
                </div>
              </DragDropContext>
            </div>
          </>
        )}

        {inviteDialog}
        {confirmDialog}
      </div>
    </div>
  );
}
