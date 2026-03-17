/**
 * Task Management Module
 * Full Trello-style Kanban board with Supabase backend
 * Navigate Wealth Admin Dashboard
 */

import { useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search, Filter, Archive as ArchiveIcon, Plus, LayoutDashboard, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useTasks, useTaskStats, useTaskBoard } from './hooks';
import { TaskColumn } from './components/TaskColumn';
import { TaskFormModal } from './components/TaskFormModal';
import { ArchivedTasksView } from './components/ArchivedTasksView';
import { TasksSkeleton } from './components/TasksSkeleton';
import { STATUS_LABELS } from './constants';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

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
    setIsModalOpen,
    selectedTask,
    modalMode,
    showArchived,
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

  // ── Deep Link: auto-open task detail when initialTaskId is provided ──
  const deepLinkProcessed = useRef(false);
  useEffect(() => {
    if (!initialTaskId || deepLinkProcessed.current || isLoading || tasks.length === 0) return;
    const task = tasks.find(t => t.id === initialTaskId);
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
    const errorObj = error as Record<string, unknown>;
    const errorMessage = errorObj.message || error.message || 'An unexpected error occurred';
    
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="text-center max-w-md mx-auto p-8 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-red-900 font-semibold mb-2">Unable to load tasks</h3>
          <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="destructive"
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  if (showArchived) {
    return (
      <div className="min-h-screen bg-gray-50/30 pb-10">
        <div className="max-w-[1800px] mx-auto p-6 space-y-8">
          <ArchivedTasksView
            tasks={tasks.filter((t) => t.status === 'archived')}
            onBack={() => setShowArchived(false)}
            onViewTask={handleViewTask}
          />
        </div>
        
        {/* Task Form Modal - Rendered here to support viewing details from archive */}
        <TaskFormModal
          key={selectedTask?.id || 'new'}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          task={selectedTask}
          mode={modalMode}
          onModeChange={handleModeChange}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Task Management</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Track progress, manage workloads, and collaborate with your team
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 px-4 border-gray-200 hover:bg-white hover:text-gray-700 hover:border-gray-300 shadow-sm"
              onClick={() => setShowArchived(true)}
            >
              <ArchiveIcon className="h-4 w-4 mr-2 text-gray-500" />
              Archived
              {stats?.archived ? <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">{stats.archived}</span> : null}
            </Button>
            {canCreate && (
              <Button
                className="h-10 px-6 bg-purple-600 hover:bg-purple-700 shadow-sm transition-all hover:shadow-md"
                onClick={handleCreateTask}
                disabled={!canCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Total Tasks</span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <LayoutDashboard className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.total || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Active tasks on board</div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">To Do</span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.new || 0}</div>
            <div className="text-xs text-blue-600 font-medium mt-1">Needs attention</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">In Progress</span>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.in_progress || 0}</div>
            <div className="text-xs text-amber-600 font-medium mt-1">Currently active</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Completed</span>
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.completed || 0}</div>
            <div className="text-xs text-green-600 font-medium mt-1">Finished tasks</div>
          </div>
        </div>

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
              onChange={(e) => setFilters({ ...filters, status: e.target.value as string })}
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
            <div className="flex gap-6 h-full overflow-x-auto pb-4 px-1">
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