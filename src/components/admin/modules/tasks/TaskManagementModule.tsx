/**
 * To-Do (Task Management) Module
 * Kanban board with Supabase backend. A task opens as a page of its own,
 * kept in the address (?task=<id>, or ?task=new for a new task).
 * Navigate Wealth Admin Dashboard
 */

import { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  DsButton,
  DsPage,
  PageHeader,
  NavTabsList,
  NavTabsTrigger,
  ErrorState,
  useBreadcrumbTrail,
  useRecordInUrl,
  useUrlState,
} from '../../layout/page';
import { ClearFiltersButton, FilterChip, FilterStatCard } from '../../layout/page/FilterControls';
import { useTasks, useTaskStats, useTaskBoard } from './hooks';
import { TaskColumn } from './components/TaskColumn';
import { TaskPage } from './components/TaskPage';
import { ArchivedTasksView } from './components/ArchivedTasksView';
import { TaskBoardBodySkeleton } from './components/TasksSkeleton';
import { STATUS_DISPLAY_LABELS } from './constants';
import type { TaskStatus } from './types';
import { useCurrentUserPermissions } from '../personnel';

const TASK_TABS = ['board', 'archived'] as const;
/** The board's status filter: a stat card or the Status chip sets it. */
const TASK_STATUS_FILTERS = ['all', 'open', 'new', 'in_progress', 'completed'] as const;
type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number];

const COLUMNS_FOR_FILTER: Record<TaskStatusFilter, TaskStatus[]> = {
  all: ['new', 'in_progress', 'completed'],
  open: ['new', 'in_progress'],
  new: ['new'],
  in_progress: ['in_progress'],
  completed: ['completed'],
};

/** The address names a new task with this id. */
const NEW_TASK = 'new';

