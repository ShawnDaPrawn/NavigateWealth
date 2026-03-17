/**
 * ContentTemplates — Template Management View (Phase 4)
 *
 * Admin view for managing content templates. Allows creating, editing,
 * deleting, and previewing templates used for article creation.
 *
 * @module publications/components/ContentTemplates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
  X,
  Save,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type { ContentTemplate, CreateTemplateInput, UpdateTemplateInput } from '../types';
import { toast } from 'sonner@2.0.3';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TemplateFormProps {
  template?: ContentTemplate | null;
  onSave: (input: CreateTemplateInput | UpdateTemplateInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function TemplateForm({ template, onSave, onCancel, isSaving }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [body, setBody] = useState(template?.body || '');
  const [icon, setIcon] = useState(template?.icon || '📄');
  const [tags, setTags] = useState(template?.tags?.join(', ') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="text-xs font-medium text-gray-700 block mb-1">Template Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Market Commentary"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Description *</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of when to use this template"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Tags (comma-separated)</label>
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
        <label className="text-xs font-medium text-gray-700 block mb-1">Template Body (HTML)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="<h2>Section Title</h2>\n<p>Template content here...</p>"
          rows={10}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving || !name.trim() || !description.trim()}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1" />
          )}
          {template ? 'Update Template' : 'Create Template'}
        </Button>
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
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContentTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await PublicationsAPI.Templates.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      toast.error('Failed to load templates');
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
        setShowCreateForm(false);
        await loadTemplates();
      } catch (err) {
        toast.error('Failed to create template');
      } finally {
        setIsSaving(false);
      }
    },
    [loadTemplates]
  );

  const handleUpdate = useCallback(
    async (input: CreateTemplateInput | UpdateTemplateInput) => {
      if (!editingTemplate) return;
      setIsSaving(true);
      try {
        await PublicationsAPI.Templates.updateTemplate(editingTemplate.id, input as UpdateTemplateInput);
        toast.success('Template updated successfully');
        setEditingTemplate(null);
        await loadTemplates();
      } catch (err) {
        toast.error('Failed to update template');
      } finally {
        setIsSaving(false);
      }
    },
    [editingTemplate, loadTemplates]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await PublicationsAPI.Templates.deleteTemplate(id);
        toast.success('Template deleted');
        setDeleteConfirm(null);
        await loadTemplates();
      } catch (err) {
        toast.error('Failed to delete template');
      }
    },
    [loadTemplates]
  );

  const handleSeedDefaults = useCallback(async () => {
    try {
      await PublicationsAPI.Templates.seedDefaults();
      toast.success('Default templates created');
      await loadTemplates();
    } catch (err) {
      toast.error('Failed to seed default templates');
    }
  }, [loadTemplates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
        <span className="text-sm text-gray-500">Loading templates...</span>
      </div>
    );
  }

  // Show create/edit form
  if (showCreateForm || editingTemplate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-purple-600" />
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm
              template={editingTemplate}
              onSave={editingTemplate ? handleUpdate : handleCreate}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingTemplate(null);
              }}
              isSaving={isSaving}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Content Templates</h2>
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
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{template.name}</h3>
                    {template.is_system && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
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

                {deleteConfirm === template.id ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      className="h-7 text-[11px] px-2"
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(null)}
                      className="h-7 text-[11px] px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(template.id)}
                    className="h-7 text-[11px] px-2 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                )}
              </div>

              {/* Preview expansion */}
              {previewTemplate?.id === template.id && (
                <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
                  <div
                    className="prose prose-xs max-w-none text-xs text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: template.body || '<p class="text-gray-400 italic">Empty template</p>',
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
