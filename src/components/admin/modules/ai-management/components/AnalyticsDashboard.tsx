/**
 * AnalyticsDashboard — Analytics tab
 *
 * Displays 7-day metrics chart and top topics from Vasco analytics.
 * Guidelines: §7, §8.3
 */

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import { Loader2, TrendingUp, MessageSquare, Database, AlertTriangle } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import { PlatformFeaturesCard } from '../../dashboard/components/PlatformFeaturesCard';
import { VascoAnalyticsCard } from '../../dashboard/components/VascoAnalyticsCard';
import { useAnalyticsSummary } from '../hooks';

export function AnalyticsDashboard() {
  const { data: analytics, isLoading, error } = useAnalyticsSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">Unable to load analytics data. Please try again.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = analytics.last7Days.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
    sessions: day.sessions,
    messages: day.messages,
    ragHits: day.ragHits,
    positive: day.feedbackPositive,
    negative: day.feedbackNegative,
    rateLimited: day.rateLimited,
  }));

  return (
    <div className="space-y-6">
      {/* AI Control & Health Row — feature flags + high-level analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformFeaturesCard />
        <VascoAnalyticsCard />
      </div>

      {/* Message Volume Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-900">Conversation Volume (7 Days)</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
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
                dataKey="messages"
                name="Messages"
                stroke="#7c3aed"
                fill="#7c3aed"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Sessions"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RAG & Feedback Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">RAG Hits & Feedback</h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="ragHits" name="RAG Hits" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="positive" name="Positive" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="negative" name="Negative" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Topics */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Popular Topics</h3>
          </div>
          {analytics.topTopics.length > 0 ? (
            <div className="space-y-3">
              {analytics.topTopics.map((topic, idx) => {
                const maxCount = analytics.topTopics[0].count;
                const pct = maxCount > 0 ? (topic.count / maxCount) * 100 : 0;
                return (
                  <div key={topic.topic} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{topic.topic}</span>
                        <span className="text-xs text-gray-500 ml-2 shrink-0">{topic.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No topic data yet</p>
          )}
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">7-Day Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">{analytics.totalSessions}</p>
            <p className="text-xs text-gray-500">Sessions</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{analytics.totalMessages}</p>
            <p className="text-xs text-gray-500">Messages</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{analytics.totalFeedbackPositive}</p>
            <p className="text-xs text-gray-500">Positive</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{analytics.totalFeedbackNegative}</p>
            <p className="text-xs text-gray-500">Negative</p>
          </div>
          <div>
            <p className="text-lg font-bold text-purple-600">{analytics.totalRagHits}</p>
            <p className="text-xs text-gray-500">RAG Hits</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-600">{analytics.totalHandoffs}</p>
            <p className="text-xs text-gray-500">Handoffs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
