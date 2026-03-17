/**
 * NoteEditorModal — Full note editor with auto-save and AI summarisation
 *
 * §7 — Presentation + local UI state only
 * §8 — Design System components
 * §8.4 — Figma Make platform constraints respected
 *
 * Features:
 *   - Debounced auto-save (1.5s) for existing notes with status indicator
 *   - Write / Summarise toggle (AI-powered summarisation replaces markdown preview)
 *   - Cmd+S explicit save shortcut
 *   - Colour picker, tags, client linking
 *   - Convert-to-task and delete actions
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Note, NoteColor, CreateNoteInput, UpdateNoteInput } from '../types';
import type { CustomColourLabels } from '../types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS } from '../constants';
import { getColourTooltipLabel } from '../hooks/useColourLabels';
import { useAutoSave } from '../hooks/useAutoSave';
import type { AutoSaveStatus } from '../hooks/useAutoSave';
import { useSummariseNote } from '../hooks/useSummariseNote';
import { MarkdownPreview } from './MarkdownPreview';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
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
import {
  Save,
  Tag,
  User,
  Link2,
  Unlink,
  ListTodo,
  CheckCircle2,
  Trash2,
  Loader2,
  Pencil,
  PenLine,
  Cloud,
  CloudOff,
  HelpCircle,
  Sparkles,
  RotateCcw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { VoiceRecorderButton } from './VoiceRecorderButton';

// ============================================================================
// TYPES
// ============================================================================

interface ClientOption {
  id: string;
  name: string;
}

type EditorMode = 'write' | 'summarise';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  personnelId: string;
  personnelName: string;
  /** Pre-selected client when creating from client drawer */
  defaultClientId?: string | null;
  defaultClientName?: string | null;
  /** Available clients for linking */
  clients?: ClientOption[];
  onSave: (input: CreateNoteInput | UpdateNoteInput) => Promise<void>;
  /** Silent auto-save (no toast, no close) */
  onAutoSave?: (input: UpdateNoteInput) => Promise<void>;
  onDelete?: (noteId: string) => void;
  onConvertToTask?: (noteId: string) => void;
  /** Custom colour labels for tooltip display */
  customColourLabels?: CustomColourLabels;
}