export function TaskManagementModule() {
  const { data: tasks = [], isLoading, error, refetch } = useTasks();
  const { data: stats } = useTaskStats();
  const { canDo } = useCurrentUserPermissions();

  const canCreate = canDo('tasks', 'create');
  const canEditTask = canDo('tasks', 'edit');
  const canDeleteTask = canDo('tasks', 'delete');

  const {
    filters,
    setFilters,
    isModalOpen,
    selectedTask,
    modalMode,
    tasksByStatus,
    handleDragEnd,
    handleCreateTask,
    handleEditTask,
    handleViewTask,
    handleCloseModal,
  } = useTaskBoard(tasks);

  // Board and Archived are tabs, and the status filter is kept with them
  // (?tab=archived, ?status=open).
  const [tab, setTab] = useUrlState('tab', 'board', TASK_TABS);
  const [statusFilter, setStatusFilter] = useUrlState<TaskStatusFilter>(
    'status',
    'all',
    TASK_STATUS_FILTERS,
  );
  const visibleColumns = COLUMNS_FOR_FILTER[statusFilter];
  const archivedTasks = useMemo(() => tasks.filter((t) => t.status === 'archived'), [tasks]);

  // The open task (or the new-task page) lives in the address. The
  // Dashboard's "Due today" links here with ?module=tasks&task=<id>.
  const openRecordId = isModalOpen ? (selectedTask ? selectedTask.id : NEW_TASK) : null;
  useRecordInUrl('task', openRecordId, {
    // While the list fails to load the address keeps the task; it opens once
    // Try again succeeds (the error state, not "Task not found", explains).
    ready: !isLoading && !error,
    openFromUrl: (id) => {
      if (isLoading || error) return 'waiting';
      if (id === NEW_TASK) {
        if (!canCreate) return 'missing';
        handleCreateTask();
        return 'opened';
      }
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        toast.error('Task not found');
        return 'missing';
      }
      handleViewTask(task);
      return 'opened';
    },
    closeFromUrl: () => handleCloseModal(),
  });

  // Top-bar breadcrumb: Work / To-Do / Board (/ Task), or / New task.
  const tabLabel = tab === 'archived' ? 'Archived' : 'Board';
  useBreadcrumbTrail(
    isModalOpen
      ? selectedTask
        ? [
            {
              label: selectedTask.status === 'archived' ? 'Archived' : 'Board',
              onClick: handleCloseModal,
            },
            { label: 'Task' },
          ]
        : [{ label: 'New task' }]
      : [{ label: tabLabel }],
  );

  if (isModalOpen) {
    return (
      <TaskPage
        key={selectedTask?.id || NEW_TASK}
        onClose={handleCloseModal}
        task={selectedTask}
        mode={modalMode}
        backLabel={
          !selectedTask ? 'To-Do' : selectedTask.status === 'archived' ? 'archived tasks' : 'board'
        }
        canEdit={canEditTask}
        canDelete={canDeleteTask}
      />
    );
  }

  const openCount = (stats?.new || 0) + (stats?.in_progress || 0);
  const toggleStatus = (next: TaskStatusFilter) => {
    setStatusFilter(statusFilter === next ? 'all' : next);
    if (tab !== 'board') setTab('board');
  };
  const filtersActive = statusFilter !== 'all' || filters.search.trim() !== '';
  const boardCount = (stats?.new || 0) + (stats?.in_progress || 0) + (stats?.completed || 0);

  return (
    <DsPage>
      <PageHeader
        title="To-Do"
        description="Track progress, manage workloads and collaborate with your team."
        actions={
          canCreate && (
            <DsButton variant="primary" onClick={handleCreateTask}>
              <Plus aria-hidden="true" />
              New task
            </DsButton>
          )
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TASK_TABS)[number])}
        className="gap-5"
      >
        <NavTabsList aria-label="To-Do views">
          <NavTabsTrigger value="board" count={error || isLoading ? undefined : boardCount}>
            Board
          </NavTabsTrigger>
          <NavTabsTrigger
            value="archived"
            count={error || isLoading ? undefined : (stats?.archived ?? archivedTasks.length)}
          >
            Archived
          </NavTabsTrigger>
        </NavTabsList>

        {isLoading ? (
          <TaskBoardBodySkeleton />
        ) : error ? (
          <ErrorState
            title="Unable to load tasks"
            description="Something went wrong while loading tasks. Nothing you entered was lost."
            onRetry={() => void refetch()}
            details={(error as Error).message || undefined}
          />
        ) : (
          <>
            <TabsContent value="archived" className="mt-0">
              <ArchivedTasksView
                tasks={archivedTasks}
                onViewTask={handleViewTask}
                canEdit={canEditTask}
                canDelete={canDeleteTask}
              />
            </TabsContent>

            <TabsContent value="board" className="mt-0 space-y-5">
              <div role="group" aria-label="Filter tasks by status" className="ds-stats">
                <FilterStatCard
                  label="Open"
                  value={openCount}
                  meta="To do + in progress"
                  active={statusFilter === 'open'}
                  onClick={() => toggleStatus('open')}
                />
                <FilterStatCard
                  label="To do"
                  value={stats?.new || 0}
                  meta="Needs attention"
                  tone={(stats?.new || 0) > 0 ? 'attention' : 'default'}
                  active={statusFilter === 'new'}
                  onClick={() => toggleStatus('new')}
                />
                <FilterStatCard
                  label="In progress"
                  value={stats?.in_progress || 0}
                  meta="Currently active"
                  active={statusFilter === 'in_progress'}
                  onClick={() => toggleStatus('in_progress')}
                />
                <FilterStatCard
                  label="Completed"
                  value={stats?.completed || 0}
                  meta="Finished tasks"
                  active={statusFilter === 'completed'}
                  onClick={() => toggleStatus('completed')}
                />
              </div>

              <div className="ds-toolbar">
                <input
                  type="search"
                  aria-label="Search tasks"
                  placeholder="Search title, description or tags…"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="ds-input sm:min-w-[320px]"
                />
                <div className="flex items-center gap-2">
                  <FilterChip
                    label="Status"
                    value={statusFilter}
                    allValue="all"
                    onChange={setStatusFilter}
                    options={[
                      { value: 'open', label: 'Open', count: openCount },
                      {
                        value: 'new',
                        label: STATUS_DISPLAY_LABELS.new,
                        count: stats?.new || 0,
                      },
                      {
                        value: 'in_progress',
                        label: STATUS_DISPLAY_LABELS.in_progress,
                        count: stats?.in_progress || 0,
                      },
                      {
                        value: 'completed',
                        label: STATUS_DISPLAY_LABELS.completed,
                        count: stats?.completed || 0,
                      },
                    ]}
                  />
                  {filtersActive && (
                    <ClearFiltersButton
                      onClick={() => {
                        setStatusFilter('all');
                        setFilters({ ...filters, search: '' });
                      }}
                    />
                  )}
                </div>
              </div>

              {filtersActive &&
                visibleColumns.every((status) => (tasksByStatus[status] ?? []).length === 0) && (
                  <div
                    role="status"
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-4 py-3 text-sm text-nw-text-2"
                  >
                    <span className="flex-1">No tasks match your filters.</span>
                    <ClearFiltersButton
                      onClick={() => {
                        setStatusFilter('all');
                        setFilters({ ...filters, search: '' });
                      }}
                    />
                  </div>
                )}

              <div>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div
                    className="ds-board"
                    style={
                      visibleColumns.length !== 3
                        ? {
                            gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))`,
                          }
                        : undefined
                    }
                  >
                    {visibleColumns.map((status) => (
                      <TaskColumn
                        key={status}
                        status={status}
                        tasks={tasksByStatus[status]}
                        onEditTask={handleEditTask}
                        onViewTask={handleViewTask}
                        canEdit={canEditTask}
                        canDelete={canDeleteTask}
                      />
                    ))}
                  </div>
                </DragDropContext>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </DsPage>
  );
}
