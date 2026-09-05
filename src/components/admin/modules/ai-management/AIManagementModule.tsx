/**
 * AI Management Module
 *
 * Control plane for Vasco and the other AI assistants. Five tabs, each with
 * one job:
 *
 *   Overview   — switch Vasco on/off, see usage, list the assistants
 *   Knowledge  — what Vasco can draw on (articles + knowledge base entries)
 *   Prompts    — the instructions that shape how each assistant answers
 *   Feedback   — ratings people gave to answers
 *   Leads      — visitors who asked to speak to an adviser
 *
 * Guidelines: §7, §8.3, §8.4
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquareText,
  ThumbsUp,
  PhoneForwarded,
  Bot,
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { TAB_CONFIG } from './constants';
import { OverviewTab } from './components/OverviewTab';
import { KnowledgeBase } from './components/KnowledgeBase';
import { PromptStudio } from './components/PromptStudio';
import { FeedbackReview } from './components/FeedbackReview';
import { HandoffQueue } from './components/HandoffQueue';
import type { AIManagementTab } from './types';

const TAB_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  BookOpen,
  MessageSquareText,
  ThumbsUp,
  PhoneForwarded,
};

export function AIManagementModule() {
  const [activeTab, setActiveTab] = useState<AIManagementTab>('overview');
  const active = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0];

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Switch Vasco on or off, manage what it knows, and shape how it answers.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="space-y-2">
          <nav
            className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 overflow-x-auto"
            aria-label="AI Management sections"
            role="tablist"
          >
            {TAB_CONFIG.map((tab) => {
              const Icon = TAB_ICONS[tab.icon] ?? Bot;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`ai-tab-${tab.id}`}
                  title={tab.description}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <p className="text-xs text-gray-500 px-1" aria-live="polite">
            <span className="font-medium text-gray-700">{active.label}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            {active.description}
          </p>
        </div>

        {/* Tab Content */}
        <div id={`ai-tab-${activeTab}`} role="tabpanel" className="contents">
          {activeTab === 'overview' && <OverviewTab onNavigate={setActiveTab} />}
          {activeTab === 'knowledge' && <KnowledgeBase />}
          {activeTab === 'prompts' && <PromptStudio />}
          {activeTab === 'feedback' && <FeedbackReview />}
          {activeTab === 'leads' && <HandoffQueue />}
        </div>
      </div>
    </div>
  );
}
