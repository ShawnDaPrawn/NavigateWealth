/**
 * Task Management Module - Archived tab
 * Navigate Wealth Admin Dashboard
 *
 * Archived tasks as a table: search, a Priority chip, "Restore to…" per row
 * and View details / Delete permanently under the row's ⋯.
 *
 * @module tasks/components/ArchivedTasksView
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, MoreHorizontal, Search } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { useUpdateTask, useDeleteTask } from '../hooks';
import { PRIORITY_LABELS, STATUS_DISPLAY_LABELS } from '../constants';
import { isIssueManagerTask } from '../utils';
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

interface ArchivedTasksViewProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type PriorityFilter = 'all' | TaskPriority;
const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
const RESTORE_TO: TaskStatus[] = ['new', 'in_progress', 'completed'];
/** The board's column names, as the restore menu reads them. */
const RESTORE_LABELS: Partial<Record<TaskStatus, string>> = {
  new: 'New',
  in_progress: STATUS_DISPLAY_LABELS.in_progress,
  completed: STATUS_DISPLAY_LABELS.completed,
};

const PRIORITY_PILL: Record<TaskPriority, string> = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-amber-50 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
};

export function ArchivedTasksView({
  tasks,
  onViewTask,
  canEdit = true,
  canDelete = true,
}: ArchivedTasksViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { confirm, confirmDialog } = useConfirm();

  const searched = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.category?.toLowerCase().includes(searchLower),
    );
  }, [tasks, searchTerm]);

  const filteredTasks = useMemo(
    () => (priority === 'all' ? searched : searched.filter((t) => t.priority === priority)),
    [searched, priority],
  );

  const filtersActive = searchTerm.trim() !== '' || priority !== 'all';

  const handleRestore = (task: Task, status: TaskStatus) => {
    updateTask.mutate({ id: task.id, status });
  };

  const handleDelete = async (task: Task) => {
    const ok = await confirm({
      title: 'Delete permanently?',
      description:
        'This permanently deletes the task and removes it from the archive. This action cannot be undone.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (ok) deleteTask.mutate(task.id);
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
            aria-label="Search archived tasks"
            placeholder="Search archived tasks…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterChip
            label="Priority"
            value={priority}
            allValue="all"
            onChange={setPriority}
            options={PRIORITIES.map((p) => ({
              value: p,
              label: PRIORITY_LABELS[p],
              count: searched.filter((t) => t.priority === p).length,
            }))}
          />
          {filtersActive && (
            <ClearFiltersButton
              onClick={() => {
                setSearchTerm('');
                setPriority('all');
              }}
            />
          )}
        </div>
        <p className="text-sm text-nw-text-3 sm:ml-auto">
          {filtersActive ? `${filteredTasks.length} of ${tasks.length}` : tasks.length} archived
        </p>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-nw-line bg-white p-12 text-center">
          <h3 className="mb-1 text-base font-medium text-nw-ink">
            {filtersActive ? 'No archived tasks found' : 'No archived tasks'}
          </h3>
          <p className="max-w-sm text-sm text-nw-text-3">
            {filtersActive
              ? 'Try a different search or clear the filters.'
              : 'Tasks that you archive will appear here for safe keeping.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-nw-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nw-line text-left text-xs font-medium text-nw-text-3">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className="cursor-pointer border-b border-nw-line-2 last:border-0 hover:bg-gray-50"
                  onClick={() => onViewTask(task)}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-nw-ink hover:text-nw-violet-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewTask(task);
                      }}
                    >
                      {task.title}
                    </button>
                    <p className="mt-0.5 text-xs text-nw-text-3">
                      {[
                        isIssueManagerTask(task) ? 'Issue Manager' : null,
                        task.category,
                        task.assignee_initials,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_PILL[task.priority]}`}
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-nw-text-2">
                    {task.due_date ? format(new Date(task.due_date), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
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
                                onSelect={() => handleRestore(task, status)}
                              >
                                Restore to {RESTORE_LABELS[status]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`More actions for ${task.title}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => onViewTask(task)}>
                            View details
                          </DropdownMenuItem>
                          {canEdit &&
                            RESTORE_TO.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onSelect={() => handleRestore(task, status)}
                              >
                                Restore to {RESTORE_LABELS[status]}
                              </DropdownMenuItem>
                            ))}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => void handleDelete(task)}
                                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                              >
                                Delete permanently…
                              </DropdownMenuItem>
                            </>
                          )}
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
