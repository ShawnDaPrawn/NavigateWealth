/**
 * AI Management Module
 *
 * Central control plane for all AI agents in Navigate Wealth.
 * Phase 1: Dashboard, agent registry (read-only), analytics,
 * feedback review, and handoff queue.
 * Phase 2: Knowledge Base with custom content CRUD.
 *
 * Guidelines: §7, §8.3, §8.4
 */

import React, { useState } from 'react';
import {
  LayoutDashboard, Bot, BarChart3, MessageSquare, PhoneForwarded, BookOpen,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import { AgentDashboard } from './components/AgentDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { FeedbackReview } from './components/FeedbackReview';
import { HandoffQueue } from './components/HandoffQueue';
import { KnowledgeBase } from './components/KnowledgeBase';
import { PromptStudio } from './components/PromptStudio';
import type { AIManagementTab } from './types';

// ── Tab config ─────────────────────────────────────────────────────────────
const TABS: Array<{
  id: AIManagementTab;
  label: string;
  icon: React.ElementType;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { id: 'prompt-studio', label: 'Prompt Studio', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'handoffs', label: 'Handoffs', icon: PhoneForwarded },
];

export function AIManagementModule() {
  const [activeTab, setActiveTab] = useState<AIManagementTab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor and manage all AI agents across the Navigate Wealth platform
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5" aria-label="AI Management tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'gap-2 rounded-lg transition-all',
                  isActive
                    ? 'bg-purple-600 text-white hover:bg-purple-700 hover:text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="contents">
          {activeTab === 'dashboard' && <AgentDashboard />}
          {activeTab === 'agents' && <AgentDashboard />}
          {activeTab === 'knowledge-base' && <KnowledgeBase />}
          {activeTab === 'prompt-studio' && <PromptStudio />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'feedback' && <FeedbackReview />}
          {activeTab === 'handoffs' && <HandoffQueue />}
        </div>
      </div>
    </div>
  );
}