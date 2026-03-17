import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import { CheckSquare, ArrowRight, Plus, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDashboardData } from '../hooks';
import { getPriorityLabel, getPriorityVariant, isTaskOverdue, formatDate } from '../utils';
import type { TasksWidgetProps } from '../types';

export function TasksWidget({ 
  onNewTask, 
  onModuleChange, 
  onViewTask,
  maxTasks = 5 
}: TasksWidgetProps) {
  const { tasks, loading } = useDashboardData();

  const handleViewAll = () => {
    if (onModuleChange) {
      onModuleChange('tasks');
    }
  };

  const displayTasks = tasks.slice(0, maxTasks);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center">
            <CheckSquare className="h-5 w-5 mr-2 text-primary" />
            Due Today
          </CardTitle>
          <CardDescription>Tasks requiring immediate attention</CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={onNewTask}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
          <Button variant="ghost" size="sm" onClick={handleViewAll}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-start space-x-3 mb-2 sm:mb-0">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            ))}
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
            <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
            <p>No tasks due today</p>
            <Button variant="link" onClick={onNewTask} className="mt-2">
              Create a task
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayTasks.map((task) => {
              const overdue = isTaskOverdue(task);
              
              return (
                <div 
                  key={task.id} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${
                    overdue ? 'border-red-200 bg-red-50/30' : ''
                  }`}
                  onClick={() => onViewTask?.(task.id)}
                >
                  <div className="flex items-start space-x-3 mb-2 sm:mb-0">
                    <div className={`p-2 rounded-full flex-shrink-0 mt-0.5 ${
                      overdue ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
                    }`}>
                      {overdue ? <AlertTriangle className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900 line-clamp-1">
                        {task.title}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                        {task.description || 'No description'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto">
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                    <div className={`text-xs flex items-center whitespace-nowrap ${
                      overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
                    }`}>
                      <Clock className="h-3 w-3 mr-1" />
                      {overdue ? 'Overdue' : 'Today'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}