/**
 * VascoAnalyticsCard — Admin Dashboard Widget
 * 
 * Displays analytics for the "Ask Vasco" public chatbot:
 * - 7-day message/session metrics
 * - Feedback summary (positive/negative)
 * - Popular topics
 * - Recent handoff requests with status management
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import {
  BarChart3,
  MessageSquare,
  Users,
  ThumbsUp,
  ThumbsDown,
  Phone,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../../utils/api';
import { vascoKeys } from '../../../../../utils/queryKeys';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// TYPES
// ============================================================================

interface DailyMetrics {
  date: string;
  sessions: number;
  messages: number;
  feedbackPositive: number;
  feedbackNegative: number;
  handoffs: number;
  ragHits: number;
  rateLimited: number;
}

interface AnalyticsSummary {
  totalSessions: number;
  totalMessages: number;
  totalFeedbackPositive: number;
  totalFeedbackNegative: number;
  totalHandoffs: number;
  totalRagHits: number;
  last7Days: DailyMetrics[];
  topTopics: Array<{ topic: string; count: number }>;
  lastUpdated: string;
}

interface HandoffRequest {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  createdAt: string;
}

const HANDOFF_STATUS_CONFIG = {
  new: { label: 'New', badgeClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
  contacted: { label: 'Contacted', badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white' },
  converted: { label: 'Converted', badgeClass: 'bg-green-600 hover:bg-green-700 text-white' },
  closed: { label: 'Closed', badgeClass: 'bg-gray-400 hover:bg-gray-500 text-white' },
} as const;

// ============================================================================
// MINI BAR CHART — Simple 7-day sparkline
// ============================================================================

function MiniBarChart({ data, maxValue }: { data: number[]; maxValue: number }) {
  const safeMax = Math.max(maxValue, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 bg-[#6d28d9]/70 rounded-t-sm min-h-[2px] transition-all"
          style={{ height: `${Math.max((value / safeMax) * 100, 3)}%` }}
          title={`${value}`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VascoAnalyticsCard() {
  const queryClient = useQueryClient();
  const [showHandoffs, setShowHandoffs] = useState(false);
  const [showTopics, setShowTopics] = useState(false);

  // Fetch analytics summary
  const { data: analytics, isLoading } = useQuery({
    queryKey: vascoKeys.analytics(),
    queryFn: () => api.get<AnalyticsSummary & { success: boolean }>('/vasco/analytics'),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch handoff requests
  const { data: handoffsData } = useQuery({
    queryKey: vascoKeys.handoffs(),
    queryFn: () => api.get<{ success: boolean; handoffs: HandoffRequest[] }>('/vasco/handoffs'),
    staleTime: 2 * 60 * 1000,
  });

  // Update handoff status
  const updateHandoffMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/vasco/handoffs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vascoKeys.handoffs() });
      queryClient.invalidateQueries({ queryKey: vascoKeys.analytics() });
      toast.success('Handoff status updated');
    },
    onError: () => {
      toast.error('Failed to update handoff status');
    },
  });

  const handoffs = handoffsData?.handoffs || [];
  const newHandoffs = handoffs.filter((h) => h.status === 'new');

  if (isLoading) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const messagesData = analytics.last7Days.map((d) => d.messages);
  const maxMessages = Math.max(...messagesData, 1);
  const feedbackTotal = analytics.totalFeedbackPositive + analytics.totalFeedbackNegative;
  const satisfactionRate = feedbackTotal > 0
    ? Math.round((analytics.totalFeedbackPositive / feedbackTotal) * 100)
    : null;

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between font-semibold text-gray-900">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-[#6d28d9]" />
            </div>
            Vasco Analytics
          </div>
          {newHandoffs.length > 0 && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0">
              {newHandoffs.length} new lead{newHandoffs.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Stat Grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-[#6d28d9]" />
              <span className="text-[11px] text-gray-500">Messages (7d)</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{analytics.totalMessages}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-[#6d28d9]" />
              <span className="text-[11px] text-gray-500">Sessions (7d)</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{analytics.totalSessions}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
              <span className="text-[11px] text-gray-500">Satisfaction</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {satisfactionRate !== null ? `${satisfactionRate}%` : '—'}
            </p>
            {feedbackTotal > 0 && (
              <p className="text-[10px] text-gray-400">{feedbackTotal} ratings</p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Phone className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-gray-500">Handoffs (7d)</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{analytics.totalHandoffs}</p>
          </div>
        </div>

        {/* ── 7-Day Message Chart ──────────────────────────────────────── */}
        <div>
          <p className="text-[11px] text-gray-500 mb-1.5 px-1">Messages — Last 7 Days</p>
          <MiniBarChart data={messagesData} maxValue={maxMessages} />
          <div className="flex justify-between mt-1 px-0.5">
            {analytics.last7Days.map((d) => (
              <span key={d.date} className="text-[9px] text-gray-400">
                {new Date(d.date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2)}
              </span>
            ))}
          </div>
        </div>

        {/* ── RAG Usage ────────────────────────────────────────────────── */}
        {analytics.totalRagHits > 0 && (
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="h-3.5 w-3.5 text-[#6d28d9]" />
            <span className="text-xs text-gray-600">
              {analytics.totalRagHits} responses used article context
            </span>
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Popular Topics ───────────────────────────────────────────── */}
        {analytics.topTopics.length > 0 && (
          <div>
            <button
              onClick={() => setShowTopics(!showTopics)}
              className="flex items-center gap-1 text-xs text-gray-700 font-medium px-1 hover:text-[#6d28d9]"
            >
              Popular Topics
              {showTopics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showTopics && (
              <div className="mt-2 space-y-1.5">
                {analytics.topTopics.slice(0, 8).map((t) => (
                  <div key={t.topic} className="flex items-center justify-between px-2 py-1 rounded bg-gray-50">
                    <span className="text-xs text-gray-700">{t.topic}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Handoff Requests ─────────────────────────────────────────── */}
        {handoffs.length > 0 && (
          <div>
            <button
              onClick={() => setShowHandoffs(!showHandoffs)}
              className="flex items-center gap-1 text-xs text-gray-700 font-medium px-1 hover:text-[#6d28d9]"
            >
              Adviser Leads ({handoffs.length})
              {newHandoffs.length > 0 && (
                <Badge className="bg-red-500 text-white text-[9px] px-1 py-0 ml-1">
                  {newHandoffs.length} new
                </Badge>
              )}
              {showHandoffs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showHandoffs && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {handoffs.slice(0, 10).map((h) => {
                  const statusCfg = HANDOFF_STATUS_CONFIG[h.status];
                  return (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-900">{h.name}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500">{h.topic}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span>{h.email}</span>
                        {h.phone && <span>{h.phone}</span>}
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        {h.status === 'new' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 px-2 border-gray-200"
                            onClick={() => updateHandoffMutation.mutate({ id: h.id, status: 'contacted' })}
                            disabled={updateHandoffMutation.isPending}
                          >
                            Mark Contacted
                          </Button>
                        )}
                        {h.status === 'contacted' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-6 px-2 border-green-200 text-green-700"
                              onClick={() => updateHandoffMutation.mutate({ id: h.id, status: 'converted' })}
                              disabled={updateHandoffMutation.isPending}
                            >
                              Converted
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] h-6 px-2 text-gray-500"
                              onClick={() => updateHandoffMutation.mutate({ id: h.id, status: 'closed' })}
                              disabled={updateHandoffMutation.isPending}
                            >
                              Close
                            </Button>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {new Date(h.createdAt).toLocaleDateString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
