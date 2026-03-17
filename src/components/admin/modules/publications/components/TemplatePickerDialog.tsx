/**
 * TemplatePickerDialog — Content Template Selector (Phase 4)
 *
 * Modal dialog shown when creating a new article, allowing the user to
 * select from pre-defined content templates or start with a blank article.
 * Templates pre-fill the editor body and optionally set category/type.
 *
 * @module publications/components/TemplatePickerDialog
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Loader2,
  Search,
  Sparkles,
  X,
  ChevronRight,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type { ContentTemplate } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplatePickerDialogProps {
  isOpen: boolean;
  /** Called when dialog is dismissed without action (Cancel / X) */
  onClose: () => void;
  /** Called when a template is selected */
  onSelect: (template: ContentTemplate) => void;
  /** Called when user chooses to start with a blank article (no template) */
  onSkip: () => void;
  /** Called when user wants to generate an article with AI */
  onOpenAIGenerator?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePickerDialog({
  isOpen,
  onClose,
  onSelect,
  onSkip,
  onOpenAIGenerator,
}: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ContentTemplate | null>(null);

  // Fetch templates on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadTemplates() {
      setIsLoading(true);
      setError(null);
      try {
        let data = await PublicationsAPI.Templates.getTemplates();
        // If no templates exist, seed defaults then re-fetch
        if (data.length === 0) {
          await PublicationsAPI.Templates.seedDefaults();
          data = await PublicationsAPI.Templates.getTemplates();
        }
        if (!cancelled) {
          setTemplates(data);
          // Auto-select blank template
          const blank = data.find((t) => t.name === 'Blank Article');
          if (blank) setSelectedId(blank.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load templates');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedId(null);
      setPreviewTemplate(null);
    }
  }, [isOpen]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  const handleSelect = () => {
    const template = templates.find((t) => t.id === selectedId);
    if (template) {
      onSelect(template);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Choose a Template</h2>
              <p className="text-xs text-gray-500">Start with a pre-built structure or a blank canvas</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Template list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <span className="text-sm text-gray-500">Loading templates...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {!isLoading && !error && filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No templates found</p>
              </div>
            )}

            {!isLoading &&
              filteredTemplates.map((template) => {
                const isSelected = selectedId === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedId(template.id);
                      setPreviewTemplate(template);
                    }}
                    onDoubleClick={() => {
                      onSelect(template);
                    }}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all',
                      'border-2',
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
                        isSelected ? 'bg-purple-100' : 'bg-gray-100'
                      )}
                    >
                      {template.icon || '📄'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                        {isSelected && (
                          <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                      {template.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
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
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-300 mt-1 flex-shrink-0" />
                  </button>
                );
              })}
          </div>

          {/* Preview panel */}
          {previewTemplate && (
            <div className="w-80 border-l border-gray-200 bg-gray-50/50 overflow-y-auto p-4 hidden lg:block">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Preview
              </h4>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{previewTemplate.icon || '📄'}</span>
                  <h5 className="text-sm font-semibold text-gray-900">{previewTemplate.name}</h5>
                </div>
                <div
                  className="prose prose-xs max-w-none text-gray-600 text-xs leading-relaxed max-h-[300px] overflow-y-auto"
                  dangerouslySetInnerHTML={{
                    __html: previewTemplate.body || '<p class="text-gray-400 italic">Empty template</p>',
                  }}
                />
              </div>
              {previewTemplate.is_system && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">System template</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-2xl">
          <p className="text-xs text-gray-400">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {onOpenAIGenerator && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAIGenerator}
                className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Zap className="h-3.5 w-3.5" />
                Generate with AI
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onSkip}>
              Start Blank
            </Button>
            <Button
              size="sm"
              onClick={handleSelect}
              disabled={!selectedId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Use Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}