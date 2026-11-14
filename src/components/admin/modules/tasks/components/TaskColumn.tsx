/**
 * Task Management Module - Task Column Component
 * Navigate Wealth Admin Dashboard
 *
 * Kanban column for displaying tasks of a specific status
 * Includes droppable area for drag-and-drop functionality
 *
 * @module tasks/components/TaskColumn
 */

import { Droppable } from '@hello-pangea/dnd';
import type { Task, TaskStatus } from '../types';
import { STATUS_DISPLAY_LABELS } from '../constants';
import { TaskCard } from './TaskCard';

// ============================================================================
// TYPES
// ============================================================================

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onViewTask: (task: Task) => void;
  /** Whether current user can edit tasks */
  canEdit?: boolean;
  /** Whether current user can delete tasks */
  canDelete?: boolean;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG = {
  new: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    label: STATUS_DISPLAY_LABELS.new,
  },
  in_progress: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: STATUS_DISPLAY_LABELS.in_progress,
  },
  completed: {
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    label: STATUS_DISPLAY_LABELS.completed,
  },
  archived: {
    bg: 'bg-gray-50',
    border: 'border-gray-100',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
    label: 'Archived',
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Task column component
 * Displays tasks in a droppable Kanban column
 */
export function TaskColumn({
  status,
  tasks,
  onEditTask,
  onViewTask,
  canEdit,
  canDelete,
}: TaskColumnProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="ds-col">
      <div className="ds-col-h">
        <span>{config.label}</span>
        <span className="ds-count">{tasks.length}</span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex min-h-[80px] flex-col gap-2 rounded-lg ${
              snapshot.isDraggingOver ? 'bg-nw-violet-50' : ''
            }`}
          >
            {tasks.length === 0 ? (
              <p className="ds-meta px-1 py-6 text-center">No tasks here. Drag one in.</p>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onEdit={onEditTask}
                  onViewDetails={onViewTask}
                  canEdit={canEdit}
                  canDelete={canDelete}
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
