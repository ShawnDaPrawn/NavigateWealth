/**
 * Task Management Module - Archived Tasks View Component
 * Navigate Wealth Admin Dashboard
 * 
 * View for managing archived tasks
 * Allows searching, restoring, and permanently deleting archived tasks
 * 
 * @module tasks/components/ArchivedTasksView
 */

import { useState } from 'react';
import { ArrowLeft, Search, Trash2, RotateCcw, MoreHorizontal, Eye } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useUpdateTask, useDeleteTask } from '../hooks';
import { PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS } from '../constants';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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

// ============================================================================
// TYPES
// ============================================================================

interface ArchivedTasksViewProps {
  tasks: Task[];
  onBack: () => void;
  onViewTask: (task: Task) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Archived tasks view component
 * Table view of archived tasks with restore and delete actions
 */
export function ArchivedTasksView({ tasks, onBack, onViewTask }: ArchivedTasksViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Filter tasks by search term
  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower) ||
      task.category?.toLowerCase().includes(searchLower)
    );
  });

  const handleRestore = (task: Task, status: TaskStatus) => {
    // Optimistic update handled by React Query
    updateTask.mutate({
      id: task.id,
      status,
    });
  };

  const handleDeleteClick = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTask.mutate(taskToDelete);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Archived Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">
              View and restore previously archived tasks
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-500 font-medium">
          {filteredTasks.length} archived task{filteredTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search archived tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {searchTerm ? 'No matches found' : 'No archived tasks'}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              {searchTerm 
                ? `No tasks found matching "${searchTerm}". Try adjusting your search.` 
                : 'Tasks that you archive will appear here for safe keeping.'}
            </p>
            {searchTerm && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="w-[40%]">Task Details</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Archived Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow 
                  key={task.id} 
                  className="group hover:bg-gray-50/50 cursor-pointer transition-colors"
                  onClick={() => onViewTask(task)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors">
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        PRIORITY_COLORS[task.priority]
                      } bg-opacity-10 border border-opacity-20`}
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.category ? (
                      <span className="capitalize text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {task.category}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignee_initials ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">
                          {task.assignee_initials}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(task.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onViewTask(task);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(task, 'new');
                            }}>
                              To New
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(task, 'in_progress');
                            }}>
                              To In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(task, 'completed');
                            }}>
                              To Completed
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(task.id);
                          }}
                          className="text-red-600 focus:text-red-700 focus:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this task? This action cannot be undone and the task will be removed from the archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}