/**
 * TemplateGallery — Phase 1 starter template picker.
 *
 * Displayed before the builder canvas opens. Admins choose from a library
 * of pre-built form/letter templates or start from a blank canvas.
 *
 * Guidelines §8.3 — Consistent card patterns, status colours.
 * Guidelines §7.1 — No inline business logic in JSX.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import {
  Search,
  FileText,
  ArrowRight,
  Layers,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { STARTER_TEMPLATES, type StarterTemplate } from '../constants';

interface TemplateGalleryProps {
  onSelectTemplate: (template: StarterTemplate) => void;
  onCancel: () => void;
  /** Filter to form or letter mode */
  mode: 'form' | 'letter';
}

const CATEGORY_TABS = [
  { value: 'all', label: 'All Templates' },
  { value: 'Forms', label: 'Forms' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Letters', label: 'Letters' },
] as const;

export function TemplateGallery({ onSelectTemplate, onCancel, mode }: TemplateGalleryProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter templates by mode, then by search & category
  const filtered = useMemo(() => {
    let list = [...STARTER_TEMPLATES];

    // In letter mode, only show letter templates
    if (mode === 'letter') {
      list = list.filter((t) => t.category === 'Letters');
    } else {
      // In form mode, hide letter-only templates unless "Letters" category is selected
      if (categoryFilter !== 'Letters' && categoryFilter !== 'all') {
        list = list.filter((t) => t.category !== 'Letters');
      }
    }

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      );
    }

    return list;
  }, [search, categoryFilter, mode]);

  const selectedTemplate = selectedId
    ? STARTER_TEMPLATES.find((t) => t.id === selectedId) ?? null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Layers className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {mode === 'letter' ? 'Choose a Letter Template' : 'Choose a Template'}
            </h2>
            <p className="text-xs text-gray-500">
              Start from a pre-built template or create from scratch
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Search & Category Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-white border-gray-200"
              />
            </div>

            {mode !== 'letter' && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setCategoryFilter(tab.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      categoryFilter === tab.value
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No templates match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((template) => {
                const isSelected = selectedId === template.id;
                const Icon = template.icon;

                return (
                  <Card
                    key={template.id}
                    className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? 'ring-2 ring-purple-500 border-purple-300 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedId(template.id)}
                    onDoubleClick={() => onSelectTemplate(template)}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="h-5 w-5 text-purple-600" />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2.5 rounded-lg flex-shrink-0 ${
                            template.category === 'Letters'
                              ? 'bg-violet-50'
                              : template.category === 'Legal'
                                ? 'bg-blue-50'
                                : 'bg-gray-100'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              template.category === 'Letters'
                                ? 'text-violet-500'
                                : template.category === 'Legal'
                                  ? 'text-blue-500'
                                  : 'text-gray-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {template.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-gray-200 text-gray-500"
                            >
                              {template.category}
                            </Badge>
                            {template.id !== 'blank' && template.id !== 'blank_letter' && (
                              <span className="text-[10px] text-gray-400">
                                ~{template.pageEstimate} page{template.pageEstimate !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {template.description}
                      </p>

                      {template.tags.length > 0 && template.id !== 'blank' && template.id !== 'blank_letter' && (
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="text-sm text-gray-500">
          {selectedTemplate ? (
            <span>
              Selected: <strong className="text-gray-900">{selectedTemplate.name}</strong>
              {selectedTemplate.blocks.length > 0 && (
                <span className="ml-2 text-gray-400">
                  ({selectedTemplate.blocks.length} blocks)
                </span>
              )}
            </span>
          ) : (
            <span>Select a template to continue</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedTemplate && onSelectTemplate(selectedTemplate)}
            disabled={!selectedTemplate}
            className="bg-purple-700 hover:bg-purple-800"
          >
            {selectedTemplate?.id === 'blank' || selectedTemplate?.id === 'blank_letter'
              ? 'Start from Scratch'
              : 'Use Template'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
