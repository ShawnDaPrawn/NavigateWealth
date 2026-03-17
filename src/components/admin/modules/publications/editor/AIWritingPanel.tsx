/**
 * AIWritingPanel — AI Writing Assistant for TipTap Editor (Phase 3)
 *
 * Slide-out panel providing AI-powered content generation, transformation,
 * compliance checking, and SEO optimisation tools. Integrates with the
 * TipTap editor via the editor instance and article metadata context.
 *
 * Features:
 *  - Quick-action buttons for common operations (improve, expand, summarize, etc.)
 *  - Tone adjustment with 5 presets
 *  - Headline and excerpt generators
 *  - Financial compliance checker
 *  - SEO optimiser
 *  - Free-form custom AI prompt
 *  - Insert / Replace / Copy result controls
 *  - History of recent AI interactions (session-scoped)
 *
 * @module publications/editor/AIWritingPanel
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Sparkles,
  X,
  Wand2,
  Expand,
  Shrink,
  ArrowRight,
  Volume2,
  Heading,
  FileText,
  ShieldCheck,
  Search,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Replace,
  Plus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MessageSquare,
  SpellCheck,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type { AIAction, AIWritingRequest, AIWritingResponse } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIWritingPanelProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  articleTitle?: string;
  articleExcerpt?: string;
  articleCategory?: string;
}

interface HistoryEntry {
  id: string;
  action: AIAction;
  label: string;
  input: string;
  result: AIWritingResponse;
  timestamp: Date;
}

type ToneOption = 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';

// ---------------------------------------------------------------------------
// Quick action configuration
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: {
  action: AIAction;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresSelection: boolean;
  category: 'transform' | 'generate' | 'analyse';
}[] = [
  {
    action: 'improve',
    label: 'Improve Writing',
    description: 'Enhance clarity, flow and professionalism',
    icon: <Wand2 className="h-4 w-4" />,
    requiresSelection: true,
    category: 'transform',
  },
  {
    action: 'expand',
    label: 'Expand',
    description: 'Add more detail and depth',
    icon: <Expand className="h-4 w-4" />,
    requiresSelection: true,
    category: 'transform',
  },
  {
    action: 'summarize',
    label: 'Summarize',
    description: 'Condense to key points',
    icon: <Shrink className="h-4 w-4" />,
    requiresSelection: true,
    category: 'transform',
  },
  {
    action: 'continue',
    label: 'Continue Writing',
    description: 'AI writes the next paragraphs',
    icon: <ArrowRight className="h-4 w-4" />,
    requiresSelection: false,
    category: 'generate',
  },
  {
    action: 'fix_grammar',
    label: 'Fix Grammar',
    description: 'Correct spelling and grammar',
    icon: <SpellCheck className="h-4 w-4" />,
    requiresSelection: true,
    category: 'transform',
  },
  {
    action: 'headline',
    label: 'Generate Headlines',
    description: 'Get 5 headline suggestions',
    icon: <Heading className="h-4 w-4" />,
    requiresSelection: false,
    category: 'generate',
  },
  {
    action: 'excerpt',
    label: 'Generate Excerpt',
    description: 'Auto-create article summary',
    icon: <FileText className="h-4 w-4" />,
    requiresSelection: false,
    category: 'generate',
  },
  {
    action: 'generate_callout',
    label: 'Generate Callout',
    description: 'Create a callout box from content',
    icon: <Lightbulb className="h-4 w-4" />,
    requiresSelection: true,
    category: 'generate',
  },
  {
    action: 'compliance_check',
    label: 'Compliance Check',
    description: 'Review for regulatory issues',
    icon: <ShieldCheck className="h-4 w-4" />,
    requiresSelection: false,
    category: 'analyse',
  },
  {
    action: 'seo_optimize',
    label: 'SEO Analysis',
    description: 'Get optimisation suggestions',
    icon: <Search className="h-4 w-4" />,
    requiresSelection: false,
    category: 'analyse',
  },
];

const TONE_OPTIONS: { value: ToneOption; label: string; emoji: string }[] = [
  { value: 'professional', label: 'Professional', emoji: '👔' },
  { value: 'conversational', label: 'Conversational', emoji: '💬' },
  { value: 'authoritative', label: 'Authoritative', emoji: '🏛️' },
  { value: 'friendly', label: 'Friendly', emoji: '🤝' },
  { value: 'educational', label: 'Educational', emoji: '📚' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIWritingPanel({
  editor,
  isOpen,
  onClose,
  articleTitle,
  articleExcerpt,
  articleCategory,
}: AIWritingPanelProps) {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [result, setResult] = useState<AIWritingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  const resultRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Track editor selection
  useEffect(() => {
    if (!editor || !isOpen) return;

    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, '\n');
        setSelectedText(text);
      } else {
        setSelectedText('');
      }
    };

    updateSelection();
    editor.on('selectionUpdate', updateSelection);
    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor, isOpen]);

  // Scroll result into view
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [result]);

  // Get context from the editor
  const getEditorContent = useCallback(() => {
    return editor.state.doc.textContent;
  }, [editor]);

  // Get selected HTML from the editor
  const getSelectedHTML = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      return editor.state.doc.textBetween(from, to, '\n');
    }
    return '';
  }, [editor]);

  // Get surrounding context from the editor
  const getSurroundingContext = useCallback(() => {
    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    return $pos.parent.textContent.slice(0, 500);
  }, [editor]);

  // Execute AI action
  const executeAction = useCallback(
    async (action: AIAction, tone?: ToneOption) => {
      setIsLoading(true);
      setActiveAction(action);
      setError(null);
      setResult(null);

      try {
        const selection = getSelectedHTML();
        const fullContent = getEditorContent();
        const context = getSurroundingContext();

        let content = '';
        if (action === 'continue') {
          // Use content up to cursor position
          const { from } = editor.state.selection;
          content = editor.state.doc.textBetween(0, from, '\n').slice(-2000);
        } else if (
          ['compliance_check', 'seo_optimize', 'headline', 'excerpt'].includes(action) &&
          !selection
        ) {
          content = fullContent.slice(0, 8000);
        } else if (selection) {
          content = selection;
        } else {
          content = fullContent.slice(0, 4000);
        }

        if (!content.trim()) {
          setError(
            action === 'continue'
              ? 'Place your cursor where you want AI to continue writing.'
              : 'Select text in the editor or write some content first.'
          );
          setIsLoading(false);
          setActiveAction(null);
          return;
        }

        const request: AIWritingRequest = {
          action,
          content,
          context,
          tone,
          prompt: action === 'custom' ? customPrompt : undefined,
          articleTitle,
          articleExcerpt,
          articleCategory,
        };

        const response = await PublicationsAPI.AI.generate(request);
        setResult(response);

        // Add to history
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          action,
          label: QUICK_ACTIONS.find((a) => a.action === action)?.label || action,
          input: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          result: response,
          timestamp: new Date(),
        };
        setHistory((prev) => [entry, ...prev].slice(0, 20));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI request failed';
        setError(msg);
        console.error('AI writing error:', err);
      } finally {
        setIsLoading(false);
        setActiveAction(null);
      }
    },
    [editor, articleTitle, articleExcerpt, articleCategory, customPrompt, getEditorContent, getSelectedHTML, getSurroundingContext]
  );

  // Listen for AI actions dispatched from slash commands
  // NOTE: This useEffect is placed after executeAction's useCallback so that
  // the dependency reference is valid (no temporal dead zone).
  useEffect(() => {
    const handleAIExecute = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action && isOpen) {
        executeAction(detail.action as AIAction);
      }
    };

    window.addEventListener('tiptap:ai-execute', handleAIExecute);
    return () => {
      window.removeEventListener('tiptap:ai-execute', handleAIExecute);
    };
  }, [isOpen, executeAction]);

  // Custom prompt handler
  const handleCustomPrompt = useCallback(() => {
    if (!customPrompt.trim()) return;
    executeAction('custom');
  }, [customPrompt, executeAction]);

  // Insert result into editor
  const handleInsert = useCallback(() => {
    if (!editor || !result) return;
    editor.chain().focus().insertContent(result.result).run();
    setResult(null);
  }, [editor, result]);

  // Replace selection with result
  const handleReplace = useCallback(() => {
    if (!editor || !result) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(result.result).run();
    } else {
      editor.chain().focus().insertContent(result.result).run();
    }
    setResult(null);
  }, [editor, result]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      const plainText = result.result.replace(/<[^>]+>/g, '');
      await navigator.clipboard.writeText(plainText);
    } catch {
      // fallback
    }
  }, [result]);

  // Restore from history
  const restoreHistory = useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setShowHistory(false);
  }, []);

  if (!isOpen) return null;

  const hasSelection = selectedText.length > 0;

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI Writing Assistant</h3>
            <p className="text-[10px] text-gray-500">Powered by GPT-4o-mini</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Selection indicator */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 text-xs">
            {hasSelection ? (
              <div className="flex items-center gap-1.5 text-purple-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {selectedText.length} chars selected
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Select text for targeted actions, or use full article</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 space-y-4">
          {/* Transform actions */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Transform
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_ACTIONS.filter((a) => a.category === 'transform').map((action) => (
                <button
                  key={action.action}
                  onClick={() => executeAction(action.action)}
                  disabled={isLoading || (action.requiresSelection && !hasSelection)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all',
                    'border border-gray-200 hover:border-purple-300 hover:bg-purple-50',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    activeAction === action.action && 'border-purple-400 bg-purple-50'
                  )}
                >
                  <span className="text-purple-600">{action.icon}</span>
                  <span className="font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone adjustment */}
          <div>
            <button
              onClick={() => setShowToneMenu(!showToneMenu)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-xs border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
            >
              <Volume2 className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-gray-700 flex-1">Change Tone</span>
              {showToneMenu ? (
                <ChevronUp className="h-3 w-3 text-gray-400" />
              ) : (
                <ChevronDown className="h-3 w-3 text-gray-400" />
              )}
            </button>
            {showToneMenu && (
              <div className="mt-1.5 grid grid-cols-1 gap-1">
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => {
                      executeAction('tone', tone.value);
                      setShowToneMenu(false);
                    }}
                    disabled={isLoading || !hasSelection}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>{tone.emoji}</span>
                    <span>{tone.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate actions */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Generate
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_ACTIONS.filter((a) => a.category === 'generate').map((action) => (
                <button
                  key={action.action}
                  onClick={() => executeAction(action.action)}
                  disabled={isLoading || (action.requiresSelection && !hasSelection)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all',
                    'border border-gray-200 hover:border-purple-300 hover:bg-purple-50',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    activeAction === action.action && 'border-purple-400 bg-purple-50'
                  )}
                >
                  <span className="text-purple-600">{action.icon}</span>
                  <span className="font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Analyse actions */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Analyse
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_ACTIONS.filter((a) => a.category === 'analyse').map((action) => (
                <button
                  key={action.action}
                  onClick={() => executeAction(action.action)}
                  disabled={isLoading}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all',
                    'border border-gray-200 hover:border-purple-300 hover:bg-purple-50',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    activeAction === action.action && 'border-purple-400 bg-purple-50'
                  )}
                >
                  <span className="text-purple-600">{action.icon}</span>
                  <span className="font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <button
              onClick={() => {
                setShowCustom(!showCustom);
                if (!showCustom) {
                  setTimeout(() => promptRef.current?.focus(), 100);
                }
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-xs border border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all"
            >
              <MessageSquare className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-gray-700 flex-1">Custom Prompt</span>
              {showCustom ? (
                <ChevronUp className="h-3 w-3 text-gray-400" />
              ) : (
                <ChevronDown className="h-3 w-3 text-gray-400" />
              )}
            </button>
            {showCustom && (
              <div className="mt-2 space-y-2">
                <textarea
                  ref={promptRef}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Rewrite this section to focus on retirement planning for 30-year-olds..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleCustomPrompt();
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">Ctrl+Enter to send</span>
                  <Button
                    size="sm"
                    onClick={handleCustomPrompt}
                    disabled={isLoading || !customPrompt.trim()}
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    Generate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="px-4 py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
              <Sparkles className="h-4 w-4 text-purple-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-xs text-gray-500">
              {activeAction === 'compliance_check'
                ? 'Reviewing content for compliance issues...'
                : activeAction === 'seo_optimize'
                ? 'Analysing SEO performance...'
                : 'AI is thinking...'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-[10px] text-red-500 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div ref={resultRef} className="px-4 pb-4">
            <div className="border border-purple-200 rounded-xl bg-purple-50/50 overflow-hidden">
              {/* Result header */}
              <div className="flex items-center justify-between px-3 py-2 bg-purple-100/50 border-b border-purple-200">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">
                    AI Result
                  </span>
                </div>
                {result.tokensUsed && (
                  <span className="text-[10px] text-purple-500">
                    {result.tokensUsed} tokens
                  </span>
                )}
              </div>

              {/* Suggestions (headlines, SEO) */}
              {result.suggestions && result.suggestions.length > 1 && result.action === 'headline' && (
                <div className="px-3 py-2 space-y-1 border-b border-purple-100">
                  <p className="text-[10px] font-semibold uppercase text-purple-600 tracking-wider">
                    Suggestions
                  </p>
                  {result.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        navigator.clipboard.writeText(s);
                      }}
                      className="block w-full text-left text-xs text-gray-700 px-2 py-1.5 rounded hover:bg-purple-100 transition-colors"
                    >
                      {i + 1}. {s}
                    </button>
                  ))}
                </div>
              )}

              {/* SEO suggestions */}
              {result.suggestions && result.action === 'seo_optimize' && (
                <div className="px-3 py-2 space-y-1 border-b border-purple-100">
                  <p className="text-[10px] font-semibold uppercase text-purple-600 tracking-wider">
                    SEO Suggestions
                  </p>
                  {result.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-gray-700 py-1"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Compliance warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="px-3 py-2 space-y-1 border-b border-purple-100">
                  <p className="text-[10px] font-semibold uppercase text-amber-600 tracking-wider">
                    Warnings
                  </p>
                  {result.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-amber-700 py-1"
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Main result content */}
              <div className="px-3 py-3">
                <div
                  className="text-xs text-gray-700 leading-relaxed prose prose-xs max-w-none max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: result.result }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-100/30 border-t border-purple-200">
                {result.action !== 'compliance_check' &&
                  result.action !== 'seo_optimize' &&
                  result.action !== 'headline' && (
                    <div className="contents">
                      {hasSelection ? (
                        <Button
                          size="sm"
                          onClick={handleReplace}
                          className="h-7 text-[11px] bg-purple-600 hover:bg-purple-700"
                        >
                          <Replace className="h-3 w-3 mr-1" />
                          Replace
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleInsert}
                          className="h-7 text-[11px] bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Insert
                        </Button>
                      )}
                    </div>
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-[11px]"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResult(null)}
                  className="h-7 text-[11px] ml-auto"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Recent ({history.length})
              {showHistory ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => restoreHistory(entry)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100">
                      <Sparkles className="h-3 w-3 text-gray-400 group-hover:text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-gray-700 truncate">
                        {entry.label}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {entry.input}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {entry.timestamp.toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
        <p className="text-[10px] text-gray-400 text-center">
          AI-generated content should always be reviewed for accuracy and compliance
        </p>
      </div>
    </div>
  );
}