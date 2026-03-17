/**
 * KBEntryModal — Create/Edit modal for KB entries
 *
 * Form for creating and editing knowledge base content entries.
 * Uses react-hook-form for form state management.
 *
 * Guidelines: §7, §8.3
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../../ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { KB_ENTRY_TYPE_CONFIG, KB_DEFAULT_CATEGORIES } from '../constants';
import { useAgents } from '../hooks';
import type { KBEntry, KBEntryType, KBEntryStatus, CreateKBEntryInput, UpdateKBEntryInput } from '../types';

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
  priority: number;
}

export function KBEntryModal({ open, onOpenChange, entry, onSubmit, isSubmitting }: KBEntryModalProps) {
  const isEditing = !!entry;
  const { data: agents } = useAgents();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: '',
      type: 'article',
      status: 'draft',
      content: '',
      question: '',
      answer: '',
      category: 'General',
      tags: '',
      agentScope: 'all',
      priority: 5,
    },
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      reset({
        title: entry.title,
        type: entry.type,
        status: entry.status,
        content: entry.content,
        question: entry.question || '',
        answer: entry.answer || '',
        category: entry.category,
        tags: entry.tags.join(', '),
        agentScope: entry.agentScope === 'all' ? 'all' : (entry.agentScope as string[]).join(', '),
        priority: entry.priority,
      });
    } else {
      reset({
        title: '',
        type: 'article',
        status: 'draft',
        content: '',
        question: '',
        answer: '',
        category: 'General',
        tags: '',
        agentScope: 'all',
        priority: 5,
      });
    }
  }, [entry, reset]);

  const watchType = watch('type');

  const onFormSubmit = (values: FormValues) => {
    const tags = values.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const agentScope = values.agentScope === 'all'
      ? 'all' as const
      : values.agentScope.split(',').map(s => s.trim()).filter(Boolean);

    const data: CreateKBEntryInput = {
      title: values.title,
      type: values.type,
      content: values.content || (values.type === 'qa' ? (values.answer || '') : ''),
      question: values.type === 'qa' ? values.question : undefined,
      answer: values.type === 'qa' ? values.answer : undefined,
      category: values.category,
      tags,
      agentScope,
      priority: values.priority,
      status: values.status,
    };

    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Entry' : 'New Knowledge Base Entry'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the content entry below. Changes take effect immediately for active entries.'
              : 'Add structured content for AI agents to draw from during conversations.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Title *</Label>
            <Input
              id="kb-title"
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g. Tax-Free Savings Account Limits"
            />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Type & Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Content Type *</Label>
              <Select
                value={watch('type')}
                onValueChange={(v) => setValue('type', v as KBEntryType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KB_ENTRY_TYPE_CONFIG) as KBEntryType[]).map(type => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <Badge className={cn('text-[10px]', KB_ENTRY_TYPE_CONFIG[type].badgeClass)}>
                          {KB_ENTRY_TYPE_CONFIG[type].label}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {KB_ENTRY_TYPE_CONFIG[watchType]?.description}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as KBEntryStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Q&A fields (conditional) */}
          {watchType === 'qa' && (
            <div className="space-y-4 bg-blue-50/50 rounded-lg p-4 border border-blue-100">
              <div className="space-y-1.5">
                <Label htmlFor="kb-question">Question *</Label>
                <Input
                  id="kb-question"
                  {...register('question', {
                    validate: (v) => watchType !== 'qa' || !!v || 'Question is required for Q&A type'
                  })}
                  placeholder="e.g. What is the annual TFSA contribution limit?"
                />
                {errors.question && (
                  <p className="text-xs text-red-600">{errors.question.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-answer">Answer *</Label>
                <Textarea
                  id="kb-answer"
                  {...register('answer', {
                    validate: (v) => watchType !== 'qa' || !!v || 'Answer is required for Q&A type'
                  })}
                  placeholder="The annual TFSA contribution limit is R36,000 per tax year..."
                  rows={4}
                />
                {errors.answer && (
                  <p className="text-xs text-red-600">{errors.answer.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-content">
              {watchType === 'qa' ? 'Additional Context' : 'Content *'}
            </Label>
            <Textarea
              id="kb-content"
              {...register('content', {
                required: watchType !== 'qa' ? 'Content is required' : false
              })}
              placeholder={
                watchType === 'qa'
                  ? 'Optional additional context or related information...'
                  : 'Write the content here. Markdown is supported...'
              }
              rows={watchType === 'qa' ? 3 : 8}
              className="font-mono text-sm"
            />
            {errors.content && (
              <p className="text-xs text-red-600">{errors.content.message}</p>
            )}
          </div>

          {/* Category & Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch('category')}
                onValueChange={(v) => setValue('category', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_DEFAULT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kb-priority">Priority (1-10)</Label>
              <Input
                id="kb-priority"
                type="number"
                min={1}
                max={10}
                {...register('priority', { valueAsNumber: true, min: 1, max: 10 })}
              />
              <p className="text-xs text-gray-400">Higher = more likely to surface in RAG</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-tags">Tags</Label>
            <Input
              id="kb-tags"
              {...register('tags')}
              placeholder="tax, savings, limits (comma-separated)"
            />
            <p className="text-xs text-gray-400">Comma-separated tags for search and filtering</p>
          </div>

          {/* Agent Scope */}
          <div className="space-y-1.5">
            <Label>Agent Scope</Label>
            <Select
              value={watch('agentScope') === 'all' ? 'all' : 'specific'}
              onValueChange={(v) => {
                if (v === 'all') setValue('agentScope', 'all');
                else setValue('agentScope', '');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="specific">Specific Agents</SelectItem>
              </SelectContent>
            </Select>
            {watch('agentScope') !== 'all' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {agents?.map(agent => {
                  const currentScope = watch('agentScope');
                  const selectedIds = currentScope === 'all' ? [] : currentScope.split(',').map(s => s.trim()).filter(Boolean);
                  const isSelected = selectedIds.includes(agent.id);

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? selectedIds.filter(id => id !== agent.id)
                          : [...selectedIds, agent.id];
                        setValue('agentScope', updated.join(', '));
                      }}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors',
                        isSelected
                          ? 'bg-purple-100 border-purple-300 text-purple-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {agent.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2 bg-purple-600 hover:bg-purple-700">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}