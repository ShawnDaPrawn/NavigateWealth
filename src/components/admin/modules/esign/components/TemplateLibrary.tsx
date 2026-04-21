/**
 * Template Library
 * Grid/list view of all saved e-signature templates with search, filter,
 * usage stats, and CRUD operations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Edit3,
  Copy,
  ListOrdered,
  Shuffle,
  Users,
  FileText,
  LayoutGrid,
  List,
  Clock,
  TrendingUp,
  Loader2,
  FolderOpen,
  RefreshCw,
  Bookmark,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { esignApi } from '../api';
import { cn } from '../../../../ui/utils';
import { format } from 'date-fns';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import type { EsignTemplateRecord, SigningMode } from '../types';
import { TEMPLATE_CATEGORIES } from '../types';
import { EditTemplateDialog } from './EditTemplateDialog';
import { SkeletonCardGrid } from './EsignSkeleton';

interface TemplateLibraryProps {
  onUseTemplate: (template: EsignTemplateRecord) => void;
}

export function TemplateLibrary({ onUseTemplate }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<EsignTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('');
  const [newTemplateSigningMode, setNewTemplateSigningMode] = useState<SigningMode>('sequential');

  // Edit dialog state
  const [editingTemplate, setEditingTemplate] = useState<EsignTemplateRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EsignTemplateRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await esignApi.listTemplates();
      setTemplates(result.templates || []);
    } catch (err: unknown) {
      console.error('Failed to fetch templates:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // P4.4 — Always show the full canonical list of categories (TEMPLATE_CATEGORIES)
  // so senders can filter by an empty category to confirm "no investment templates yet".
  // We merge in any ad-hoc categories that exist on persisted templates so legacy
  // entries aren't lost.
  const categoryCounts = templates.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category || 'Uncategorised';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const knownCategories = new Set<string>([
    ...TEMPLATE_CATEGORIES,
    ...Object.keys(categoryCounts),
  ]);

  const handleDelete = async () => {
    if (!templateToDelete) return;
    setDeleting(true);
    try {
      await esignApi.deleteTemplate(templateToDelete.id);
      setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      toast.success(`Template "${templateToDelete.name}" deleted`);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (template: EsignTemplateRecord) => {
    try {
      const result = await esignApi.createTemplate({
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        signingMode: template.signingMode,
        defaultMessage: template.defaultMessage,
        defaultExpiryDays: template.defaultExpiryDays,
        recipients: template.recipients,
        fields: template.fields,
      });
      setTemplates(prev => [result.template, ...prev]);
      toast.success(`Template duplicated as "${result.template.name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate template');
    }
  };

  const handleUseTemplate = async (template: EsignTemplateRecord) => {
    try {
      // Increment usage count on server
      await esignApi.useTemplate(template.id);
      // Update local state
      setTemplates(prev =>
        prev.map(t => (t.id === template.id ? { ...t, usageCount: (t.usageCount || 0) + 1 } : t))
      );
    } catch {
      // Non-critical — still proceed
    }
    onUseTemplate(template);
  };

  const handleEditSave = async (updated: EsignTemplateRecord) => {
    setTemplates(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setEditDialogOpen(false);
    setEditingTemplate(null);
  };

  const resetCreateDialog = () => {
    setNewTemplateName('');
    setNewTemplateDescription('');
    setNewTemplateCategory('');
    setNewTemplateSigningMode('sequential');
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    setCreating(true);
    try {
      const result = await esignApi.createTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        category: newTemplateCategory || undefined,
        signingMode: newTemplateSigningMode,
      });
      setTemplates((prev) => [result.template, ...prev]);
      setCreateDialogOpen(false);
      resetCreateDialog();
      toast.success(`Template "${result.template.name}" created`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  // ========== RENDER ==========

  if (loading) {
    return (
      // P8.3 — Skeleton matches the card grid that the templates render
      // into so the layout doesn't jump when data lands.
      <div className="space-y-4">
        <SkeletonCardGrid cards={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Template
          </Button>

          {/* Category filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCategoryFilter('all')}>
                All Categories
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {templates.length}
                </Badge>
              </DropdownMenuItem>
              {Array.from(knownCategories)
                .sort((a, b) => a.localeCompare(b))
                .map((cat) => (
                  <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                    {cat}
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {categoryCounts[cat] ?? 0}
                    </Badge>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchTemplates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Empty State (P8.2 — always offers exactly one obvious action) */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-16">
          <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {searchQuery || categoryFilter !== 'all' ? 'No templates match your filters' : 'No templates yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            {searchQuery || categoryFilter !== 'all'
              ? 'Try adjusting your search or category filter.'
              : 'Create a blank template here, or save an envelope as a template to reuse its configuration across future documents.'}
          </p>
          {!(searchQuery || categoryFilter !== 'all') && (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Template
            </Button>
          )}
          {(searchQuery || categoryFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template)}
              onEdit={() => {
                setEditingTemplate(template);
                setEditDialogOpen(true);
              }}
              onDuplicate={() => handleDuplicate(template)}
              onDelete={() => {
                setTemplateToDelete(template);
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredTemplates.length > 0 && (
        <div className="space-y-2">
          {filteredTemplates.map(template => (
            <TemplateRow
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template)}
              onEdit={() => {
                setEditingTemplate(template);
                setEditDialogOpen(true);
              }}
              onDuplicate={() => handleDuplicate(template)}
              onDelete={() => {
                setTemplateToDelete(template);
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetCreateDialog();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Start a reusable template from the Templates tab, then refine it for your e-sign workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-template-name">Template Name *</Label>
              <Input
                id="create-template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Client Agreement"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-template-description">Description</Label>
              <Textarea
                id="create-template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Brief description of when this template should be used..."
                rows={2}
                maxLength={300}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={newTemplateCategory || '__none'}
                onValueChange={(value) => setNewTemplateCategory(value === '__none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No Category</SelectItem>
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default Signing Order</Label>
              <Select
                value={newTemplateSigningMode}
                onValueChange={(value) => setNewTemplateSigningMode(value as SigningMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={creating || !newTemplateName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This cannot be undone.
              Existing envelopes created from this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {editingTemplate && (
        <EditTemplateDialog
          template={editingTemplate}
          open={editDialogOpen}
          onOpenChange={open => {
            setEditDialogOpen(open);
            if (!open) setEditingTemplate(null);
          }}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

// ============================================================================
// TEMPLATE CARD (Grid View)
// ============================================================================

interface TemplateItemProps {
  template: EsignTemplateRecord;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onUse, onEdit, onDuplicate, onDelete }: TemplateItemProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow relative">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-gray-900 truncate" title={template.name}>
              {template.name}
            </h3>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {template.category && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
              {template.category}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] h-5 px-1.5 font-normal',
              template.signingMode === 'sequential'
                ? 'border-purple-200 bg-purple-50 text-purple-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            )}
          >
            {template.signingMode === 'sequential' ? (
              <ListOrdered className="h-3 w-3 mr-0.5" />
            ) : (
              <Shuffle className="h-3 w-3 mr-0.5" />
            )}
            {template.signingMode === 'sequential' ? 'Sequential' : 'Parallel'}
          </Badge>
          {template.recipients.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal gap-0.5">
              <Users className="h-3 w-3" />
              {template.recipients.length}
            </Badge>
          )}
          {template.fields.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal gap-0.5">
              <FileText className="h-3 w-3" />
              {template.fields.length} fields
            </Badge>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1" title="Times used">
              <TrendingUp className="h-3 w-3" />
              {template.usageCount || 0} uses
            </span>
            <span className="flex items-center gap-1" title="Created">
              <Clock className="h-3 w-3" />
              {formatDate(template.createdAt)}
            </span>
          </div>

          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            onClick={onUse}
          >
            Use Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TEMPLATE ROW (List View)
// ============================================================================

function TemplateRow({ template, onUse, onEdit, onDuplicate, onDelete }: TemplateItemProps) {
  return (
    <div className="group flex items-center gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white">
      {/* Icon */}
      <div className="h-10 w-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
        <Bookmark className="h-5 w-5 text-purple-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-medium text-sm text-gray-900 truncate">{template.name}</h4>
          {template.category && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal shrink-0">
              {template.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {template.recipients.length} recipient{template.recipients.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {template.usageCount || 0} uses
          </span>
          <span>{formatDate(template.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] h-5 px-1.5 font-normal',
            template.signingMode === 'sequential'
              ? 'border-purple-200 bg-purple-50 text-purple-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          )}
        >
          {template.signingMode === 'sequential' ? 'Sequential' : 'Parallel'}
        </Badge>

        <Button
          size="sm"
          className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onUse}
        >
          Use
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="h-3.5 w-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return 'Unknown';
  }
}
