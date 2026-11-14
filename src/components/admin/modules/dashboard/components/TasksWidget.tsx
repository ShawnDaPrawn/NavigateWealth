import { Skeleton } from '../../../../ui/skeleton';
import { DsButton, DsCard, DsCardHead, DsMeta, DsPill, DsState } from '../../../layout/page';
import type { DsTone } from '../../../layout/page';
import { useDashboardData } from '../hooks';
import { getPriorityLabel, isTaskOverdue } from '../utils';
import type { TaskPriority, TasksWidgetProps } from '../types';
import { CardError } from './CardError';

const PRIORITY_TONE: Record<TaskPriority, DsTone> = {
  critical: 'bad',
  high: 'bad',
  medium: 'warn',
  low: 'neutral',
};

/** Due today (DB-Main board): one row per task, priority first, Open on the right. */
export function TasksWidget({
  onNewTask,
  onModuleChange,
  onViewTask,
  maxTasks = 5,
}: TasksWidgetProps) {
  // Only the tasks query gates this widget, so the fastest data on the page
  // isn't held back by the slowest.
  const { tasks, loadingStates, errors, refetchTasks } = useDashboardData();
  const loading = loadingStates.tasks;
  const handleViewAll = () => onModuleChange?.('tasks');
  const displayTasks = tasks.slice(0, maxTasks);

  return (
    <DsCard className="fill" aria-label="Due today">
      <DsCardHead
        title="Due today"
        actions={
          <>
            <DsButton size="sm" onClick={onNewTask ?? handleViewAll}>
              New task
            </DsButton>
            <DsButton size="sm" variant="ghost" onClick={handleViewAll}>
              View all
            </DsButton>
          </>
        }
      />
      {loading ? (
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="ds-todo-row">
              <Skeleton className="h-[22px] w-16 rounded-full" />
              <div className="grow space-y-1.5">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      ) : errors.tasks ? (
        <div className="ds-card-b">
          <CardError title="Couldn't load tasks due today" onRetry={refetchTasks} />
        </div>
      ) : displayTasks.length === 0 ? (
        <DsState
          title="Nothing due today"
          className="min-h-[200px]"
          action={
            <DsButton size="sm" onClick={onNewTask ?? handleViewAll}>
              New task
            </DsButton>
          }
        >
          Tasks due today show up here.
        </DsState>
      ) : (
        <div>
          {displayTasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const details = [task.category, overdue ? 'Overdue' : null].filter(Boolean);
            return (
              <div key={task.id} className="ds-todo-row">
                <DsPill tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>
                  {getPriorityLabel(task.priority)}
                </DsPill>
                <div className="grow">
                  <b className="truncate">{task.title}</b>
                  {details.length > 0 && (
                    <DsMeta className={overdue ? '!text-[#b91c1c]' : undefined}>
                      {details.join(' · ')}
                    </DsMeta>
                  )}
                </div>
                <DsButton
                  size="sm"
                  onClick={() => onViewTask?.(task.id)}
                  aria-label={`Open ${task.title}`}
                >
                  Open
                </DsButton>
              </div>
            );
          })}
        </div>
      )}
    </DsCard>
  );
}
