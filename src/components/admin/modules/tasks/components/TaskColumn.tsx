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
import { STATUS_LABELS } from '../constants';
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
    label: STATUS_LABELS.new
  },
  in_progress: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: STATUS_LABELS.in_progress
  },
  completed: {
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    label: STATUS_LABELS.completed
  },
  archived: {
    bg: 'bg-gray-50',
    border: 'border-gray-100',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
    label: 'Archived'
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Task column component
 * Displays tasks in a droppable Kanban column
 */
export function TaskColumn({ status, tasks, onEditTask, onViewTask, canEdit, canDelete }: TaskColumnProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex-1 min-w-[350px] h-full flex flex-col rounded-xl bg-gray-100/50 border border-gray-200">
      {/* Column Header */}
      <div className="p-3 rounded-t-xl border-b bg-white flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.badge.split(' ')[0]}`}></div>
          <h3 className="font-semibold text-gray-900 text-sm">
            {config.label}
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
          {tasks.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 overflow-y-auto p-3 flex flex-col gap-3
              ${snapshot.isDraggingOver ? 'bg-purple-50/50' : ''}
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
            `}
          >
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg m-1">
                <p className="font-medium">No tasks</p>
                <p className="text-xs mt-1">Drag tasks here</p>
              </div>
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