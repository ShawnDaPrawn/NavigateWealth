/**
 * AgentDashboard — Overview tab
 *
 * Stat cards + agent registry cards + RAG index status.
 * Read-only in Phase 1; agent config editing comes in Phase 2.
 *
 * Guidelines: §7, §8.3
 */

import React from 'react';
import {
  MessageSquare, Users, ThumbsUp, PhoneForwarded,
  Database, RefreshCw, Compass, Brain, ScrollText,
  Calculator, Bot, Power, PowerOff, Loader2,
  Check, X, Zap, BookOpen, AlertCircle,
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { cn } from '../../../../ui/utils';
import {
  useAgents, useVascoConfig, useToggleVasco,
  useAnalyticsSummary, useRagIndexStatus, useTriggerReindex,
} from '../hooks';
import { AGENT_STATUS_CONFIG } from '../constants';
import type { AIAgentConfig } from '../types';

// ── Icon resolver for agent config slugs ───────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Compass, Brain, ScrollText, Calculator, Bot,
};
function resolveIcon(slug: string): React.ElementType {
  return ICON_MAP[slug] || Bot;
}

// ── Stat Card (§8.3 — established pattern) ─────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, subtitle }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AIAgentConfig }) {
  const Icon = resolveIcon(agent.icon);
  const statusCfg = AGENT_STATUS_CONFIG[agent.status];

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2.5 rounded-lg bg-purple-50">
          <Icon className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{agent.name}</h3>
          <p className="text-xs text-gray-500">{agent.model} &middot; temp {agent.temperature}</p>
        </div>
        <Badge className={cn('text-xs shrink-0', statusCfg.badgeClass)}>
          <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', statusCfg.dotClass)} />
          {statusCfg.label}
        </Badge>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
        {agent.description}
      </p>

      {/* Feature badges */}
      <div className="flex flex-wrap gap-1.5">
        {agent.features.ragEnabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            <Database className="h-3 w-3" /> RAG
          </span>
        )}
        {agent.features.streamingEnabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700">
            <Zap className="h-3 w-3" /> Streaming
          </span>
        )}
        {agent.features.feedbackEnabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-green-50 text-green-700">
            <ThumbsUp className="h-3 w-3" /> Feedback
          </span>
        )}
        {agent.features.handoffEnabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700">
            <PhoneForwarded className="h-3 w-3" /> Handoff
          </span>
        )}
        {agent.features.citationsEnabled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            <BookOpen className="h-3 w-3" /> Citations
          </span>
        )}
      </div>

      {/* Context tags */}
      <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100">
        {agent.contexts.map(ctx => (
          <span
            key={ctx}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize"
          >
            {ctx}
          </span>
        ))}
        {agent.rateLimit && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {agent.rateLimit.perSession}/session &middot; {agent.rateLimit.perDay}/day
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export function AgentDashboard() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: vascoConfig } = useVascoConfig();
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsSummary();
  const { data: ragIndex } = useRagIndexStatus();
  const toggleVasco = useToggleVasco();
  const triggerReindex = useTriggerReindex();

  const feedbackRate = analytics
    ? analytics.totalFeedbackPositive + analytics.totalFeedbackNegative > 0
      ? Math.round((analytics.totalFeedbackPositive / (analytics.totalFeedbackPositive + analytics.totalFeedbackNegative)) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Vasco Master Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-lg transition-colors',
              vascoConfig?.enabled ? 'bg-green-50' : 'bg-gray-100'
            )}>
              {vascoConfig?.enabled ? (
                <Power className="h-5 w-5 text-green-600" />
              ) : (
                <PowerOff className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Vasco Public Chat</h3>
              <p className="text-xs text-gray-500">
                {vascoConfig?.enabled
                  ? 'Live on the public website'
                  : 'Disabled — visitors cannot chat with Vasco'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vascoConfig && (
              <span className="text-xs text-gray-400">
                Last changed{' '}
                {new Date(vascoConfig.updatedAt).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            )}
            <Switch
              checked={vascoConfig?.enabled ?? false}
              onCheckedChange={(checked) => toggleVasco.mutate(checked)}
              disabled={toggleVasco.isPending}
              aria-label="Toggle Vasco public chat"
            />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Conversations (7d)"
          value={analyticsLoading ? '...' : (analytics?.totalSessions ?? 0)}
          icon={Users}
          iconBg="bg-blue-50"
          subtitle={`${analytics?.totalMessages ?? 0} total messages`}
        />
        <StatCard
          label="Positive Feedback"
          value={analyticsLoading ? '...' : `${feedbackRate}%`}
          icon={ThumbsUp}
          iconBg="bg-green-50"
          subtitle={`${(analytics?.totalFeedbackPositive ?? 0) + (analytics?.totalFeedbackNegative ?? 0)} total ratings`}
        />
        <StatCard
          label="RAG Hits (7d)"
          value={analyticsLoading ? '...' : (analytics?.totalRagHits ?? 0)}
          icon={Database}
          iconBg="bg-purple-50"
          subtitle={ragIndex ? `${ragIndex.totalChunks} chunks indexed` : 'No index'}
        />
        <StatCard
          label="Adviser Handoffs"
          value={analyticsLoading ? '...' : (analytics?.totalHandoffs ?? 0)}
          icon={PhoneForwarded}
          iconBg="bg-amber-50"
          subtitle="Leads captured (7d)"
        />
      </div>

      {/* RAG Index Status */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Knowledge Base Index</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerReindex.mutate()}
            disabled={triggerReindex.isPending}
            className="gap-2"
          >
            {triggerReindex.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {triggerReindex.isPending ? 'Indexing...' : 'Re-index Articles'}
          </Button>
        </div>
        {ragIndex ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Articles indexed</span>
              <p className="font-semibold text-gray-900">{ragIndex.articles.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Total chunks</span>
              <p className="font-semibold text-gray-900">{ragIndex.totalChunks}</p>
            </div>
            <div>
              <span className="text-gray-500">Last indexed</span>
              <p className="font-semibold text-gray-900">
                {new Date(ragIndex.lastFullIndex).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            No articles indexed yet. Click "Re-index Articles" to build the knowledge base.
          </div>
        )}
      </div>

      {/* Agent Registry */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Registered AI Agents</h3>
          <Badge variant="secondary" className="text-xs">
            {agents?.length ?? 0} agents
          </Badge>
        </div>
        {agentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents?.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
