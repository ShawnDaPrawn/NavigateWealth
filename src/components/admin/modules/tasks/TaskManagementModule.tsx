/**
 * To-Do (Task Management) Module
 * Kanban board with Supabase backend. A task opens as a page of its own,
 * kept in the address (?task=<id>, or ?task=new for a new task).
 * Navigate Wealth Admin Dashboard
 */

import { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
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
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
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
    ready: !isLoading,
    openFromUrl: (id) => {
      if (isLoading) return 'waiting';
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
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
        <PageHeader
          title="To-Do"
          description="Track progress, manage workloads and collaborate with your team."
          actions={
            canCreate && (
              <Button onClick={handleCreateTask}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New task
              </Button>
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
                <div
                  role="group"
                  aria-label="Filter tasks by status"
                  className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                >
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

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:max-w-md">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      type="text"
                      aria-label="Search tasks"
                      placeholder="Search title, description or tags…"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="bg-white pl-9"
                    />
                  </div>
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

                <div className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex h-full gap-6 overflow-x-auto px-1 pb-4">
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
      </div>
    </div>
  );
}
