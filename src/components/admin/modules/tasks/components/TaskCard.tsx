/**
 * Task Management Module - Task Card Component
 * Navigate Wealth Admin Dashboard
 * 
 * Individual task card displayed in Kanban columns
 * Supports drag-and-drop, quick actions, and detailed view
 * 
 * @module tasks/components/TaskCard
 */

import { Draggable } from '@hello-pangea/dnd';
import { MoreHorizontal, AlertCircle, Calendar, Tag, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../constants';
import { useUpdateTask, useDeleteTask, useDuplicateTask } from '../hooks';
import { getOverdueDays } from '../utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { Button } from '../../../../ui/button';

// ============================================================================
// TYPES
// ============================================================================

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onViewDetails: (task: Task) => void;
  /** Whether current user can edit tasks. Defaults to true for backwards compat. */
  canEdit?: boolean;
  /** Whether current user can delete tasks. Defaults to true for backwards compat. */
  canDelete?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Task card component
 * Displays task information with drag-and-drop and quick actions
 */
export function TaskCard({ task, index, onEdit, onViewDetails, canEdit = true, canDelete = true }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const duplicateTask = useDuplicateTask();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Calculate overdue days using utility
  const overdueDays = getOverdueDays(task);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleStatusChange = (newStatus: TaskStatus) => {
    updateTask.mutate({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  };

  const handleArchive = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateTask.mutate({
      id: task.id,
      status: 'archived',
    });
  };

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteTask.mutate(task.id);
    setShowDeleteDialog(false);
  };

  const handleDuplicate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    duplicateTask.mutate(task.id);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="contents">
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`
              group bg-white rounded-lg border border-gray-200 p-4 relative
              hover:border-purple-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing
              ${snapshot.isDragging ? 'shadow-xl ring-2 ring-purple-500 rotate-2 z-50' : ''}
              ${task.status === 'completed' ? 'bg-gray-50/50' : ''}
            `}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('.no-drag')) {
                onViewDetails(task);
              }
            }}
            onDoubleClick={(e) => {
              if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('.no-drag')) {
                onEdit(task);
              }
            }}
          >
            {/* Priority Strip */}
            <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${
              task.priority === 'high' ? 'bg-red-500' : 
              task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />

            <div className="pl-3">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]} bg-opacity-10`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.is_template && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        Template
                      </span>
                    )}
                  </div>
                  <h3 className={`font-semibold text-sm text-gray-900 leading-snug line-clamp-2 ${
                    task.status === 'completed' ? 'line-through text-gray-500' : ''
                  }`}>
                    {task.title}
                  </h3>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 -mr-2 text-gray-400 hover:text-gray-600 no-drag opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(task);
                    }}>
                      View
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={handleDuplicate}>
                        Duplicate
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem onClick={handleArchive}>
                        Archive
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <div className="contents">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                          Delete
                        </DropdownMenuItem>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description Preview */}
              {task.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {task.due_date && (
                  <div className={`flex items-center gap-1 text-xs ${
                    overdueDays > 0 ? 'text-red-600 font-medium' : 'text-gray-500'
                  }`}>
                    {overdueDays > 0 ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                    <span>
                      {format(new Date(task.due_date), 'MMM d')}
                      {overdueDays > 0 && ` (+${overdueDays}d)`}
                    </span>
                  </div>
                )}
                
                {task.tags && task.tags.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Tag className="w-3 h-3" />
                    <span>{task.tags.length} tag{task.tags.length !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {task.assignee_initials && (
                  <div className="ml-auto w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center border border-purple-200 shadow-sm">
                    {task.assignee_initials}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 no-drag">
                <div className="flex gap-1">
                  {task.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange('completed');
                      }}
                      className="h-7 px-2 text-xs font-medium text-green-700 hover:bg-green-50 hover:text-green-800"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete
                    </Button>
                  )}
                  
                  {task.status === 'new' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange('in_progress');
                      }}
                      className="h-7 px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                    >
                      <ArrowRight className="w-3 h-3 mr-1" />
                      Start
                    </Button>
                  )}

                  {task.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange('in_progress');
                      }}
                      className="h-7 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      <RotateCw className="w-3 h-3 mr-1" />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Draggable>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}