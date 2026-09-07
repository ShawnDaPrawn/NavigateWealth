/**
 * KBEntryModal — Create/Edit a knowledge base entry.
 *
 * Asks the questions an admin can actually answer, in the order they think
 * about them: what is it, what does it say, where does it belong, how much
 * should Vasco lean on it, and is it live. Tags and per-assistant scoping are
 * behind "More options" because most entries never need them.
 *
 * Guidelines: §7, §8.3
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/collapsible';
import { cn } from '../../../../ui/utils';
import {
  KB_ENTRY_TYPE_CONFIG,
  KB_DEFAULT_CATEGORIES,
  KB_IMPORTANCE_OPTIONS,
  importanceFromPriority,
  priorityFromImportance,
  type KBImportance,
} from '../constants';
import { useAgents } from '../hooks';
import type {
  KBEntry,
  KBEntryType,
  KBEntryStatus,
  CreateKBEntryInput,
  UpdateKBEntryInput,
} from '../types';

interface KBEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: KBEntry | null; // null = create mode
  onSubmit: (data: CreateKBEntryInput | UpdateKBEntryInput) => void;
  isSubmitting: boolean;
}

interface FormValues {
  title: string;
  type: KBEntryType;
  status: KBEntryStatus;
  content: string;
  question: string;
  answer: string;
  category: string;
  tags: string;
  agentScope: string; // 'all' or comma-separated IDs
  importance: KBImportance;
}

const EMPTY: FormValues = {
  title: '',
  type: 'article',
  status: 'active',
  content: '',
  question: '',
  answer: '',
  category: 'General',
  tags: '',
  agentScope: 'all',
  importance: 'normal',
};

function toFormValues(entry: KBEntry): FormValues {
  return {
    title: entry.title,
    type: entry.type,
    status: entry.status,
    content: entry.content,
    question: entry.question || '',
    answer: entry.answer || '',
    category: entry.category,
    tags: entry.tags.join(', '),
    agentScope: entry.agentScope === 'all' ? 'all' : (entry.agentScope as string[]).join(', '),
    importance: importanceFromPriority(entry.priority),
  };
}

const AVAILABILITY: Array<{ id: KBEntryStatus; label: string; description: string }> = [
  { id: 'active', label: 'Live', description: 'Vasco can use this entry as soon as you save.' },
  {
    id: 'draft',
    label: 'Draft',
    description: 'Kept here, but hidden from Vasco until you switch it on.',
  },
];

export function KBEntryModal({
  open,
  onOpenChange,
  entry,
  onSubmit,
  isSubmitting,
}: KBEntryModalProps) {
  const isEditing = !!entry;
  const { data: agents } = useAgents();
  const [moreOpen, setMoreOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: EMPTY });

  // Reset form when entry changes (or the modal reopens for a new entry)
  useEffect(() => {
    if (!open) return;
    if (entry) {
      reset(toFormValues(entry));
      setMoreOpen(entry.tags.length > 0 || entry.agentScope !== 'all');
    } else {
      reset(EMPTY);
      setMoreOpen(false);
    }
  }, [entry, open, reset]);

  const watchType = watch('type');
  const watchStatus = watch('status');
  const watchImportance = watch('importance');
  const watchScope = watch('agentScope');
  const isQA = watchType === 'qa';

  const onFormSubmit = (values: FormValues) => {
    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const agentScope =
      values.agentScope === 'all'
        ? ('all' as const)
        : values.agentScope
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

    const data: CreateKBEntryInput = {
      title: values.title.trim(),
      type: values.type,
      // The server requires `content` for non-Q&A types; for Q&A it is optional
      // extra context, and falls back to the answer so search has something.
      content: values.content || (isQA ? values.answer || '' : ''),
      question: isQA ? values.question : undefined,
      answer: isQA ? values.answer : undefined,
      category: values.category,
      tags,
      agentScope: agentScope === 'all' || agentScope.length === 0 ? 'all' : agentScope,
      priority: priorityFromImportance(values.importance),
      status: values.status,
    };

    onSubmit(data);
  };

  const availabilityOptions =
    isEditing && entry?.status === 'archived'
      ? [
          ...AVAILABILITY,
          {
            id: 'archived' as KBEntryStatus,
            label: 'Archived',
            description: 'Kept for reference. Not used by Vasco.',
          },
        ]
      : AVAILABILITY;

  const submitLabel = isEditing
    ? 'Save changes'
    : watchStatus === 'active'
      ? 'Save and make live'
      : 'Save as draft';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit entry' : 'New knowledge base entry'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Changes to a Live entry reach Vasco as soon as you save.'
              : 'Write it the way you would like Vasco to explain it. Plain language works best.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Title</Label>
            <Input
              id="kb-title"
              {...register('title', {
                required: 'Give the entry a title',
                validate: (v) => v.trim().length > 0 || 'Give the entry a title',
              })}
              placeholder="e.g. Tax-free savings account annual limit"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              A short name. It identifies the entry in the list and tells Vasco what the text is
              about.
            </p>
            {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={watchType} onValueChange={(v) => setValue('type', v as KBEntryType)}>
              <SelectTrigger aria-label="Format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KB_ENTRY_TYPE_CONFIG) as KBEntryType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="font-medium">{KB_ENTRY_TYPE_CONFIG[type].label}</span>
                    <span className="text-gray-500">
                      {' '}
                      — {KB_ENTRY_TYPE_CONFIG[type].description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          {isQA ? (
            <div className="space-y-4 rounded-lg border border-gray-200 p-4 bg-gray-50/50">
              <div className="space-y-1.5">
                <Label htmlFor="kb-question">Question</Label>
                <Input
                  id="kb-question"
                  {...register('question', {
                    validate: (v) => !isQA || v.trim().length > 0 || 'Add the question people ask',
                  })}
                  placeholder="e.g. How much can I put into a tax-free savings account each year?"
                />
                {errors.question && (
                  <p className="text-xs text-red-600">{errors.question.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-answer">Answer</Label>
                <Textarea
                  id="kb-answer"
                  {...register('answer', {
                    validate: (v) =>
                      !isQA || v.trim().length > 0 || 'Add the answer Vasco should give',
                  })}
                  placeholder="The annual limit is R36,000 per tax year, with a lifetime limit of R500,000…"
                  rows={5}
                />
                {errors.answer && <p className="text-xs text-red-600">{errors.answer.message}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="kb-content">Content</Label>
              <Textarea
                id="kb-content"
                {...register('content', {
                  validate: (v) =>
                    isQA || v.trim().length > 0 || 'Add the content Vasco should know',
                })}
                placeholder="Write the facts, rules or explanation here. Long entries are split into passages automatically."
                rows={8}
              />
              {errors.content && <p className="text-xs text-red-600">{errors.content.message}</p>}
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
              <SelectTrigger aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KB_DEFAULT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Importance */}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Importance</legend>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1"
              role="radiogroup"
              aria-label="Importance"
            >
              {KB_IMPORTANCE_OPTIONS.map((opt) => {
                const selected = watchImportance === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('importance', opt.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      selected
                        ? 'border-purple-400 bg-purple-50 text-purple-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700',
                    )}
                  >
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-[11px] text-gray-500">{opt.description}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              When several entries match a question, higher importance wins. It does not make an
              unrelated entry appear.
            </p>
          </fieldset>

          {/* Availability */}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Availability</legend>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
              role="radiogroup"
              aria-label="Availability"
            >
              {availabilityOptions.map((opt) => {
                const selected = watchStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('status', opt.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left transition-colors flex items-start gap-3',
                      selected
                        ? opt.id === 'active'
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1 h-2.5 w-2.5 rounded-full shrink-0',
                        opt.id === 'active' ? 'bg-green-500' : 'bg-gray-400',
                      )}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                      <span className="block text-[11px] text-gray-500">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* More options */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')}
                />
                More options
                <span className="text-xs text-gray-400 font-normal">tags, which assistants</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="kb-tags">Tags</Label>
                <Input id="kb-tags" {...register('tags')} placeholder="tax, savings, limits" />
                <p className="text-xs text-gray-500">
                  Comma-separated. Only used for searching this list.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Which assistants may use it</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('agentScope', 'all')}
                    aria-pressed={watchScope === 'all'}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      watchScope === 'all'
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                    )}
                  >
                    All assistants
                  </button>
                  {agents?.map((agent) => {
                    const selectedIds =
                      watchScope === 'all'
                        ? []
                        : watchScope
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                    const isSelected = selectedIds.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          const updated = isSelected
                            ? selectedIds.filter((id) => id !== agent.id)
                            : [...selectedIds, agent.id];
                          setValue('agentScope', updated.length === 0 ? 'all' : updated.join(', '));
                        }}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          isSelected
                            ? 'bg-purple-100 border-purple-300 text-purple-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                        )}
                      >
                        {agent.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  Leave on "All assistants" unless the entry is only appropriate for, say, logged-in
                  clients.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
