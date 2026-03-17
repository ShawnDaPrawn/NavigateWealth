import { useState, useEffect } from 'react';
import type { Task, CreateTaskInput, TaskStatus, TaskPriority, TaskCategory, TaskChecklistItem, ReminderFrequency } from '../types';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks';
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_OPTIONS } from '../constants';
import { communicationApi } from '../../communication/api';
import { projectId } from '../../../../../utils/supabase/info';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';
import { Separator } from '../../../../ui/separator';
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
import { Paperclip, X, File as FileIcon, Trash2, Upload, Loader2, Plus, CheckSquare, GripVertical, MessageSquare, Send, User, Activity, AlignLeft, Calendar, Tag as TagIcon, Layout, Eye, CreditCard, ChevronDown, Bell, Pencil } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner@2.0.3';

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

interface TaskComment {
  id: string;
  text: string;
  taskId: string;
  createdAt: string;
  userId?: string; // In a real app, we'd have user info
  userName?: string; 
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  mode: 'create' | 'edit' | 'view';
  onModeChange?: (mode: 'create' | 'edit' | 'view') => void;
}

export function TaskFormModal({ isOpen, onClose, task, mode, onModeChange }: TaskFormModalProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  
  // Checklist state
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);

  // Comments state
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  // Delete and Archive confirmation dialogs state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<CreateTaskInput>>({
    title: '',
    description: '',
    status: 'new',
    priority: 'medium',
    reminder_frequency: null,
    is_template: false,
    due_date: null,
    assignee_initials: '',
    tags: [],
    category: undefined,
  });

  const [tagsInput, setTagsInput] = useState('');

  const [tempId, setTempId] = useState<string | null>(null);
  
  // Track if form has been modified
  const [isModified, setIsModified] = useState(false);

  // Title edit mode: in create mode always editable; in edit/view mode, starts as display text
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        reminder_frequency: task.reminder_frequency || null,
        is_template: task.is_template,
        due_date: task.due_date,
        assignee_initials: task.assignee_initials || '',
        tags: task.tags || [],
        category: task.category,
      });
      setTagsInput(task.tags?.join(', ') || '');
      fetchAttachments(task.id);
      fetchChecklist(task.id);
      fetchComments(task.id);
      setTempId(null);
      setIsTitleEditing(false);
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'new',
        priority: 'medium',
        reminder_frequency: null,
        is_template: false,
        due_date: null,
        assignee_initials: '',
        tags: [],
        category: undefined,
      });
      setTagsInput('');
      setAttachments([]);
      setChecklistItems([]);
      setIsTitleEditing(false);
      // Generate a temporary ID for new task attachments
      const newTempId = crypto.randomUUID();
      setTempId(newTempId);
    }
  }, [task, isOpen]);

  const getAuthToken = () => {
    try {
      const storageKey = `sb-${projectId}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored).access_token;
      }
    } catch (e) {}
    return null;
  };

  const fetchAttachments = async (taskId: string) => {
    setIsLoadingAttachments(true);
    try {
      const token = getAuthToken();
      // Using /todo/ endpoints for now as tasks module might share backend or needs new endpoint
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/todo/attachments/${taskId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const fetchChecklist = async (taskId: string) => {
    setIsLoadingChecklist(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/task-checklists/${taskId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setChecklistItems(data.checklist || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const fetchComments = async (taskId: string) => {
    setIsLoadingComments(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/task-comments/${taskId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    const targetId = task?.id || tempId;
    if (!targetId) return;

    try {
      const token = getAuthToken();
      // In a real app we'd get the user info from context/auth
      // For now we'll assume "Super Admin" if no user info is available
      const commentData = {
        text: newComment,
        userName: 'Super Admin', // Default fallback as per requirement
      };

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/task-comments/${targetId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ comment: commentData })
      });

      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]); // Add new comment to top
        setNewComment('');
      }
    } catch (e) {
      console.error('Error adding comment:', e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const targetId = task?.id || tempId;
    if (!targetId) return;

    try {
      const token = getAuthToken();
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/task-comments/${targetId}/${commentId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (e) {
      console.error('Error deleting comment:', e);
    }
  };

  const saveChecklist = async (taskId: string, items: TaskChecklistItem[]) => {
    try {
      const token = getAuthToken();
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/task-checklists/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ checklist: items })
      });
    } catch (e) {
      console.error('Error saving checklist:', e);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem: TaskChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      completed: false
    };
    
    const updatedList = [...checklistItems, newItem];
    setChecklistItems(updatedList);
    setNewChecklistItem('');
    
    const targetId = task?.id || tempId;
    if (targetId) {
      await saveChecklist(targetId, updatedList);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    const updatedList = checklistItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(updatedList);
    
    const targetId = task?.id || tempId;
    if (targetId) {
      await saveChecklist(targetId, updatedList);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    const updatedList = checklistItems.filter(item => item.id !== itemId);
    setChecklistItems(updatedList);
    
    const targetId = task?.id || tempId;
    if (targetId) {
      await saveChecklist(targetId, updatedList);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setChecklistItems(items);

    const targetId = task?.id || tempId;
    if (targetId) {
      await saveChecklist(targetId, items);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetId = task?.id || tempId;
    if (!targetId) return;

    setIsUploading(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/todo/attachments/${targetId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAttachments(prev => [...prev, data.attachment]);
      } else {
        alert('Failed to upload file');
      }
    } catch (e) {
      console.error(e);
      alert('Error uploading file');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const targetId = task?.id || tempId;
    if (!targetId) return;
    
    // Store the attachment to delete and show dialog
    setAttachmentToDelete(attachmentId);
  };
  
  const confirmDeleteAttachment = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent auto-close
    if (!attachmentToDelete) return;
    
    const targetId = task?.id || tempId;
    if (!targetId) return;
    
    try {
        const token = getAuthToken();
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/todo/attachments/${targetId}/${attachmentToDelete}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
            setAttachments(prev => prev.filter(a => a.id !== attachmentToDelete));
        }
    } catch (e) {
        console.error(e);
    } finally {
        setAttachmentToDelete(null);
    }
  };

  const ensureReminderTemplateExists = async () => {
    try {
      const templates = await communicationApi.getAllTemplates();
      const existing = templates.find(t => t.name === 'Task Reminder');
      
      if (!existing) {
        await communicationApi.createTemplate({
          name: 'Task Reminder',
          subject: 'Task Reminder: {{task_title}}',
          title: 'Task Reminder',
          subtitle: 'You have a pending task',
          greeting: 'Hello {{assignee_name}},',
          bodyHtml: '<p>This is a reminder for the task <strong>{{task_title}}</strong>.</p><p>Please check the admin panel for more details.</p>',
          buttonLabel: 'View Task',
          buttonUrl: '{{task_url}}',
          category: 'internal',
          enabled: true,
          isSystem: true
        });
        // We don't toast here to avoid spamming user, just log
        console.log('Task Reminder email template created');
      }
    } catch (e) {
      console.error('Error checking/creating reminder template:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      toast.error('Task title is required', {
        description: 'Please enter a title for your task to continue.'
      });
      return; 
    }

    if (formData.title.trim().length < 3) {
      toast.warning('Task title is too short', {
        description: 'Please provide a more descriptive title (at least 3 characters).'
      });
      return;
    }

    // Check/create reminder template if frequency is set
    if (formData.reminder_frequency) {
      ensureReminderTemplateExists();
    }

    // Parse tags from comma-separated input
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const taskData = {
      ...formData,
      tags,
    };

    if (task) {
      // Existing task — always update, regardless of whether mode is 'edit' or 'view'
      // WORKAROUND: Previously checked `mode === 'edit' && task` but when the user
      // opened a task in 'view' mode, made changes, and submitted, the condition
      // failed and fell through to createTask, producing a duplicate card.
      // Proper fix: check task existence (not mode) to decide create vs update.
      await updateTask.mutateAsync({
        id: task.id,
        ...taskData,
      });
    } else {
      // No existing task — create a new one
      // Use the tempId as the actual ID for the new task to link attachments
      await createTask.mutateAsync({
        id: tempId || undefined,
        ...taskData
      } as CreateTaskInput);
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!task) return;
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    if (!task) return;
    
    // Close the modal immediately before deletion to prevent any lingering UI
    onClose();
    setShowDeleteDialog(false);
    
    // Small delay to ensure modal closes before deletion starts
    setTimeout(async () => {
      try {
        await deleteTask.mutateAsync(task.id);
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }, 100);
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task) return;
    
    updateTask.mutate({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  };

  const handleArchive = () => {
    if (!task) return;
    setShowArchiveDialog(true);
  };
  
  const confirmArchive = () => {
    if (!task) return;
    
    updateTask.mutate({
      id: task.id,
      status: 'archived',
    });
    setShowArchiveDialog(false);
    onClose();
  };

  const isViewMode = mode === 'view';

  // Don't render modal content if not open to avoid flash of content
  if (!isOpen) {
    return null;
  }

  return (
    <div className="contents">
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 overflow-hidden bg-white flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-white shrink-0">
             <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                   {mode === 'create' ? 'Create New Task' : 'Task Details'}
                </DialogTitle>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
             {/* MAIN COLUMN (Left) */}
             <div className="flex-1 p-6 md:p-8 space-y-8 bg-white">
                
                {/* Title Section */}
                <div className="flex items-start gap-4">
                   <div className="mt-2 text-gray-500 shrink-0"><CreditCard className="w-5 h-5" /></div>
                   <div className="flex-1 min-w-0">
                      <Label htmlFor="task-title" className="sr-only">Task Title</Label>
                      {mode === 'create' || isTitleEditing ? (
                        <Input 
                           id="task-title"
                           value={formData.title} 
                           onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                           onBlur={() => { if (mode !== 'create') setIsTitleEditing(false); }}
                           autoFocus={isTitleEditing}
                           className="text-lg font-semibold h-10" 
                           placeholder="Enter task title"
                        />
                      ) : (
                        <div
                          className="group flex items-center gap-2 cursor-pointer rounded-md px-3 py-1.5 -ml-3 hover:bg-gray-50 transition-colors min-h-[40px]"
                          onClick={() => setIsTitleEditing(true)}
                          title="Click to edit title"
                        >
                          <h2 className="text-lg font-semibold text-gray-900 truncate">
                            {formData.title || 'Untitled Task'}
                          </h2>
                          <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      )}
                      <div className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                         Status: <span className="font-medium text-gray-900">{STATUS_LABELS[formData.status as TaskStatus] || formData.status}</span>
                      </div>
                   </div>
                </div>

                {/* Meta Data Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pl-9">
                   {/* Assignee */}
                   <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase">Assignee</Label>
                      <div className="flex items-center gap-2">
                         {formData.assignee_initials ? (
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200" title="Assignee">
                               {formData.assignee_initials}
                            </div>
                         ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                               <User className="w-4 h-4" />
                            </div>
                         )}
                         <Input 
                            value={formData.assignee_initials || ''} 
                            onChange={(e) => setFormData({ ...formData, assignee_initials: e.target.value })}
                            className="h-8 text-sm" 
                            placeholder="Initials"
                            maxLength={3}
                         />
                      </div>
                   </div>

                   {/* Priority */}
                   <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(val) => setFormData({ ...formData, priority: val as TaskPriority })}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
                          <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
                          <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
                          <SelectItem value="critical">{PRIORITY_LABELS.critical}</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   
                   {/* Due Date */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase">Due Date</Label>
                      <Input
                        type="date"
                        value={formData.due_date ? formData.due_date.split('T')[0] : ''}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
                        className="h-8 text-xs"
                      />
                   </div>

                   {/* Tags */}
                   <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase">Tags</Label>
                      <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Add tags..."
                        className="h-8 text-xs"
                      />
                   </div>
                </div>

                {/* Description Section */}
                <div className="space-y-3">
                   <div className="flex items-center gap-3">
                      <div className="text-gray-500"><AlignLeft className="w-5 h-5" /></div>
                      <h3 className="font-medium text-gray-900">Description</h3>
                   </div>
                   <div className="pl-9">
                     <Textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Add a more detailed description..."
                        className="min-h-[120px] resize-y text-sm"
                      />
                   </div>
                </div>

                {/* Checklist Section */}
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="text-gray-500"><CheckSquare className="w-5 h-5" /></div>
                         <h3 className="font-medium text-gray-900">Checklist</h3>
                      </div>
                   </div>
                   
                   <div className="pl-9 space-y-4">
                     {/* Progress Bar */}
                     {checklistItems.length > 0 && (
                       <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                         <span className="text-xs font-medium w-8 text-right">
                           {Math.round((checklistItems.filter(i => i.completed).length / checklistItems.length) * 100)}%
                         </span>
                         <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-green-500 transition-all duration-300"
                             style={{ width: `${Math.round((checklistItems.filter(i => i.completed).length / checklistItems.length) * 100)}%` }}
                           />
                         </div>
                       </div>
                     )}

                     {/* Checklist Items */}
                     <DragDropContext onDragEnd={handleDragEnd}>
                       <Droppable droppableId="checklist">
                         {(provided) => (
                           <div
                             {...provided.droppableProps}
                             ref={provided.innerRef}
                             className="space-y-2"
                           >
                             {checklistItems.map((item, index) => (
                               <Draggable key={item.id} draggableId={item.id} index={index}>
                                 {(provided, snapshot) => (
                                   <div
                                     ref={provided.innerRef}
                                     {...provided.draggableProps}
                                     className={`flex items-center gap-3 group p-2 hover:bg-gray-50 rounded-md transition-colors ${snapshot.isDragging ? 'bg-white shadow-lg z-50 ring-1 ring-gray-200' : ''}`}
                                   >
                                     <div
                                       {...provided.dragHandleProps}
                                       className="text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600"
                                     >
                                       <GripVertical className="h-4 w-4" />
                                     </div>
                                     <Checkbox
                                       id={`checklist-${item.id}`}
                                       checked={item.completed}
                                       onCheckedChange={() => handleToggleChecklistItem(item.id)}
                                     />
                                     <Label 
                                       htmlFor={`checklist-${item.id}`}
                                       className={`flex-1 text-sm cursor-pointer ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                                     >
                                       {item.text}
                                     </Label>
                                     <button
                                       type="button"
                                       onClick={() => handleDeleteChecklistItem(item.id)}
                                       className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                       <X className="h-4 w-4" />
                                     </button>
                                   </div>
                                 )}
                               </Draggable>
                             ))}
                             {provided.placeholder}
                           </div>
                         )}
                       </Droppable>
                     </DragDropContext>

                     {/* Add Item Input */}
                     <div className="pl-8">
                       <div className="flex gap-2">
                         <Input
                           value={newChecklistItem}
                           onChange={(e) => setNewChecklistItem(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                           placeholder="Add an item..."
                           className="flex-1 h-9 text-sm"
                         />
                         <Button 
                           type="button"
                           onClick={handleAddChecklistItem}
                           disabled={!newChecklistItem.trim()}
                           variant="secondary"
                           className="shrink-0 h-9"
                         >
                           Add
                         </Button>
                       </div>
                     </div>
                   </div>
                </div>

                 {/* Attachments Section */}
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="text-gray-500"><Paperclip className="w-5 h-5" /></div>
                         <h3 className="font-medium text-gray-900">Attachments</h3>
                      </div>
                      <div>
                        <input 
                          type="file" 
                          id="file-upload" 
                          className="hidden" 
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                        <label 
                          htmlFor="file-upload" 
                          className={`text-xs font-medium flex items-center gap-2 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-md transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Add
                        </label>
                      </div>
                   </div>
                   
                   <div className="pl-9 space-y-3">
                      {attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors group">
                           <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0">
                              <FileIcon className="h-5 w-5 text-gray-500" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-gray-900 hover:underline truncate block">
                                 {att.name}
                              </a>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                 <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                                 <span>•</span>
                                 <span>{(att.size / 1024).toFixed(1)} KB</span>
                                 <span>•</span>
                                 <button 
                                    onClick={() => handleDeleteAttachment(att.id)}
                                    className="text-gray-500 hover:text-red-600 underline"
                                 >
                                    Delete
                                 </button>
                              </div>
                           </div>
                        </div>
                      ))}
                      {attachments.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No attachments</div>
                      )}
                   </div>
                </div>

                {/* Activity Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="text-gray-500"><Activity className="w-5 h-5" /></div>
                       <h3 className="font-medium text-gray-900">Activity</h3>
                    </div>
                    
                    <div className="pl-9 space-y-6">
                       {/* Comment Input */}
                       <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                             <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-2">
                             <Textarea 
                                placeholder="Write a comment..." 
                                className="min-h-[80px] text-sm resize-y"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                             />
                             {newComment.trim() && (
                               <div className="flex justify-end">
                                 <Button 
                                    size="sm" 
                                    onClick={handleAddComment} 
                                    disabled={isLoadingComments}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    {isLoadingComments ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    Save Comment
                                 </Button>
                               </div>
                             )}
                          </div>
                       </div>

                       {/* Comment List */}
                       <div className="space-y-6">
                          {comments.map(comment => (
                             <div key={comment.id} className="flex gap-3 text-sm group">
                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 uppercase border border-purple-200">
                                   {(comment.userName || 'S').charAt(0)}
                                </div>
                                <div className="space-y-1 flex-1">
                                   <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900">{comment.userName || 'Super Admin'}</span>
                                      <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                                   </div>
                                   <div className="text-gray-800 leading-relaxed">
                                      {comment.text}
                                   </div>
                                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                      <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-gray-500 hover:text-red-600 hover:underline">Delete</button>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                </div>
             </div>

             {/* RIGHT COLUMN (Sidebar) */}
             <div className="w-full md:w-[240px] bg-gray-50 p-6 space-y-6 border-t md:border-l md:border-t-0 border-gray-200">
                
                {/* Reminders */}
                <div className="space-y-3">
                   <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminders</h4>
                   <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                         <Bell className="w-4 h-4 text-purple-600" />
                         <span>Set Reminder</span>
                      </div>
                      <Select
                        value={formData.reminder_frequency || 'none'}
                        onValueChange={(val) => setFormData({ ...formData, reminder_frequency: val === 'none' ? null : val as ReminderFrequency })}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="Frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Reminder</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="every_2_days">Every 2 Days</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-gray-500 leading-tight">
                        Sends an email to the assignee at the selected interval.
                      </p>
                   </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                   <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</h4>
                   <Button variant="outline" onClick={handleArchive} className="w-full justify-start gap-2 h-9">
                      <Loader2 className="w-4 h-4 text-gray-500" /> Archive
                   </Button>
                   <Button variant="outline" onClick={handleDelete} className="w-full justify-start gap-2 h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Trash2 className="w-4 h-4" /> Delete
                   </Button>
                </div>
             </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 bg-white border-t flex items-center justify-end gap-3 z-10">
             <Button
                type="button"
                variant="outline"
                onClick={onClose}
             >
                Close
             </Button>
             <Button
                type="submit"
                onClick={handleSubmit}
                disabled={createTask.isPending || updateTask.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
             >
                {createTask.isPending || updateTask.isPending ? (
                   <div className="contents">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                   </div>
                ) : (
                   mode === 'create' ? 'Create Task' : 'Save Changes'
                )}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Archive Task Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this task?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Attachment Confirmation Dialog */}
      <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => {
        if (!open) setAttachmentToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attachment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAttachment}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}