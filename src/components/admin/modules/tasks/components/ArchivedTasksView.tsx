/**
 * Task Management Module - Archived Tasks View Component
 * Navigate Wealth Admin Dashboard
 *
 * View for managing archived tasks
 * Allows searching, restoring, and permanently deleting archived tasks
 *
 * @module tasks/components/ArchivedTasksView
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Search, Trash2, RotateCcw, MoreHorizontal, Eye, Calendar, Tag } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useUpdateTask, useDeleteTask } from '../hooks';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../constants';
import { getTaskDescriptionPreview, isIssueManagerTask } from '../utils';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '../../../../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';

interface ArchivedTasksViewProps {
  tasks: Task[];
  onBack: () => void;
  onViewTask: (task: Task) => void;
}

/**
 * Archived tasks view component
 * Card list view using the same visual language as native to-do cards
 */
export function ArchivedTasksView({ tasks, onBack, onViewTask }: ArchivedTasksViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower) ||
      task.category?.toLowerCase().includes(searchLower)
    );
  });

  const handleRestore = (task: Task, status: TaskStatus) => {
    updateTask.mutate({
      id: task.id,
      status,
    });
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTask.mutate(taskToDelete);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Archived Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and restore previously archived tasks
            </p>
          </div>
        </div>

        <div className="text-sm font-medium text-gray-500">
          {filteredTasks.length} archived task{filteredTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <Input
          type="text"
          placeholder="Search archived tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 rounded-full bg-gray-50 p-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-1 text-lg font-medium text-gray-900">
              {searchTerm ? 'No matches found' : 'No archived tasks'}
            </h3>
            <p className="max-w-sm text-sm text-gray-500">
              {searchTerm
                ? `No tasks found matching "${searchTerm}". Try adjusting your search.`
                : 'Tasks that you archive will appear here for safe keeping.'}
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
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((task) => {
              const preview = getTaskDescriptionPreview(task);
              const issueManagerTask = isIssueManagerTask(task);

              return (
                <div
                  key={task.id}
                  className="group relative cursor-pointer p-4 transition-colors hover:bg-gray-50/60 sm:p-5"
                  onClick={() => onViewTask(task)}
                >
                  <div
                    className={`absolute bottom-5 left-0 top-5 w-1 rounded-r-full ${
                      task.priority === 'critical' || task.priority === 'high'
                        ? 'bg-red-500'
                        : task.priority === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                  />

                  <div className="pl-4 sm:pl-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_COLORS[task.priority]} bg-opacity-10`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          {issueManagerTask && (
                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                              Issue Manager
                            </span>
                          )}
                          {task.category ? (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                              {task.category}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="break-words text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-purple-700 line-clamp-2">
                          {task.title}
                        </h3>

                        {preview ? (
                          <p className="mt-2 break-words text-xs leading-relaxed text-gray-500 line-clamp-2">
                            {preview}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Archived {format(new Date(task.updated_at), 'MMM d, yyyy')}</span>
                          </div>

                          {task.tags?.length ? (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span>{task.tags.length} tag{task.tags.length === 1 ? '' : 's'}</span>
                            </div>
                          ) : null}

                          {task.assignee_initials ? (
                            <div className="ml-auto flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-purple-200 bg-purple-100 text-[10px] font-bold text-purple-700 shadow-sm">
                                {task.assignee_initials}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

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
                            onViewTask(task);
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
                                handleRestore(task, 'new');
                              }}>
                                To New
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(task, 'in_progress');
                              }}>
                                To In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(task, 'completed');
                              }}>
                                To Completed
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskToDelete(task.id);
                            }}
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this task? This action cannot be undone and the task will be removed from the archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
