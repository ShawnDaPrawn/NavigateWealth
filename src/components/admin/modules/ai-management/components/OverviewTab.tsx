/**
 * OverviewTab — the first thing an admin sees.
 *
 * Answers four questions in order: Is Vasco on? How much is it being used?
 * Is anything waiting for me (leads, knowledge that is not indexed)? Which
 * assistants exist? Everything actionable links to the tab where the action
 * lives.
 *
 * Guidelines: §7, §8.3
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Power,
  PowerOff,
  Users,
  ThumbsUp,
  PhoneForwarded,
  BookOpen,
  Bot,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { Switch } from '../../../../ui/switch';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import {
  useAgents,
  useVascoConfig,
  useToggleVasco,
  useAnalyticsSummary,
  useRagIndexStatus,
  useHandoffs,
} from '../hooks';
import { AGENT_CONTEXT_LABELS, AGENT_STATUS_CONFIG } from '../constants';
import { formatDate, plural } from '../format';
import type { AIManagementTab } from '../types';

interface OverviewTabProps {
  onNavigate: (tab: AIManagementTab) => void;
}

// ── Stat tile ──────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  onClick,
  actionLabel,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  icon: React.ElementType;
  tone?: 'neutral' | 'good' | 'warn';
  onClick?: () => void;
  actionLabel?: string;
}) {
  const toneClasses = {
    neutral: 'bg-gray-100 text-gray-600',
    good: 'bg-green-50 text-green-600',
    warn: 'bg-amber-50 text-amber-600',
  }[tone];

  const body = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={cn('p-2 rounded-lg', toneClasses)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-1 min-h-[1rem]">{detail}</p>
      {onClick && actionLabel && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-purple-700">
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all w-full"
      >
        {body}
      </button>
    );
  }
  return <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">{body}</div>;
}

// ── Main ───────────────────────────────────────────────────────────────────
export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { data: vascoConfig, isLoading: configLoading } = useVascoConfig();
  const toggleVasco = useToggleVasco();
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsSummary();
  const { data: index } = useRagIndexStatus();
  const { data: newLeads } = useHandoffs('new');
  const { data: agents, isLoading: agentsLoading } = useAgents();

  const enabled = vascoConfig?.enabled ?? false;

  const ratings = (analytics?.totalFeedbackPositive ?? 0) + (analytics?.totalFeedbackNegative ?? 0);
  const helpfulPct =
    ratings > 0 ? Math.round(((analytics?.totalFeedbackPositive ?? 0) / ratings) * 100) : null;

  const indexedSources = (index?.articles.length ?? 0) + (index?.kbEntries.length ?? 0);
  const waiting = (index?.pendingArticles ?? 0) + (index?.pendingKbEntries ?? 0);
  const knowledgeNeedsAttention = !!index && (waiting > 0 || index.staleSources > 0);

  const chartData = (analytics?.last7Days ?? []).map((day) => ({
    date: new Date(day.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
    Messages: day.messages,
    Conversations: day.sessions,
  }));

  return (
    <div className="space-y-6">
      {/* ── Vasco switch ─────────────────────────────────────────────── */}
      <section
        className={cn(
          'rounded-xl border shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4',
          enabled ? 'bg-white border-green-200' : 'bg-white border-gray-200',
        )}
        aria-labelledby="vasco-switch-heading"
      >
        <div className={cn('p-3 rounded-xl shrink-0', enabled ? 'bg-green-50' : 'bg-gray-100')}>
          {enabled ? (
            <Power className="h-6 w-6 text-green-600" />
          ) : (
            <PowerOff className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="vasco-switch-heading" className="text-base font-semibold text-gray-900">
            {configLoading
              ? 'Checking Vasco…'
              : enabled
                ? 'Vasco is live on the public website'
                : 'Vasco is switched off on the public website'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            This switch controls the chat widget visitors see on the website. Logged-in clients
            always have their portal assistant.
            {vascoConfig && (
              <span className="text-gray-400">
                {' '}
                Last changed {formatDate(vascoConfig.updatedAt)}.
              </span>
            )}
          </p>
        </div>
        <label className="flex items-center gap-3 shrink-0 cursor-pointer">
          <span className="text-sm font-medium text-gray-700">{enabled ? 'On' : 'Off'}</span>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => toggleVasco.mutate(checked)}
            disabled={toggleVasco.isPending || configLoading}
            aria-label="Vasco public website chat"
          />
        </label>
      </section>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Conversations, last 7 days"
          value={analyticsLoading ? '…' : (analytics?.totalSessions ?? 0)}
          detail={analyticsLoading ? '' : plural(analytics?.totalMessages ?? 0, 'message')}
          icon={Users}
        />
        <StatTile
          label="Answers rated helpful"
          value={analyticsLoading ? '…' : helpfulPct === null ? '—' : `${helpfulPct}%`}
          detail={ratings === 0 ? 'No ratings yet' : `from ${plural(ratings, 'rating')}`}
          icon={ThumbsUp}
          tone={helpfulPct !== null && helpfulPct >= 70 ? 'good' : 'neutral'}
          onClick={() => onNavigate('feedback')}
          actionLabel="Read feedback"
        />
        <StatTile
          label="Leads waiting for a call"
          value={newLeads ? newLeads.length : '…'}
          detail={
            newLeads && newLeads.length > 0
              ? 'Visitors who asked to speak to an adviser'
              : 'Nobody is waiting right now'
          }
          icon={PhoneForwarded}
          tone={newLeads && newLeads.length > 0 ? 'warn' : 'neutral'}
          onClick={() => onNavigate('leads')}
          actionLabel="Open leads"
        />
        <StatTile
          label="Knowledge Vasco can use"
          value={index ? indexedSources : '…'}
          detail={
            !index ? (
              ''
            ) : knowledgeNeedsAttention ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {waiting > 0
                  ? `${plural(waiting, 'source')} waiting to be indexed`
                  : `${plural(index.staleSources, 'stale source')} to remove`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                {`${plural(index.articles.length, 'article')} · ${plural(index.kbEntries.length, 'entry', 'entries')}`}
              </span>
            )
          }
          icon={BookOpen}
          tone={knowledgeNeedsAttention ? 'warn' : 'neutral'}
          onClick={() => onNavigate('knowledge')}
          actionLabel="Manage knowledge"
        />
      </div>

      {/* ── Usage ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Conversations over the last 7 days
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Public website only. One conversation can hold many messages.
          </p>
          {analyticsLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-500">
              No conversations yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="Messages"
                    stroke="#7c3aed"
                    fill="#7c3aed"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Conversations"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">What people ask about</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">Most common topics in the last 7 days.</p>
          {analytics && analytics.topTopics.length > 0 ? (
            <ol className="space-y-3">
              {analytics.topTopics.slice(0, 8).map((topic, idx) => {
                const max = analytics.topTopics[0].count;
                const pct = max > 0 ? (topic.count / max) * 100 : 0;
                return (
                  <li key={topic.topic} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 text-right tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {topic.topic}
                        </span>
                        <span className="text-xs text-gray-500 ml-2 shrink-0 tabular-nums">
                          {topic.count}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center">No topics recorded yet.</p>
          )}
        </section>
      </div>

      {/* ── Assistants ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Assistants</h3>
              {agents && (
                <Badge variant="secondary" className="text-xs">
                  {agents.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Every AI assistant on the platform. Settings shown here are read-only; the
              instructions for the two Vasco assistants are edited on the Prompts tab.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('prompts')}
            className="text-xs font-medium text-purple-700 inline-flex items-center gap-1 shrink-0 hover:underline"
          >
            Edit prompts <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {agentsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Assistant
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Where it runs
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Uses knowledge
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Model
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-2.5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(agents ?? []).map((agent) => {
                  const statusCfg = AGENT_STATUS_CONFIG[agent.status];
                  return (
                    <tr key={agent.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1 max-w-md">
                          {agent.description}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {agent.contexts.map((ctx) => AGENT_CONTEXT_LABELS[ctx] ?? ctx).join(', ')}
                      </td>
                      <td className="px-5 py-3">
                        {agent.features.ragEnabled ? (
                          <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700 font-mono text-xs">{agent.model}</td>
                      <td className="px-5 py-3">
                        <Badge className={cn('text-xs', statusCfg.badgeClass)}>
                          {statusCfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
