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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '../../../ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '../../../ui/alert-dialog';
import {
  MessageSquare, FileText, Calculator, Search, RefreshCw,
  Inbox, TrendingUp, Clock, CheckCircle2, Archive, Calendar, Mail,
  AlertCircle, Filter, Send,
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { toast } from 'sonner@2.0.3';
import { useSubmissions } from './hooks/useSubmissions';
import { submissionsApi } from './api';
import { SubmissionCard } from './components/SubmissionCard';
import { SubmissionDetailModal } from './components/SubmissionDetailModal';
import { ArchivedSubmissionsView } from './components/ArchivedSubmissionsView';
import { SubmissionInviteModal } from './components/SubmissionInviteModal';
import {
  BOARD_COLUMNS, SUBMISSION_STATUS_CONFIG, SUBMISSION_TYPE_CONFIG
} from './constants';
import type { Submission, SubmissionStatus, SubmissionType, SubmissionsFilters } from './types';

// ── Status config for columns — matches TaskColumn pattern ────────────────────

const COLUMN_STATUS_CONFIG: Record<SubmissionStatus, {
  bg: string; border: string; text: string; badge: string; label: string;
}> = {
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
  columnId, submissions, onView, onStatusChange
}: {
  columnId: SubmissionStatus;
  submissions: Submission[];
  onView: (s: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
}) {
  const config = COLUMN_STATUS_CONFIG[columnId];

  return (
    <div className="flex-1 min-w-[350px] h-full flex flex-col rounded-xl bg-gray-100/50 border border-gray-200">
      {/* Column Header — matches TaskColumn */}
      <div className="p-3 rounded-t-xl border-b bg-white flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.badge.split(' ')[0])} />
          <h3 className="font-semibold text-gray-900 text-sm">
            {config.label}
          </h3>
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
              'flex-1 overflow-y-auto p-3 space-y-3',
              'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
              snapshot.isDraggingOver && 'bg-purple-50/50',
            )}
          >
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg m-1">
                <p className="font-medium">No submissions</p>
                <p className="text-xs mt-1">Drag cards here</p>
              </div>
            ) : (
              submissions.map((s, index) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  index={index}
                  onView={onView}
                  onStatusChange={onStatusChange}
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
  const [searchParams] = useSearchParams();

  // ── Deep Link Support ──
  const initialType = searchParams.get('type') as SubmissionType | null;
  const deepLinkId = searchParams.get('id');
  const [filters, setFilters] = useState<SubmissionsFilters>(
    initialType ? { type: initialType } : {}
  );
  const [search, setSearch] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { submissions, isLoading, error, updateSubmission, deleteSubmission, refetch, isUpdating } =
    useSubmissions(filters.type ? { type: filters.type } : undefined);

  // ── Deep Link: auto-open detail drawer for ?id= param ──
  useEffect(() => {
    if (!deepLinkId || deepLinkProcessed) return;

    const found = submissions.find(s => s.id === deepLinkId);
    if (found) {
      setSelectedSubmission(found);
      setDeepLinkProcessed(true);
      return;
    }

    if (!isLoading && submissions.length >= 0) {
      submissionsApi.getById(deepLinkId)
        .then((sub) => {
          if (sub) setSelectedSubmission(sub);
        })
        .catch((err) => {
          console.error('Failed to load deep-linked submission:', err);
        })
        .finally(() => {
          setDeepLinkProcessed(true);
        });
    }
  }, [deepLinkId, submissions, isLoading, deepLinkProcessed]);

  // Client-side search filter
  const filteredSubmissions = useMemo(() => {
    if (!search.trim()) return submissions;
    const q = search.toLowerCase();
    return submissions.filter(s =>
      s.submitterName?.toLowerCase().includes(q) ||
      s.submitterEmail?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      Object.values(s.payload).some(v =>
        String(v).toLowerCase().includes(q)
      )
    );
  }, [submissions, search]);

  // Group submissions by status for the kanban columns
  const byStatus = useMemo(() => {
    const map: Record<SubmissionStatus, Submission[]> = {
      new: [], pending: [], completed: [], archived: []
    };
    for (const s of filteredSubmissions) {
      map[s.status]?.push(s);
    }
    return map;
  }, [filteredSubmissions]);

  // ── Handlers ──

  const handleStatusChange = useCallback(async (id: string, status: SubmissionStatus) => {
    const result = await updateSubmission(id, { status });
    if (result.success) {
      toast.success(`Moved to ${SUBMISSION_STATUS_CONFIG[status].label}`);
      // Keep detail drawer in sync
      if (selectedSubmission?.id === id) {
        setSelectedSubmission(prev => prev ? { ...prev, status } : null);
      }
    } else {
      toast.error('Failed to update status');
    }
  }, [updateSubmission, selectedSubmission]);

  const handleNotesChange = useCallback(async (id: string, notes: string) => {
    return updateSubmission(id, { notes });
  }, [updateSubmission]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const result = await deleteSubmission(deleteTarget);
    if (result.success) {
      toast.success('Submission deleted');
      if (selectedSubmission?.id === deleteTarget) setSelectedSubmission(null);
    } else {
      toast.error('Failed to delete submission');
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteSubmission, selectedSubmission]);

  const handleDeleteFromArchive = useCallback(async (id: string) => {
    const result = await deleteSubmission(id);
    if (result.success) {
      toast.success('Submission permanently deleted');
    } else {
      toast.error('Failed to delete submission');
    }
  }, [deleteSubmission]);

  // ── Drag & Drop Handler ──
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a valid target
    if (!destination) return;

    // Dropped in same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Status changed via drag
    if (destination.droppableId !== source.droppableId) {
      const newStatus = destination.droppableId as SubmissionStatus;
      await handleStatusChange(draggableId, newStatus);
    }
  }, [handleStatusChange]);

  // ── Render: Error ──

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="text-center max-w-md mx-auto p-8 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-red-900 font-semibold mb-2">Unable to load submissions</h3>
          <p className="text-sm text-red-600 mb-6">{error}</p>
          <Button onClick={() => refetch()} variant="destructive">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: Archived View ──

  if (showArchived) {
    return (
      <div className="min-h-screen bg-gray-50/30 pb-10">
        <div className="max-w-[1800px] mx-auto p-6 space-y-8">
          <ArchivedSubmissionsView
            submissions={byStatus.archived}
            onBack={() => setShowArchived(false)}
            onView={setSelectedSubmission}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteFromArchive}
          />

          {/* Detail Modal — also accessible from archive view */}
          <SubmissionDetailModal
            submission={selectedSubmission}
            open={!!selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
            onStatusChange={handleStatusChange}
            onNotesChange={handleNotesChange}
            onDelete={(id) => { setSelectedSubmission(null); setDeleteTarget(id); }}
          />

          {/* Delete Confirmation */}
          <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the submission. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // ── Render: Main Board ──

  const activeCount = byStatus.new.length + byStatus.pending.length + byStatus.completed.length;

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-8">

        {/* Page Header — matches TaskManagementModule */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Submissions Manager
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Manage incoming quotes, consultations, contact enquiries, client signups, and more
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 px-4 border-gray-200 hover:bg-white hover:text-gray-700 hover:border-gray-300 shadow-sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="h-10 px-4 border-gray-200 hover:bg-white hover:text-gray-700 hover:border-gray-300 shadow-sm"
              onClick={() => setShowArchived(true)}
            >
              <Archive className="h-4 w-4 mr-2 text-gray-500" />
              Archived
              {byStatus.archived.length > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {byStatus.archived.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-10 px-4 border-gray-200 hover:bg-white hover:text-gray-700 hover:border-gray-300 shadow-sm"
              onClick={() => setShowInviteModal(true)}
            >
              <Send className="h-4 w-4 mr-2 text-gray-500" />
              Invite
            </Button>
          </div>
        </div>

        {/* Stats Cards — matches TaskManagementModule exactly */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Total Active</span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{activeCount}</div>
            <div className="text-xs text-muted-foreground mt-1">On the board</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">New</span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{byStatus.new.length}</div>
            <div className="text-xs text-blue-600 font-medium mt-1">Needs attention</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Pending</span>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{byStatus.pending.length}</div>
            <div className="text-xs text-amber-600 font-medium mt-1">Being reviewed</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Completed</span>
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{byStatus.completed.length}</div>
            <div className="text-xs text-green-600 font-medium mt-1">Fully resolved</div>
          </div>
        </div>

        {/* Filters Bar — matches TaskManagementModule structure */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-2 max-w-3xl">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or submission ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-gray-400"
            />
          </div>
          <div className="w-px h-6 bg-gray-200 hidden md:block" />
          <div className="w-full md:w-auto relative">
            <select
              value={filters.type || 'all'}
              onChange={(e) => setFilters({
                ...filters,
                type: e.target.value === 'all' ? undefined : e.target.value as SubmissionType,
              })}
              className="w-full md:w-[180px] pl-3 pr-8 py-2 text-sm bg-gray-50 hover:bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-0 cursor-pointer font-medium text-gray-700 appearance-none"
            >
              <option value="all">All Types</option>
              <option value="quote">{SUBMISSION_TYPE_CONFIG.quote.label}</option>
              <option value="will_draft">{SUBMISSION_TYPE_CONFIG.will_draft.label}</option>
              <option value="tax_planning">{SUBMISSION_TYPE_CONFIG.tax_planning.label}</option>
              <option value="consultation">{SUBMISSION_TYPE_CONFIG.consultation.label}</option>
              <option value="contact">{SUBMISSION_TYPE_CONFIG.contact.label}</option>
              <option value="client_signup">{SUBMISSION_TYPE_CONFIG.client_signup.label}</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Kanban Board — 3 columns with drag-and-drop */}
        {!isLoading && submissions.length > 0 && (
          <div className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-6 h-full overflow-x-auto pb-4 px-1">
                {BOARD_COLUMNS.map(col => (
                  <KanbanColumn
                    key={col.id}
                    columnId={col.id}
                    submissions={byStatus[col.id]}
                    onView={setSelectedSubmission}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </DragDropContext>
          </div>
        )}

        {/* Placeholder when empty and not loading */}
        {!isLoading && submissions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white">
            <Inbox className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-base font-medium text-gray-600 mb-1">No submissions yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              Submissions from website forms will appear here automatically, or invite a client to get started.
            </p>
            <Button
              onClick={() => setShowInviteModal(true)}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white mb-6"
            >
              <Send className="h-4 w-4" />
              Invite a Client
            </Button>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Quotes
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Consultations
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Contact
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Will Drafts
              </span>
              <span className="flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" /> Tax Planning
              </span>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex gap-6 h-[500px]">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 min-w-[350px] rounded-xl bg-gray-100/50 border border-gray-200 animate-pulse">
                <div className="p-3 bg-white rounded-t-xl border-b">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
                <div className="p-3 space-y-3">
                  {[1, 2].map(j => (
                    <div key={j} className="h-32 bg-white rounded-lg border border-gray-200" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <SubmissionDetailModal
          submission={selectedSubmission}
          open={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onDelete={(id) => { setSelectedSubmission(null); setDeleteTarget(id); }}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the submission. This action cannot be undone.
                Consider archiving instead to retain a record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invite Modal */}
        <SubmissionInviteModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      </div>
    </div>
  );
}