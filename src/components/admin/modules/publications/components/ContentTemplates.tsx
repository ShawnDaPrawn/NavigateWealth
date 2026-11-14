/**
 * ContentTemplates — Template Management View (Phase 4)
 *
 * Admin view for managing content templates. Allows creating, editing,
 * deleting, and previewing templates used for article creation.
 *
 * @module publications/components/ContentTemplates
 */

import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  ChevronLeft,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { Skeleton } from '../../../../ui/skeleton';
import { Badge } from '../../../../ui/badge';
import { PublicationsAPI } from '../api';
import type { ContentTemplate, CreateTemplateInput, UpdateTemplateInput } from '../types';
import { toast } from 'sonner';
import { ErrorState, FormErrorBanner, PageHeader, useConfirm } from '../../../layout/page';
import { useSubPage } from '../hooks/useSubPage';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TemplateFormProps {
  template?: ContentTemplate | null;
  onSave: (input: CreateTemplateInput | UpdateTemplateInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const TEMPLATE_FORM_ID = 'template-form';

function TemplateForm({ template, onSave }: TemplateFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [body, setBody] = useState(template?.body || '');
  const [icon, setIcon] = useState(template?.icon || '📄');
  const [tags, setTags] = useState(template?.tags?.join(', ') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !description.trim()) {
      document.getElementById(!name.trim() ? 'template-name' : 'template-description')?.focus();
      return;
    }

    const input: CreateTemplateInput = {
      name: name.trim(),
      description: description.trim(),
      body,
      icon,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    onSave(input);
  };

  const nameError = submitted && !name.trim() ? 'Add a name for the template' : null;
  const descriptionError =
    submitted && !description.trim() ? 'Say when to use this template' : null;
  const errorCount = (nameError ? 1 : 0) + (descriptionError ? 1 : 0);
  const errorClass = 'border-red-500 focus:ring-red-500';

  return (
    <form id={TEMPLATE_FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormErrorBanner
        count={errorCount}
        action={template ? 'save the template' : 'create the template'}
      />
      <div className="grid grid-cols-[80px_1fr] gap-4">
        {/* Icon */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Icon</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full px-3 py-2 text-center text-lg border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            maxLength={4}
          />
        </div>
        {/* Name */}
        <div>
          <label htmlFor="template-name" className="text-xs font-medium text-gray-700 block mb-1">
            Name *
          </label>
          <input
            id="template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Market commentary"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'template-name-error' : undefined}
            className={cn(
              'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
              nameError && errorClass,
            )}
          />
          {nameError && (
            <p id="template-name-error" className="mt-1 text-xs text-red-600">
              {nameError}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="template-description"
          className="text-xs font-medium text-gray-700 block mb-1"
        >
          Description *
        </label>
        <input
          id="template-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of when to use this template"
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={descriptionError ? 'template-description-error' : undefined}
          className={cn(
            'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500',
            descriptionError && errorClass,
          )}
        />
        {descriptionError && (
          <p id="template-description-error" className="mt-1 text-xs text-red-600">
            {descriptionError}
          </p>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g., market, analysis, recurring"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Body HTML */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Content (HTML)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="<h2>Section Title</h2>\n<p>Template content here...</p>"
          rows={10}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
        />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ContentTemplates() {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // The form is a page with its own address: ?page=template-new / template-<id>.
  const [pageId, setPageId] = useSubPage('template');
  const showCreateForm = pageId === 'new';
  const editingTemplate =
    pageId && pageId !== 'new' ? (templates.find((t) => t.id === pageId) ?? null) : null;
  const setShowCreateForm = (open: boolean) => setPageId(open ? 'new' : null);
  const setEditingTemplate = (template: ContentTemplate | null) =>
    setPageId(template ? template.id : null);
  const { confirm, confirmDialog } = useConfirm();
  const [isSaving, setIsSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContentTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await PublicationsAPI.Templates.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = useCallback(
    async (input: CreateTemplateInput | UpdateTemplateInput) => {
      setIsSaving(true);
      try {
        await PublicationsAPI.Templates.createTemplate(input as CreateTemplateInput);
        toast.success('Template created successfully');
        setPageId(null);
        await loadTemplates();
      } catch {
        toast.error('Failed to create template');
      } finally {
        setIsSaving(false);
      }
    },
    [loadTemplates, setPageId],
  );

  const handleUpdate = useCallback(
    async (input: CreateTemplateInput | UpdateTemplateInput) => {
      if (!editingTemplate) return;
      setIsSaving(true);
      try {
        await PublicationsAPI.Templates.updateTemplate(
          editingTemplate.id,
          input as UpdateTemplateInput,
        );
        toast.success('Template updated successfully');
        setPageId(null);
        await loadTemplates();
      } catch {
        toast.error('Failed to update template');
      } finally {
        setIsSaving(false);
      }
    },
    [editingTemplate, loadTemplates, setPageId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await PublicationsAPI.Templates.deleteTemplate(id);
        toast.success('Template deleted');
        await loadTemplates();
      } catch {
        toast.error('Failed to delete template');
      }
    },
    [loadTemplates],
  );

  const handleSeedDefaults = useCallback(async () => {
    try {
      await PublicationsAPI.Templates.seedDefaults();
      toast.success('Default templates created');
      await loadTemplates();
    } catch {
      toast.error('Failed to seed default templates');
    }
  }, [loadTemplates]);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading templates"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        data-testid="templates-loading"
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="Unable to load templates"
        onRetry={() => void loadTemplates()}
        details={loadError}
      />
    );
  }

  // A template named in the address that no longer exists.
  if (pageId && pageId !== 'new' && !editingTemplate) {
    return (
      <ErrorState
        title="Template not found"
        description="It may have been deleted."
        onRetry={() => setPageId(null)}
        retryLabel="Back to templates"
      />
    );
  }

  // Create / edit form — a page of its own
  if (showCreateForm || editingTemplate) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setPageId(null)}
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Templates
        </button>
        <PageHeader
          title={editingTemplate ? 'Edit template' : 'New template'}
          description="Shown in the template picker"
          actions={
            <>
              <Button variant="outline" onClick={() => setPageId(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" form={TEMPLATE_FORM_ID} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {editingTemplate ? 'Save template' : 'Create template'}
              </Button>
            </>
          }
        />
        <div className="max-w-3xl rounded-xl border border-nw-line bg-white p-6">
          <TemplateForm
            key={editingTemplate?.id ?? 'new'}
            template={editingTemplate}
            onSave={editingTemplate ? handleUpdate : handleCreate}
            onCancel={() => setPageId(null)}
            isSaving={isSaving}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Content templates</h2>
            <p className="text-xs text-gray-500">
              Pre-built article structures for faster content creation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Load Defaults
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </div>
      </div>

      {/* Templates grid */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">No templates yet</p>
          <p className="text-xs text-gray-500 mb-4">
            Create templates to streamline article creation
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Load Default Templates
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Custom
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-200 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                  {template.icon || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {template.name}
                    </h3>
                    {template.is_system && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {template.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-600"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPreviewTemplate(previewTemplate?.id === template.id ? null : template)
                  }
                  className="h-7 text-[11px] px-2"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTemplate(template)}
                  className="h-7 text-[11px] px-2"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete “${template.name}”?`,
                      description: 'The template is removed from the template picker.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (ok) void handleDelete(template.id);
                  }}
                  className="h-7 text-[11px] px-2 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>

              {/* Preview expansion */}
              {previewTemplate?.id === template.id && (
                <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
                  <div
                    className="prose prose-xs max-w-none text-xs text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        template.body || '<p class="text-gray-400 italic">Empty template</p>',
                      ),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
