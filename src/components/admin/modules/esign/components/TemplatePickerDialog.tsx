/**
 * Template Picker Dialog
 * Shown when the user clicks "Start New Envelope" — offers the choice
 * of starting from scratch or choosing a saved template.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { ScrollArea } from '../../../../ui/scroll-area';
import {
  FileText,
  Search,
  Bookmark,
  Plus,
  Users,
  ListOrdered,
  Shuffle,
  Clock,
  TrendingUp,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { esignApi } from '../api';
import { cn } from '../../../../ui/utils';
import { format } from 'date-fns';
import type { EsignTemplateRecord } from '../types';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User chose to start from a blank envelope */
  onStartBlank: () => void;
  /** User chose a template — the parent will pre-populate wizard data */
  onSelectTemplate: (template: EsignTemplateRecord) => void;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  onStartBlank,
  onSelectTemplate,
}: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<EsignTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSearchQuery('');
      setSelectedId(null);
      esignApi
        .listTemplates()
        .then(result => setTemplates(result.templates || []))
        .catch(() => setTemplates([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filtered = templates.filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTemplate = templates.find(t => t.id === selectedId) || null;

  const handleConfirmTemplate = () => {
    if (selectedTemplate) {
      // Track usage
      esignApi.useTemplate(selectedTemplate.id).catch(() => {});
      onSelectTemplate(selectedTemplate);
      onOpenChange(false);
    }
  };

  const handleStartBlank = () => {
    onStartBlank();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>New Envelope</DialogTitle>
          <DialogDescription>
            Start from scratch or use a saved template to pre-fill recipients and settings.
          </DialogDescription>
        </DialogHeader>

        {/* Start Blank option */}
        <div className="px-6">
          <button
            type="button"
            onClick={handleStartBlank}
            className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 transition-all text-left group"
          >
            <div className="h-11 w-11 rounded-lg bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
              <Plus className="h-5 w-5 text-gray-500 group-hover:text-purple-600 transition-colors" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-900">Start from Scratch</p>
              <p className="text-xs text-muted-foreground">
                Upload a document and configure recipients manually.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </button>
        </div>

        {/* Divider */}
        <div className="px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-muted-foreground font-medium">or choose a template</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* Search */}
        {templates.length > 0 && (
          <div className="px-6 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        )}

        {/* Template List */}
        <ScrollArea className="flex-1 px-6 pb-4 max-h-[340px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 mr-2" />
              <span className="text-sm text-muted-foreground">Loading templates...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {searchQuery ? 'No templates match your search.' : 'No saved templates yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filtered.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id === selectedId ? null : template.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                    selectedId === template.id
                      ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      selectedId === template.id
                        ? 'bg-purple-100'
                        : 'bg-gray-100'
                    )}
                  >
                    <Bookmark
                      className={cn(
                        'h-4 w-4 transition-colors',
                        selectedId === template.id ? 'text-purple-600' : 'text-gray-500'
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-medium text-sm text-gray-900 truncate">{template.name}</h4>
                      {template.category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal shrink-0">
                          {template.category}
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {template.recipients.length}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <FileText className="h-3 w-3" />
                        {template.fields.length} fields
                      </span>
                      <span className="flex items-center gap-0.5">
                        {template.signingMode === 'sequential' ? (
                          <ListOrdered className="h-3 w-3" />
                        ) : (
                          <Shuffle className="h-3 w-3" />
                        )}
                        {template.signingMode === 'sequential' ? 'Seq' : 'Par'}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        {template.usageCount || 0}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with confirm */}
        {selectedId && (
          <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground min-w-0 truncate">
              Selected: <span className="font-medium text-gray-900">{selectedTemplate?.name}</span>
            </div>
            <Button
              onClick={handleConfirmTemplate}
              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              Use Template
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