// ============================================================================
// AUTO-SAVE STATUS INDICATOR
// ============================================================================

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  if (status === 'idle') return null;

  const configs: Record<Exclude<AutoSaveStatus, 'idle'>, { icon: React.ReactNode; text: string; className: string }> = {
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      text: 'Saving...',
      className: 'text-gray-400',
    },
    saved: {
      icon: <Cloud className="h-3 w-3" />,
      text: 'Saved',
      className: 'text-green-500',
    },
    error: {
      icon: <CloudOff className="h-3 w-3" />,
      text: 'Save failed',
      className: 'text-red-500',
    },
  };

  const cfg = configs[status];

  return (
    <span className={`flex items-center gap-1 text-[11px] ${cfg.className} transition-opacity`}>
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

// ============================================================================
// MARKDOWN HELP TOOLTIP
// ============================================================================

function MarkdownHelpTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-gray-400 hover:text-gray-500 transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed p-3">
          <p className="font-semibold mb-1">Markdown shortcuts</p>
          <div className="space-y-0.5 text-gray-600">
            <p><code className="bg-gray-100 px-1 rounded">**bold**</code> → <strong>bold</strong></p>
            <p><code className="bg-gray-100 px-1 rounded">*italic*</code> → <em>italic</em></p>
            <p><code className="bg-gray-100 px-1 rounded"># Heading</code> → heading</p>
            <p><code className="bg-gray-100 px-1 rounded">- item</code> → bullet list</p>
            <p><code className="bg-gray-100 px-1 rounded">1. item</code> → numbered list</p>
            <p><code className="bg-gray-100 px-1 rounded">- [ ] task</code> → checklist</p>
            <p><code className="bg-gray-100 px-1 rounded">`code`</code> → <code className="bg-gray-100 px-0.5 text-pink-600 rounded">code</code></p>
            <p><code className="bg-gray-100 px-1 rounded">&gt; quote</code> → blockquote</p>
            <p><code className="bg-gray-100 px-1 rounded">[text](url)</code> → link</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NoteEditorModal({
  isOpen,
  onClose,
  note,
  personnelId,
  personnelName,
  defaultClientId,
  defaultClientName,
  clients = [],
  onSave,
  onAutoSave,
  onDelete,
  onConvertToTask,
  customColourLabels = {},
}: NoteEditorModalProps) {
  const isEditing = !!note;

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [tagsInput, setTagsInput] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('write');

  // ── Summary state ────────────────────────────────────────────────────────
  const [localSummary, setLocalSummary] = useState<string | null>(null);
  const summariseMutation = useSummariseNote();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-save ───────────────────────────────────────────────────────────
  const autoSave = useAutoSave({
    noteId: note?.id,
    isOpen,
    debounceMs: 1500,
    onAutoSave: onAutoSave || (async () => {}),
  });

  // Build the current payload for auto-save
  const buildAutoSavePayload = useCallback((): Omit<UpdateNoteInput, 'id'> => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return { title: title.trim(), content, color, tags, clientId, clientName };
  }, [title, content, color, tagsInput, clientId, clientName]);

  // Trigger auto-save on content changes (only for existing notes with onAutoSave)
  const triggerAutoSave = useCallback(() => {
    if (!isEditing || !onAutoSave || !title.trim()) return;
    autoSave.markDirty(buildAutoSavePayload());
  }, [isEditing, onAutoSave, title, autoSave, buildAutoSavePayload]);

  // ── Reset form when opening ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
      setTagsInput(note.tags.join(', '));
      setClientId(note.clientId || null);
      setClientName(note.clientName || null);
      setIsTitleEditing(false);
      setLocalSummary(note.summary || null);
    } else {
      setTitle('');
      setContent('');
      setColor('default');
      setTagsInput('');
      setClientId(defaultClientId || null);
      setClientName(defaultClientName || null);
      setIsTitleEditing(false);
      setLocalSummary(null);
    }
    setEditorMode('write');
    autoSave.reset();
  }, [note, isOpen, defaultClientId, defaultClientName]);

  // ── Summarise handler ──────────────────────────────────────────────────
  const handleSummarise = useCallback(async () => {
    if (!note?.id || !content.trim()) return;

    // First flush any pending auto-save so the server has the latest content
    await autoSave.flush();

    summariseMutation.mutate(note.id, {
      onSuccess: (data) => {
        setLocalSummary(data.summary);
      },
    });
  }, [note?.id, content, autoSave, summariseMutation]);

  const handleClearSummary = useCallback(() => {
    setLocalSummary(null);
    // Also clear from server via auto-save
    if (isEditing && onAutoSave && note?.id) {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      autoSave.markDirty({ title: title.trim(), content, color, tags, clientId, clientName, summary: null });
    }
  }, [isEditing, onAutoSave, note?.id, title, content, color, tagsInput, clientId, clientName, autoSave]);

  // ── Explicit save ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      // Flush any pending auto-save first
      await autoSave.flush();

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (isEditing && note) {
        await onSave({
          id: note.id,
          title: title.trim(),
          content,
          color,
          tags,
          clientId,
          clientName,
        } as UpdateNoteInput);
      } else {
        await onSave({
          title: title.trim(),
          content,
          personnelId,
          personnelName,
          color,
          tags,
          clientId,
          clientName,
        } as CreateNoteInput);
      }
      onClose();
    } catch {
      // Error handled by mutation hook
    } finally {
      setIsSaving(false);
    }
  }, [title, content, color, tagsInput, clientId, clientName, note, isEditing, personnelId, personnelName, onSave, onClose, autoSave]);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleSave]);

  // ── Change handlers (with auto-save trigger) ───────────────────────────
  const handleTitleChange = (val: string) => {
    setTitle(val);
  };

  const handleTitleBlur = () => {
    if (isEditing) {
      setIsTitleEditing(false);
      triggerAutoSave();
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    // When content changes, invalidate existing summary
    if (localSummary) {
      setLocalSummary(null);
    }
    // Debounce content auto-save
    if (isEditing && onAutoSave && title.trim()) {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      autoSave.markDirty({ title: title.trim(), content: val, color, tags, clientId, clientName, summary: null });
    }
  };

  const handleColorChange = (c: NoteColor) => {
    setColor(c);
    if (isEditing && onAutoSave && title.trim()) {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      autoSave.markDirty({ title: title.trim(), content, color: c, tags, clientId, clientName });
    }
  };

  const handleTagsChange = (val: string) => {
    setTagsInput(val);
  };

  const handleTagsBlur = () => {
    triggerAutoSave();
  };

  const handleClientChange = (val: string) => {
    if (val === '__none__') {
      setClientId(null);
      setClientName(null);
    } else {
      const client = clients.find((c) => c.id === val);
      if (client) {
        setClientId(client.id);
        setClientName(client.name);
      }
    }
    // Auto-save after client change
    setTimeout(triggerAutoSave, 50);
  };

  // ── Flush auto-save before close ────────────────────────────────────────
  const handleClose = useCallback(async () => {
    await autoSave.flush();
    onClose();
  }, [autoSave, onClose]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const colorCfg = NOTE_COLOR_CONFIG[color];
  const isConverted = isEditing && !!note?.convertedToTaskId;

  // Word & character count
  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  }, [content]);

  // ── Voice transcription insert handler ──────────────────────────────────
  const handleTranscriptionInsert = useCallback((text: string) => {
    // Append transcribed text to content, with spacing
    const separator = content.trim() ? '\n\n' : '';
    const newContent = content + separator + text;
    handleContentChange(newContent);
    // Switch to write mode so user can see the inserted text
    setEditorMode('write');
  }, [content, handleContentChange]);

  // Determine if summarise is available (need saved note + content)
  const canSummarise = isEditing && !!content.trim();
  const isSummarising = summariseMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="contents">
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className={`max-w-3xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col ${colorCfg.bg}`}>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${colorCfg.headerBg} ${colorCfg.border}`}>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-bold text-gray-900">
                {isEditing ? 'Edit Note' : 'New Note'}
              </DialogTitle>
              <AutoSaveIndicator status={autoSave.status} />
            </div>
            <div className="flex items-center gap-3">
              {/* Colour picker */}
              <div className="flex items-center gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${NOTE_COLOR_CONFIG[c].dot} ${
                      color === c ? 'border-gray-800 scale-125' : 'border-transparent hover:scale-110'
                    }`}
                    title={getColourTooltipLabel(c, customColourLabels)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title */}
            <div>
              {isEditing && !isTitleEditing ? (
                <div
                  className="group flex items-center gap-2 cursor-pointer rounded-md px-3 py-2 -ml-3 hover:bg-black/5 transition-colors min-h-[44px]"
                  onClick={() => setIsTitleEditing(true)}
                  title="Click to edit title"
                >
                  <h2 className="text-xl font-bold text-gray-900 truncate">
                    {title || 'Untitled Note'}
                  </h2>
                  <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ) : (
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={handleTitleBlur}
                  autoFocus={!isEditing || isTitleEditing}
                  placeholder="Note title..."
                  className="text-xl font-bold border-0 border-b rounded-none px-0 h-auto py-2 focus-visible:ring-0 focus-visible:border-gray-400 bg-transparent placeholder:text-gray-400 placeholder:font-normal"
                />
              )}
            </div>

            {/* Editor toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-gray-200 bg-white/80">
                  <button
                    type="button"
                    onClick={() => setEditorMode('write')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l-md transition-colors ${
                      editorMode === 'write'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('summarise')}
                    disabled={!isEditing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-r-md transition-colors ${
                      editorMode === 'summarise'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    } ${!isEditing ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Summarise
                  </button>
                </div>
                {editorMode === 'write' && (
                  <VoiceRecorderButton
                    onInsertText={handleTranscriptionInsert}
                    disabled={isSaving}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <MarkdownHelpTooltip />
              </div>
            </div>

            {/* Content area — Write or Summarise */}
            <div className="flex-1">
              {editorMode === 'write' ? (
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={'Write your note here...\n\nSupports **bold**, *italic*, # headings, - lists, - [ ] checklists, `code`, > quotes, and [links](url).'}
                  className="min-h-[280px] resize-y text-sm leading-relaxed border border-gray-200 rounded-lg bg-white/60 p-4 focus-visible:ring-1 focus-visible:ring-purple-300 placeholder:text-gray-400"
                />
              ) : (
                /* ── Summarise panel ─────────────────────────────────── */
                <div className="min-h-[280px] border border-gray-200 rounded-lg bg-white/60 overflow-hidden">
                  {/* Summarise toolbar */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        AI Summary
                      </span>
                      {localSummary && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Generated
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {localSummary && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleClearSummary}
                                className="h-7 px-2 text-xs text-gray-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              Remove the AI summary
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSummarise}
                        disabled={!canSummarise || isSummarising}
                        className="h-7 px-3 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                      >
                        {isSummarising ? (
                          <div className="contents">
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            Summarising...
                          </div>
                        ) : localSummary ? (
                          <div className="contents">
                            <RotateCcw className="h-3 w-3 mr-1.5" />
                            Re-summarise
                          </div>
                        ) : (
                          <div className="contents">
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            Generate Summary
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Summary content area */}
                  <div className="p-4">
                    {isSummarising ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="relative mb-4">
                          <Sparkles className="h-8 w-8 text-purple-400 animate-pulse" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Summarising your note...
                        </p>
                        <p className="text-xs text-gray-400">
                          AI is organising and structuring your content
                        </p>
                      </div>
                    ) : localSummary ? (
                      <div>
                        <MarkdownPreview content={localSummary} />
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="flex items-start gap-2 text-[11px] text-gray-400">
                            <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <p>
                              This summary will be used when converting to a task.
                              If you edit the note content, the summary will be cleared and can be regenerated.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !content.trim() ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-8 w-8 text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500 mb-1">
                          No content to summarise
                        </p>
                        <p className="text-xs text-gray-400">
                          Switch to Write mode and add some content first
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="h-8 w-8 text-purple-300 mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Ready to summarise
                        </p>
                        <p className="text-xs text-gray-400 mb-4 max-w-sm">
                          AI will organise your note into a structured summary with key points, 
                          action items, and follow-ups — perfect for converting to tasks.
                        </p>
                        <Button
                          type="button"
                          onClick={handleSummarise}
                          disabled={isSummarising}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Summary
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* ── Metadata section ─────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Tags */}
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-gray-400 mt-2.5 shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs font-medium text-gray-500 uppercase">Tags</Label>
                  <Input
                    value={tagsInput}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    onBlur={handleTagsBlur}
                    placeholder="meeting, follow-up, important (comma-separated)"
                    className="h-9 text-sm mt-1"
                  />
                </div>
              </div>

              {/* Client link */}
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-2.5 shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs font-medium text-gray-500 uppercase">Link to Client</Label>
                  {clients.length > 0 ? (
                    <Select
                      value={clientId || '__none__'}
                      onValueChange={handleClientChange}
                    >
                      <SelectTrigger className="h-9 text-sm mt-1">
                        <SelectValue placeholder="No client linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="flex items-center gap-2">
                            <Unlink className="h-3.5 w-3.5 text-gray-400" /> No client linked
                          </span>
                        </SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <Link2 className="h-3.5 w-3.5 text-purple-500" /> {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : clientName ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                        <User className="h-3 w-3 mr-1" /> {clientName}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">
                      No clients available for linking. You can create notes from the client management screen to auto-link.
                    </p>
                  )}
                </div>
              </div>

              {/* Summary indicator */}
              {localSummary && editorMode === 'write' && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="text-sm text-purple-800 flex-1">
                    AI summary available — will be used when converting to task.
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditorMode('summarise')}
                    className="text-xs font-medium text-purple-700 hover:text-purple-900 underline underline-offset-2"
                  >
                    View
                  </button>
                </div>
              )}

              {/* Converted task indicator */}
              {isConverted && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-800">
                    This note has been converted to a task.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${colorCfg.border}`}>
            <div className="flex items-center gap-2">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
              {isEditing && !isConverted && onConvertToTask && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onConvertToTask(note!.id);
                          onClose();
                        }}
                      >
                        <ListTodo className="h-4 w-4 mr-1" /> Convert to Task
                        {localSummary && (
                          <Sparkles className="h-3 w-3 ml-1 text-purple-500" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      {localSummary
                        ? 'Task description will use the AI summary'
                        : 'Task description will use the raw note content. Generate a summary first for a cleaner task.'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 mr-2">
                {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+S to save
              </span>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || isSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSaving ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...
                  </div>
                ) : (
                  <div className="contents">
                    <Save className="h-4 w-4 mr-1" /> {isEditing ? 'Save Changes' : 'Create Note'}
                  </div>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (note && onDelete) {
                  onDelete(note.id);
                  onClose();
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}