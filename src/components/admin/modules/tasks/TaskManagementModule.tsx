/**
 * Task Management Module
 * Full Trello-style Kanban board with Supabase backend
 * Navigate Wealth Admin Dashboard
 */

import { useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search, Filter, Plus, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { PageHeader, StatCard, NavTabsList, NavTabsTrigger, useUrlState } from '../../layout/page';
import { useTasks, useTaskStats, useTaskBoard } from './hooks';
import { TaskColumn } from './components/TaskColumn';
import { TaskFormModal } from './components/TaskFormModal';
import { ArchivedTasksView } from './components/ArchivedTasksView';
import { TasksSkeleton } from './components/TasksSkeleton';
import { STATUS_LABELS } from './constants';
import { Button } from '../../../ui/button';
import { useCurrentUserPermissions } from '../personnel';

const TASK_TABS = ['board', 'archived'] as const;

interface TaskManagementModuleProps {
  /** When provided, auto-opens the task detail modal for this task ID on mount */
  initialTaskId?: string | null;
}

export function TaskManagementModule({ initialTaskId }: TaskManagementModuleProps = {}) {
  const { data: tasks = [], isLoading, error } = useTasks();
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
    setShowArchived,
    tasksByStatus,
    visibleColumns,
    handleDragEnd,
    handleCreateTask,
    handleEditTask,
    handleViewTask,
    handleCloseModal,
    handleModeChange,
  } = useTaskBoard(tasks);

  // Board and Archived are tabs kept in the address (?tab=archived).
  const [tab, setTab] = useUrlState('tab', 'board', TASK_TABS);
  useEffect(() => {
    setShowArchived(tab === 'archived');
  }, [tab, setShowArchived]);

  // ── Deep Link: auto-open task detail when initialTaskId is provided ──
  const deepLinkProcessed = useRef(false);
  useEffect(() => {
    if (!initialTaskId || deepLinkProcessed.current || isLoading || tasks.length === 0) return;
    const task = tasks.find((t) => t.id === initialTaskId);
    if (task) {
      handleViewTask(task);
      deepLinkProcessed.current = true;
    }
  }, [initialTaskId, tasks, isLoading, handleViewTask]);

  // Reset deep-link flag when initialTaskId changes
  useEffect(() => {
    if (!initialTaskId) {
      deepLinkProcessed.current = false;
    }
  }, [initialTaskId]);

  if (isLoading) {
    return <TasksSkeleton />;
  }

  // Check if error is because table doesn't exist
  if (error) {
    const errorObj = error as unknown as Record<string, unknown>;
    const errorMessage = String(
      errorObj.message || (error as Error).message || 'An unexpected error occurred',
    );

    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="text-center max-w-md mx-auto p-8 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-red-900 font-semibold mb-2">Unable to load tasks</h3>
          <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
          <Button onClick={() => window.location.reload()} variant="destructive">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="All tasks" value={stats?.total || 0} meta="Active tasks on board" />
          <StatCard
            label="To do"
            value={stats?.new || 0}
            meta="Needs attention"
            tone={(stats?.new || 0) > 0 ? 'attention' : 'default'}
          />
          <StatCard label="In progress" value={stats?.in_progress || 0} meta="Currently active" />
          <StatCard label="Completed" value={stats?.completed || 0} meta="Finished tasks" />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as (typeof TASK_TABS)[number])}
          className="gap-5"
        >
          <NavTabsList aria-label="To-Do">
            <NavTabsTrigger value="board">Board</NavTabsTrigger>
            <NavTabsTrigger value="archived" count={stats?.archived || 0}>
              Archived
            </NavTabsTrigger>
          </NavTabsList>

          <TabsContent value="archived" className="mt-0">
            <ArchivedTasksView
              tasks={tasks.filter((t) => t.status === 'archived')}
              onViewTask={handleViewTask}
            />
          </TabsContent>

          <TabsContent value="board" className="mt-0 space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-2 max-w-3xl">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks by title, description, or tags..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-gray-400"
                />
              </div>
              <div className="w-px h-6 bg-gray-200 hidden md:block"></div>
              <div className="w-full md:w-auto relative">
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value as typeof filters.status })
                  }
                  className="w-full md:w-[180px] pl-3 pr-8 py-2 text-sm bg-gray-50 hover:bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-0 cursor-pointer font-medium text-gray-700 appearance-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">{STATUS_LABELS.new}</option>
                  <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                  <option value="completed">{STATUS_LABELS.completed}</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Kanban Board */}
            <div className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 sm:snap-none sm:gap-6">
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
        </Tabs>

        {/* Task Form Modal */}
        <TaskFormModal
          key={selectedTask?.id || 'new'}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          task={selectedTask}
          mode={modalMode}
          onModeChange={handleModeChange}
        />
      </div>
    </div>
  );
}
