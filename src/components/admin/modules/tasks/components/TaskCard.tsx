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
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '../types';
import { PRIORITY_LABELS } from '../constants';
import { useUpdateTask, useDeleteTask, useDuplicateTask } from '../hooks';
import { getOverdueDays, getTaskDescriptionPreview, isIssueManagerTask } from '../utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { DsButton, DsPill, useConfirm, type DsTone } from '../../../layout/page';
import { cn } from '../../../../ui/utils';

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
export function TaskCard({
  task,
  index,
  onEdit,
  onViewDetails,
  canEdit = true,
  canDelete = true,
}: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const duplicateTask = useDuplicateTask();
  const { confirm, confirmDialog } = useConfirm();
  const descriptionPreview = getTaskDescriptionPreview(task);
  const issueManagerTask = isIssueManagerTask(task);

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

  const handleArchive = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = await confirm({
      title: 'Archive task',
      description: 'Are you sure you want to archive this task?',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    updateTask.mutate({
      id: task.id,
      status: 'archived',
    });
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = await confirm({
      title: 'Delete task',
      description: 'Are you sure you want to delete this task? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteTask.mutate(task.id);
  };

  const handleDuplicate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    duplicateTask.mutate(task.id);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const isDone = task.status === 'completed';
  const when = isDone
    ? task.completed_at
      ? `Completed ${format(new Date(task.completed_at), 'd MMM')}`
      : 'Completed'
    : task.due_date
      ? `Due ${format(new Date(task.due_date), 'd MMM')}${overdueDays > 0 ? ` · ${overdueDays}d overdue` : ''}`
      : 'No due date';

  // The one action the board shows on each card (TD-Board): Start a new task,
  // Complete one in progress, Reopen a finished one. The rest sit under ⋯.
  const primary =
    task.status === 'new'
      ? { label: 'Start', to: 'in_progress' as TaskStatus }
      : task.status === 'in_progress'
        ? { label: 'Complete', to: 'completed' as TaskStatus }
        : isDone
          ? { label: 'Reopen', to: 'in_progress' as TaskStatus }
          : null;

  return (
    <div className="contents">
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              'ds-kcard group cursor-grab active:cursor-grabbing',
              snapshot.isDragging && 'sel z-50',
            )}
            onClick={(e) => {
              if (
                !(e.target as HTMLElement).closest('button') &&
                !(e.target as HTMLElement).closest('.no-drag')
              ) {
                onViewDetails(task);
              }
            }}
            onDoubleClick={(e) => {
              if (
                !(e.target as HTMLElement).closest('button') &&
                !(e.target as HTMLElement).closest('.no-drag')
              ) {
                onEdit(task);
              }
            }}
          >
            <div className="flex flex-wrap items-center gap-1.5 pr-8">
              <DsPill tone={isDone ? 'ok' : (PRIORITY_TONE[task.priority] ?? 'neutral')}>
                {isDone ? 'Done' : (PRIORITY_LABELS[task.priority] ?? task.priority)}
              </DsPill>
              {issueManagerTask && <DsPill tone="info">Issue Manager</DsPill>}
              {task.is_template && <DsPill tone="brand">Template</DsPill>}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More actions for ${task.title}`}
                  className="ds-btn ds-btn-ghost ds-btn-sm no-drag absolute right-2 top-2 !w-8 !justify-center !p-0 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(task);
                  }}
                >
                  View
                </DropdownMenuItem>
                {task.status === 'new' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange('completed');
                    }}
                  >
                    Complete
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={(e) => void handleArchive(e)}>
                    Archive
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <div className="contents">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => void handleDelete(e)}
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    >
                      Delete
                    </DropdownMenuItem>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <b className={cn('line-clamp-2 break-words', isDone && 'text-nw-text-3')}>
              {task.title}
            </b>
            {descriptionPreview && (
              <p className="ds-meta line-clamp-2 break-words">{descriptionPreview}</p>
            )}

            <div className="row no-drag">
              <span
                className={cn(
                  'ds-meta min-w-0 truncate',
                  overdueDays > 0 && !isDone && '!text-[#b91c1c]',
                )}
              >
                {when}
                {task.assignee_initials ? ` · ${task.assignee_initials}` : ''}
              </span>
              {primary && (
                <DsButton
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(primary.to);
                  }}
                >
                  {primary.label}
                </DsButton>
              )}
            </div>
          </div>
        )}
      </Draggable>

      {confirmDialog}
    </div>
  );
}

const PRIORITY_TONE: Record<Task['priority'], DsTone> = {
  low: 'neutral',
  medium: 'warn',
  high: 'bad',
  critical: 'bad',
};
