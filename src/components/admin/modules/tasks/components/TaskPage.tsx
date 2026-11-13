import { useState, useEffect } from 'react';
import type {
  Task,
  CreateTaskInput,
  TaskStatus,
  TaskPriority,
  TaskChecklistItem,
  ReminderFrequency,
} from '../types';
import { useCreateTask, useUpdateTask, useDeleteTask, useDuplicateTask } from '../hooks';
import { STATUS_DISPLAY_LABELS, PRIORITY_LABELS } from '../constants';
import { communicationApi } from '../../communication';
import { api } from '../../../../../utils/api';
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
import {
  Loader2,
  User,
  AlignLeft,
  Bell,
  MoreHorizontal,
  ArrowRight,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { BackLink } from '../../../layout/page/FilterControls';
import { useConfirm } from '../../../layout/page';
import { DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { logger } from '../../../../../utils/logger';
import { useAuth } from '../../../../auth/AuthContext';
import { type Attachment, type TaskComment } from './taskFormModalModel';
import { TaskChecklistSection } from './TaskChecklistSection';
import { TaskAttachmentsSection } from './TaskAttachmentsSection';
import { TaskActivitySection } from './TaskActivitySection';

interface TaskPageProps {
  /** Leaves the page (back to the board or the archive). */
  onClose: () => void;
  task?: Task | null;
  mode: 'create' | 'edit' | 'view';
  /** Where "Back to …" goes, e.g. "board" or "archived tasks". */
  backLabel?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

/**
 * A task as a page of its own (design system: records and long forms are
 * pages). Create and edit share it; the same sections as the old dialog.
 */
export function TaskPage({
  onClose,
  task,
  mode,
  backLabel = 'board',
  canEdit = true,
  canDelete = true,
}: TaskPageProps) {
  const duplicateTask = useDuplicateTask();
  const { confirm, confirmDialog } = useConfirm();
  const [titleError, setTitleError] = useState<string | null>(null);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { user } = useAuth();
  // Comments are signed with the name of the person writing them.
  const commentAuthor = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [_isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [_isLoadingChecklist, setIsLoadingChecklist] = useState(false);

  // Comments state
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

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
      // Generate a temporary ID for new task attachments
      const newTempId = crypto.randomUUID();
      setTempId(newTempId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another task opens; a refetch must not wipe unsaved edits
  }, [task?.id]);

  const fetchAttachments = async (taskId: string) => {
    setIsLoadingAttachments(true);
    try {
      const data = await api.get<{ attachments?: Attachment[] }>(`/todo/attachments/${taskId}`);
      setAttachments(data.attachments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const fetchChecklist = async (taskId: string) => {
    setIsLoadingChecklist(true);
    try {
      const data = await api.get<{ checklist?: TaskChecklistItem[] }>(`/task-checklists/${taskId}`);
      setChecklistItems(data.checklist || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const fetchComments = async (taskId: string) => {
    setIsLoadingComments(true);
    try {
      const data = await api.get<{ comments?: TaskComment[] }>(`/task-comments/${taskId}`);
      setComments(data.comments || []);
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
      const commentData = { text: newComment.trim(), userName: commentAuthor };
      const data = await api.post<{ comment?: TaskComment }>(`/task-comments/${targetId}`, {
        comment: commentData,
      });
      if (data.comment) {
        setComments((prev) => [data.comment!, ...prev]);
        setNewComment('');
      }
    } catch (e) {
      logger.error('Error adding comment', e);
      toast.error('Could not add the comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const targetId = task?.id || tempId;
    if (!targetId) return;

    try {
      await api.delete(`/task-comments/${targetId}/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      logger.error('Error deleting comment', e);
      toast.error('Could not delete the comment. Please try again.');
    }
  };

  const saveChecklist = async (taskId: string, items: TaskChecklistItem[]) => {
    try {
      await api.post(`/task-checklists/${taskId}`, { checklist: items });
    } catch (e) {
      logger.error('Error saving checklist', e);
      toast.error('Could not save the checklist. Please try again.');
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;

    const newItem: TaskChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      completed: false,
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
    const updatedList = checklistItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    setChecklistItems(updatedList);

    const targetId = task?.id || tempId;
    if (targetId) {
      await saveChecklist(targetId, updatedList);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    const updatedList = checklistItems.filter((item) => item.id !== itemId);
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
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<{ attachment?: Attachment }>(
        `/todo/attachments/${targetId}`,
        formData,
      );
      if (data.attachment) {
        setAttachments((prev) => [...prev, data.attachment!]);
      }
    } catch (e) {
      logger.error('Error uploading attachment', e);
      toast.error(`Could not upload ${file.name}. Please try again.`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const targetId = task?.id || tempId;
    if (!targetId) return;
    const name = attachments.find((a) => a.id === attachmentId)?.name;
    const ok = await confirm({
      title: 'Delete attachment?',
      description: `${name ? `"${name}"` : 'This attachment'} will be removed from the task. This cannot be undone.`,
      confirmLabel: 'Delete attachment',
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/todo/attachments/${targetId}/${attachmentId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Attachment removed');
    } catch (e) {
      logger.error('Error deleting attachment', e);
      toast.error('Could not remove the attachment. Please try again.');
    }
  };

  const ensureReminderTemplateExists = async () => {
    try {
      const templates = await communicationApi.getAllTemplates();
      const existing = templates.find((t) => t.name === 'Task Reminder');

      if (!existing) {
        await communicationApi.createTemplate({
          name: 'Task Reminder',
          subject: 'Task Reminder: {{task_title}}',
          title: 'Task Reminder',
          subtitle: 'You have a pending task',
          greeting: 'Hello {{assignee_name}},',
          bodyHtml:
            '<p>This is a reminder for the task <strong>{{task_title}}</strong>.</p><p>Please check the admin panel for more details.</p>',
          buttonLabel: 'View Task',
          buttonUrl: '{{task_url}}',
          category: 'internal',
          enabled: true,
          isSystem: true,
        });
        // We don't toast here to avoid spamming user, just log
        logger.info('Task Reminder email template created');
      }
    } catch (e) {
      console.error('Error checking/creating reminder template:', e);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!formData.title?.trim()) {
      setTitleError('Give the task a title');
      return;
    }

    if (formData.title.trim().length < 3) {
      setTitleError('Use at least 3 characters');
      return;
    }
    setTitleError(null);

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

    try {
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
          ...taskData,
        } as CreateTaskInput);
      }
    } catch {
      // The mutation hooks show the error toast; keep the form open so
      // nothing typed is lost.
      return;
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Delete task',
      description: 'Are you sure you want to delete this task? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTask.mutateAsync(task.id);
    } catch {
      // The mutation hook shows the error toast; stay on the page.
      return;
    }
    onClose();
  };

  const handleArchive = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Archive task',
      description: 'Are you sure you want to archive this task?',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    updateTask.mutate({ id: task.id, status: 'archived' });
    onClose();
  };

  const handleDuplicate = () => {
    if (!task) return;
    duplicateTask.mutate(task.id);
  };

  // Start / Complete / Reopen — the same quick moves as the board cards.
  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task) return;
    setFormData((current) => ({ ...current, status: newStatus }));
    updateTask.mutate({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  };

  const isSaving = createTask.isPending || updateTask.isPending;
  const status = (formData.status as TaskStatus) || 'new';
  const quickMove: { label: string; to: TaskStatus; icon: typeof ArrowRight } | null =
    !task || !canEdit
      ? null
      : status === 'new'
        ? { label: 'Start', to: 'in_progress', icon: ArrowRight }
        : status === 'in_progress'
          ? { label: 'Complete', to: 'completed', icon: CheckCircle2 }
          : status === 'completed'
            ? { label: 'Reopen', to: 'in_progress', icon: RotateCw }
            : null;
  const showMenu = !!task && (canEdit || canDelete);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-6 lg:p-8">
      <BackLink label={`Back to ${backLabel}`} onClick={onClose} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight break-words text-nw-ink">
            {mode === 'create' ? 'New task' : task?.title || 'Untitled task'}
          </h1>
          <p className="mt-1 text-sm text-nw-text-3">
            {mode === 'create'
              ? `Goes into ${STATUS_DISPLAY_LABELS.new}`
              : `Task · ${STATUS_DISPLAY_LABELS[status] || status}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {quickMove && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange(quickMove.to)}
              disabled={updateTask.isPending}
            >
              <quickMove.icon className="h-4 w-4" aria-hidden="true" />
              {quickMove.label}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More task actions">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canEdit && (
                  <DropdownMenuItem onSelect={handleDuplicate}>Duplicate</DropdownMenuItem>
                )}
                {canEdit && status !== 'archived' && (
                  <DropdownMenuItem onSelect={() => void handleArchive()}>Archive</DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void handleDelete()}
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                    >
                      Delete…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : mode === 'create' ? (
              'Create task'
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="flex max-w-[880px] flex-col gap-8 rounded-xl border border-nw-line bg-white p-6"
      >
        {titleError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            Fix 1 field to {mode === 'create' ? 'create' : 'save'} the task
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="task-title">
            Title <span className="text-red-600">*</span>
          </Label>
          <Input
            id="task-title"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (titleError) setTitleError(null);
            }}
            aria-invalid={!!titleError}
            aria-describedby={titleError ? 'task-title-error' : undefined}
            autoFocus={mode === 'create'}
            placeholder="Task title"
          />
          {titleError && (
            <p id="task-title-error" className="text-xs text-red-600">
              {titleError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Assignee</Label>
            <div className="flex items-center gap-2">
              {formData.assignee_initials ? (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-200 bg-purple-100 text-xs font-bold text-purple-700"
                  aria-hidden="true"
                >
                  {formData.assignee_initials}
                </div>
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-400"
                  aria-hidden="true"
                >
                  <User className="h-4 w-4" />
                </div>
              )}
              <Input
                id="task-assignee"
                value={formData.assignee_initials || ''}
                onChange={(e) => setFormData({ ...formData, assignee_initials: e.target.value })}
                placeholder="Initials"
                maxLength={3}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(val) => setFormData({ ...formData, priority: val as TaskPriority })}
            >
              <SelectTrigger id="task-priority" className="w-full">
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

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={formData.due_date ? formData.due_date.split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-reminder" className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-nw-violet" aria-hidden="true" />
              Reminder
            </Label>
            <Select
              value={formData.reminder_frequency || 'none'}
              onValueChange={(val) =>
                setFormData({
                  ...formData,
                  reminder_frequency: val === 'none' ? null : (val as ReminderFrequency),
                })
              }
            >
              <SelectTrigger id="task-reminder" className="w-full">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="every_2_days">Every 2 days</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-nw-text-3">
              Sends an email to the assignee at the selected interval.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-tags">Tags</Label>
          <Input
            id="task-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Add tags… (separate with commas)"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-gray-500">
              <AlignLeft className="h-5 w-5" aria-hidden="true" />
            </div>
            <Label htmlFor="task-description" className="font-medium text-gray-900">
              Description
            </Label>
          </div>
          <div className="pl-9">
            <Textarea
              id="task-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add a more detailed description…"
              className="min-h-[120px] resize-y text-sm"
            />
          </div>
        </div>

        <TaskChecklistSection
          checklistItems={checklistItems}
          newChecklistItem={newChecklistItem}
          setNewChecklistItem={setNewChecklistItem}
          handleAddChecklistItem={handleAddChecklistItem}
          handleToggleChecklistItem={handleToggleChecklistItem}
          handleDeleteChecklistItem={handleDeleteChecklistItem}
          handleDragEnd={handleDragEnd}
        />

        <TaskAttachmentsSection
          attachments={attachments}
          isUploading={isUploading}
          handleFileUpload={handleFileUpload}
          handleDeleteAttachment={handleDeleteAttachment}
        />

        <TaskActivitySection
          comments={comments}
          isLoadingComments={isLoadingComments}
          newComment={newComment}
          setNewComment={setNewComment}
          handleAddComment={handleAddComment}
          handleDeleteComment={handleDeleteComment}
        />
      </form>

      {confirmDialog}
    </div>
  );
}
