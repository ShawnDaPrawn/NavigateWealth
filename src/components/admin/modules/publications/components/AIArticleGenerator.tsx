/**
 * AIArticleGenerator — Full Article Generation from Brief (Phase 5)
 *
 * Modal dialog that collects a structured article brief and generates
 * a complete article via the OpenAI workflow. The generated content
 * is passed back to the caller to be loaded into the standard
 * ArticleEditor — making AI-generated and manually-written articles
 * completely indistinguishable after creation.
 *
 * @module publications/components/AIArticleGenerator
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Users,
  BookOpen,
  Briefcase,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type {
  GenerateArticleBrief,
  GenerateArticleResult,
  ContentTemplate,
  Category,
} from '../types';
import { toast } from 'sonner@2.0.3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIArticleGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the generated result to load into ArticleEditor */
  onGenerated: (result: GenerateArticleResult & { categoryId?: string }) => void;
  categories: Category[];
}

type Audience = 'advisors' | 'clients' | 'both';
type Tone = 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
type TargetLength = 'short' | 'medium' | 'long';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'advisors', label: 'Financial Advisors', description: 'Technical, regulation-aware', icon: <Briefcase className="h-4 w-4" /> },
  { value: 'clients', label: 'Clients', description: 'Accessible, educational', icon: <Users className="h-4 w-4" /> },
  { value: 'both', label: 'Both', description: 'Professional yet approachable', icon: <BookOpen className="h-4 w-4" /> },
];

const TONE_OPTIONS: { value: Tone; label: string; emoji: string }[] = [
  { value: 'professional', label: 'Professional', emoji: '👔' },
  { value: 'conversational', label: 'Conversational', emoji: '💬' },
  { value: 'authoritative', label: 'Authoritative', emoji: '🏛' },
  { value: 'friendly', label: 'Friendly', emoji: '🤝' },
  { value: 'educational', label: 'Educational', emoji: '📚' },
];

