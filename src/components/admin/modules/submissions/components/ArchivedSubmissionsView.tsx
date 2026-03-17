/**
 * ArchivedSubmissionsView
 *
 * Table view for archived submissions — separated from the kanban board
 * for cleaner workflow focus. Supports search, restore to any active
 * status, view details, and permanent deletion.
 *
 * Mirrors the Tasks module's ArchivedTasksView pattern (§8.1).
 * §7 — No business logic in UI; hooks own data flow.
 */

import { useState } from 'react';
import {
  MessageSquare, FileText, Calculator, Calendar, Mail,
  ArrowLeft, Search, Eye, Trash2, RotateCcw,
  UserPlus, MoreHorizontal,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../../ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../../../../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { cn } from '../../../../ui/utils';
import type { Submission, SubmissionStatus, SubmissionType } from '../types';
import { SUBMISSION_TYPE_CONFIG, SOURCE_CHANNEL_LABELS } from '../constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArchivedSubmissionsViewProps {
  submissions: Submission[];
  onBack: () => void;
  onView: (submission: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
  onDelete: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TypeIcon({ type, className }: { type: SubmissionType; className?: string }) {
  const c = className || 'h-4 w-4';
  switch (type) {
    case 'will_draft':   return <FileText className={c} />;
    case 'tax_planning': return <Calculator className={c} />;
    case 'consultation': return <Calendar className={c} />;
    case 'contact':      return <Mail className={c} />;
    case 'client_signup': return <UserPlus className={c} />;
    case 'quote':
    default:             return <MessageSquare className={c} />;
  }
}

const TYPE_ICON_BG: Record<SubmissionType, string> = {
  quote: 'bg-purple-50 text-purple-600',
  will_draft: 'bg-blue-50 text-blue-600',
  tax_planning: 'bg-emerald-50 text-emerald-600',
  consultation: 'bg-amber-50 text-amber-600',
  contact: 'bg-sky-50 text-sky-600',
  client_signup: 'bg-violet-50 text-violet-600',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getServiceName(submission: Submission): string | null {
  const p = submission.payload;
  if (p.productName) return String(p.productName);
  if (p.service) return String(p.service).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArchivedSubmissionsView({
  submissions,
  onBack,
  onView,
  onStatusChange,
  onDelete,
}: ArchivedSubmissionsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.submitterName?.toLowerCase().includes(q) ||
      s.submitterEmail?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      SUBMISSION_TYPE_CONFIG[s.type].label.toLowerCase().includes(q) ||
      Object.values(s.payload).some(v => String(v).toLowerCase().includes(q))
    );
  });

  const confirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Archived Submissions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View and restore previously archived submissions
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-500 font-medium">
          {filteredSubmissions.length} archived submission{filteredSubmissions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search archived submissions…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {searchTerm ? 'No matches found' : 'No archived submissions'}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              {searchTerm
                ? `No submissions found matching "${searchTerm}". Try adjusting your search.`
                : 'Submissions that you archive will appear here for safe keeping.'}
            </p>
            {searchTerm && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="w-[35%]">Submission</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Archived</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => {
                const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
                const serviceName = getServiceName(submission);

                return (
                  <TableRow
                    key={submission.id}
                    className="group hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => onView(submission)}
                  >
                    {/* Submission info */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          TYPE_ICON_BG[submission.type]
                        )}>
                          <TypeIcon type={submission.type} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors block truncate">
                            {submission.submitterName || 'Unknown'}
                          </span>
                          {submission.submitterEmail && (
                            <span className="text-xs text-gray-500 block truncate">
                              {submission.submitterEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-gray-700">
                          {typeCfg.label}
                        </span>
                        {serviceName && (
                          <span className="text-xs text-gray-400">
                            {serviceName}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Source */}
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {SOURCE_CHANNEL_LABELS[submission.sourceChannel] ?? submission.sourceChannel}
                      </span>
                    </TableCell>

                    {/* Submitted date */}
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(submission.submittedAt)}
                    </TableCell>

                    {/* Archived / updated date */}
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(submission.updatedAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onView(submission);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restore
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(submission.id, 'new');
                              }}>
                                To New
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(submission.id, 'pending');
                              }}>
                                To Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(submission.id, 'completed');
                              }}>
                                To Completed
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(submission.id);
                            }}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this submission?
              This action cannot be undone and the record will be removed entirely.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}