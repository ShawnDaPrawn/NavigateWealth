/**
 * Submissions — Archived tab
 *
 * Archived submissions as a table: search, a Type chip, "Restore to…" per
 * row and View details / restore / Delete permanently under the row's ⋯.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, MoreHorizontal, Search } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { useConfirm } from '../../../layout/page';
import { ClearFiltersButton, FilterChip } from '../../../layout/page/FilterControls';
import type { Submission, SubmissionStatus, SubmissionType } from '../types';
import { SUBMISSION_STATUS_CONFIG, SUBMISSION_TYPE_CONFIG } from '../constants';

interface ArchivedSubmissionsViewProps {
  submissions: Submission[];
  onView: (submission: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
  onDelete: (id: string) => void;
}

const RESTORE_TO: SubmissionStatus[] = ['new', 'pending', 'completed'];
const TYPES = Object.keys(SUBMISSION_TYPE_CONFIG) as SubmissionType[];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function ArchivedSubmissionsView({
  submissions,
  onView,
  onStatusChange,
  onDelete,
}: ArchivedSubmissionsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [type, setType] = useState<'all' | SubmissionType>('all');
  const { confirm, confirmDialog } = useConfirm();

  const searched = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(
      (s) =>
        s.submitterName?.toLowerCase().includes(q) ||
        s.submitterEmail?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        SUBMISSION_TYPE_CONFIG[s.type]?.label.toLowerCase().includes(q),
    );
  }, [submissions, searchTerm]);

  const filtered = useMemo(
    () => (type === 'all' ? searched : searched.filter((s) => s.type === type)),
    [searched, type],
  );
  const filtersActive = searchTerm.trim() !== '' || type !== 'all';

  const handleDelete = async (submission: Submission) => {
    const ok = await confirm({
      title: 'Delete permanently?',
      description:
        'This permanently deletes the submission and removes the record entirely. This action cannot be undone.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (ok) onDelete(submission.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            type="text"
            aria-label="Search archived submissions"
            placeholder="Search archived submissions…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterChip
            label="Type"
            value={type}
            allValue="all"
            onChange={setType}
            options={TYPES.map((t) => ({
              value: t,
              label: SUBMISSION_TYPE_CONFIG[t].label,
              count: searched.filter((s) => s.type === t).length,
            }))}
          />
          {filtersActive && (
            <ClearFiltersButton
              onClick={() => {
                setSearchTerm('');
                setType('all');
              }}
            />
          )}
        </div>
        <p className="text-sm text-nw-text-3 sm:ml-auto">
          {filtersActive ? `${filtered.length} of ${submissions.length}` : submissions.length}{' '}
          archived
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-nw-line bg-white p-12 text-center">
          <h3 className="mb-1 text-base font-medium text-nw-ink">
            {filtersActive ? 'No archived submissions found' : 'No archived submissions'}
          </h3>
          <p className="max-w-sm text-sm text-nw-text-3">
            {filtersActive
              ? 'Try a different search or clear the filters.'
              : 'Submissions you archive are kept here and can be restored at any time.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-nw-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nw-line text-left text-xs font-medium text-nw-text-3">
                <th className="px-4 py-3 font-medium">Submitter</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer border-b border-nw-line-2 last:border-0 hover:bg-gray-50"
                  onClick={() => onView(s)}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-nw-ink hover:text-nw-violet-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(s);
                      }}
                    >
                      {s.submitterName || 'Unknown'}
                    </button>
                    {s.submitterEmail && (
                      <p className="mt-0.5 text-xs text-nw-text-3">{s.submitterEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-nw-text-2">
                    {SUBMISSION_TYPE_CONFIG[s.type]?.label ?? s.type}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-nw-text-2">
                    {formatDate(s.submittedAt)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Restore to…
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {RESTORE_TO.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onSelect={() => onStatusChange(s.id, status)}
                            >
                              Restore to {SUBMISSION_STATUS_CONFIG[status].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`More actions for ${s.submitterName || 'this submission'}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onSelect={() => onView(s)}>
                            View details
                          </DropdownMenuItem>
                          {RESTORE_TO.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onSelect={() => onStatusChange(s.id, status)}
                            >
                              Restore to {SUBMISSION_STATUS_CONFIG[status].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => void handleDelete(s)}
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            Delete permanently…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