const LENGTH_OPTIONS: { value: TargetLength; label: string; words: string }[] = [
  { value: 'short', label: 'Short', words: '400-600 words' },
  { value: 'medium', label: 'Medium', words: '800-1 200 words' },
  { value: 'long', label: 'Long', words: '1 500-2 000 words' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIArticleGenerator({
  isOpen,
  onClose,
  onGenerated,
  categories,
}: AIArticleGeneratorProps) {
  // Brief state
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState<Audience>('both');
  const [tone, setTone] = useState<Tone>('professional');
  const [targetLength, setTargetLength] = useState<TargetLength>('medium');
  const [categoryId, setCategoryId] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Template support
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Load templates on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      setTemplatesLoading(true);
      try {
        const data = await PublicationsAPI.Templates.getTemplates();
        if (!cancelled) setTemplates(data);
      } catch {
        // Non-critical — templates are optional
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setTopic('');
      setAudience('both');
      setTone('professional');
      setTargetLength('medium');
      setCategoryId('');
      setKeyPoints([]);
      setNewKeyPoint('');
      setAdditionalInstructions('');
      setSelectedTemplateId('');
      setError(null);
      setProgress(null);
    }
  }, [isOpen]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const addKeyPoint = useCallback(() => {
    const point = newKeyPoint.trim();
    if (point && keyPoints.length < 8) {
      setKeyPoints((prev) => [...prev, point]);
      setNewKeyPoint('');
    }
  }, [newKeyPoint, keyPoints.length]);

  const removeKeyPoint = useCallback((index: number) => {
    setKeyPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyPointKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addKeyPoint();
      }
    },
    [addKeyPoint]
  );

  const canGenerate = topic.trim().length >= 3;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);
    setProgress('Preparing article brief...');

    try {
      const brief: GenerateArticleBrief = {
        topic: topic.trim(),
        audience,
        tone,
        targetLength,
        categoryName: selectedCategory?.name,
        keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
        templateBody: selectedTemplate?.body || undefined,
        additionalInstructions: additionalInstructions.trim() || undefined,
        // When no category is selected, pass all available category names for auto-detection
        availableCategories: !categoryId
          ? categories.filter((c) => c.is_active).map((c) => c.name)
          : undefined,
      };

      setProgress('Generating article with AI — this may take 15-30 seconds...');

      const result = await PublicationsAPI.AI.generateArticle(brief);

      // Resolve category: use explicit selection, or map AI-suggested name back to ID
      let resolvedCategoryId = categoryId || undefined;
      if (!resolvedCategoryId && result.suggestedCategoryName) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === result.suggestedCategoryName!.toLowerCase()
        );
        if (match) {
          resolvedCategoryId = match.id;
        }
      }

      toast.success('Article generated successfully');
      onGenerated({ ...result, categoryId: resolvedCategoryId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate article';
      setError(message);
      console.error('Article generation error:', err);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  }, [
    canGenerate, topic, audience, tone, targetLength,
    selectedCategory, keyPoints, selectedTemplate,
    additionalInstructions, categoryId, onGenerated,
    categories,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate Article with AI</h2>
              <p className="text-xs text-gray-500">
                Describe your article — AI generates a complete first draft
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isGenerating}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Topic / Working Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Understanding Retirement Annuities in South Africa"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isGenerating}
              maxLength={500}
              autoFocus
            />
            <p className="text-[11px] text-gray-400 mt-1">{topic.length}/500 characters</p>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Category</label>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white pr-8"
                disabled={isGenerating}
              >
                <option value="">Auto-detect from topic</option>
                {categories.filter((c) => c.is_active).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Target Audience</label>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudience(opt.value)}
                  disabled={isGenerating}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border-2 text-center transition-all',
                    audience === opt.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  )}
                >
                  {opt.icon}
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-gray-400">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone + Length row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tone */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Tone</label>
              <div className="space-y-1">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTone(opt.value)}
                    disabled={isGenerating}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-all',
                      tone === opt.value
                        ? 'bg-purple-50 text-purple-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-600'
                    )}
                  >
                    <span className="text-sm">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Article Length</label>
              <div className="space-y-1.5">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetLength(opt.value)}
                    disabled={isGenerating}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 text-sm transition-all',
                      targetLength === opt.value
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[11px] text-gray-400">{opt.words}</span>
                  </button>
                ))}
              </div>

              {/* Template (optional) */}
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Structure Template
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white pr-8"
                    disabled={isGenerating || templatesLoading}
                  >
                    <option value="">No template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon ? `${t.icon} ` : ''}{t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Key Points */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Key Points to Cover
              <span className="text-gray-400 font-normal ml-1">(optional, up to 8)</span>
            </label>
            {keyPoints.length > 0 && (
              <div className="space-y-1 mb-2">
                {keyPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg group"
                  >
                    <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                    <span className="text-sm text-gray-700 flex-1">{point}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyPoint(idx)}
                      disabled={isGenerating}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {keyPoints.length < 8 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newKeyPoint}
                  onChange={(e) => setNewKeyPoint(e.target.value)}
                  onKeyDown={handleKeyPointKeyDown}
                  placeholder="Add a key point and press Enter"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isGenerating}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addKeyPoint}
                  disabled={isGenerating || !newKeyPoint.trim()}
                  className="h-[38px] px-3"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Additional Instructions */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Additional Instructions
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Paste as much context as you need — research notes, source material, specific data points, compliance wording, client scenarios, or detailed style guidance..."
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y min-h-[120px]"
              disabled={isGenerating}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 h-6 px-1 mt-1"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {isGenerating && progress && (
              <div className="flex items-center gap-2 text-purple-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">{progress}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-1.5"
            >
              {isGenerating ? (
                <div className="contents">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </div>
              ) : (
                <div className="contents">
                  <Zap className="h-3.5 w-3.5" />
                  Generate Article
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}