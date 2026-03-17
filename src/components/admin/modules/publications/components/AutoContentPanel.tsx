/**
 * AutoContentPanel — Automated Article Generation Pipeline Management
 *
 * Management interface for the four automated content pipelines:
 *  1. Market Commentary
 *  2. Regulatory Monitor
 *  3. News Commentary
 *  4. Calendar-Driven Content
 *
 * Allows admins to configure, enable/disable, manually trigger, and
 * view run history for each pipeline. Also manages the financial
 * calendar events for pipeline 4.
 *
 * @module publications/components/AutoContentPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Shield,
  Newspaper,
  CalendarDays,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  SkipForward,
  History,
  ChevronDown,
  ChevronRight,
  Zap,
  Power,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type {
  PipelineId,
  PipelineConfig,
  PipelineRunLog,
  PipelineTriggerResult,
  CalendarEvent,
  Category,
} from '../types';
import { toast } from 'sonner@2.0.3';
import { ContentSourcesManager } from './ContentSourcesManager';
import { Switch } from '../../../../ui/switch';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PIPELINE_META: Record<PipelineId, { icon: React.ReactNode; color: string; bgColor: string }> = {
  market_commentary: {
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  regulatory_monitor: {
    icon: <Shield className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  news_commentary: {
    icon: <Newspaper className="h-5 w-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  calendar_content: {
    icon: <CalendarDays className="h-5 w-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
};

const STATUS_CONFIG = {
  success: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600', badge: 'bg-green-100 text-green-700' },
  partial: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  error: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  skipped: { icon: <SkipForward className="h-4 w-4" />, color: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AutoContentPanelProps {
  categories: Category[];
  onArticlesGenerated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoContentPanel({ categories, onArticlesGenerated }: AutoContentPanelProps) {
  const [configs, setConfigs] = useState<PipelineConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPipeline, setExpandedPipeline] = useState<PipelineId | null>(null);
  const [runHistory, setRunHistory] = useState<Record<string, PipelineRunLog[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});
  const [triggeringPipeline, setTriggeringPipeline] = useState<PipelineId | null>(null);
  const [triggerResult, setTriggerResult] = useState<PipelineTriggerResult | null>(null);
  const [triggeringAll, setTriggeringAll] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);

  // Load configs
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await PublicationsAPI.AutoContent.getConfigs();
        if (!cancelled) setConfigs(data);
      } catch (err) {
        console.error('Failed to load auto-content configs:', err);
        toast.error('Failed to load pipeline configurations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load history when expanding
  const loadHistory = useCallback(async (id: PipelineId) => {
    setHistoryLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const data = await PublicationsAPI.AutoContent.getRunHistory(id, 10);
      setRunHistory((prev) => ({ ...prev, [id]: data }));
    } catch (err) {
      console.error(`Failed to load history for ${id}:`, err);
    } finally {
      setHistoryLoading((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  const toggleExpand = useCallback((id: PipelineId) => {
    setExpandedPipeline((prev) => {
      if (prev === id) return null;
      // Load history if not already loaded
      if (!runHistory[id]) loadHistory(id);
      return id;
    });
    setTriggerResult(null);
  }, [runHistory, loadHistory]);

  // Toggle pipeline enabled
  const toggleEnabled = useCallback(async (id: PipelineId, enabled: boolean) => {
    try {
      const updated = await PublicationsAPI.AutoContent.updateConfig(id, { enabled });
      setConfigs((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success(`${updated.name} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Failed to toggle pipeline:', err);
      toast.error('Failed to update pipeline');
    }
  }, []);

  // Trigger single pipeline
  const triggerPipeline = useCallback(async (id: PipelineId) => {
    setTriggeringPipeline(id);
    setTriggerResult(null);
    try {
      const result = await PublicationsAPI.AutoContent.triggerPipeline(id);
      setTriggerResult(result);
      // Refresh history
      loadHistory(id);
      // Refresh configs for updated stats
      const data = await PublicationsAPI.AutoContent.getConfigs();
      setConfigs(data);

      if (result.articlesGenerated > 0) {
        toast.success(`${result.articlesGenerated} draft article(s) generated`);
        onArticlesGenerated?.();
      } else if (result.status === 'skipped') {
        toast.info(result.summary);
      } else {
        toast.error(result.summary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline trigger failed';
      toast.error(msg);
      console.error('Pipeline trigger error:', err);
    } finally {
      setTriggeringPipeline(null);
    }
  }, [loadHistory, onArticlesGenerated]);

  // Trigger all enabled
  const triggerAllPipelines = useCallback(async () => {
    setTriggeringAll(true);
    try {
      const results = await PublicationsAPI.AutoContent.triggerAll();
      const totalGenerated = results.reduce((sum, r) => sum + r.articlesGenerated, 0);
      if (totalGenerated > 0) {
        toast.success(`${totalGenerated} draft article(s) generated across ${results.length} pipeline(s)`);
        onArticlesGenerated?.();
      } else {
        toast.info('No new articles generated — all pipelines returned no actionable content');
      }
      // Refresh
      const data = await PublicationsAPI.AutoContent.getConfigs();
      setConfigs(data);
    } catch (err) {
      toast.error('Failed to trigger pipelines');
      console.error('Trigger-all error:', err);
    } finally {
      setTriggeringAll(false);
    }
  }, [onArticlesGenerated]);

  // Load calendar events
  const loadCalendarEvents = useCallback(async () => {
    try {
      const events = await PublicationsAPI.AutoContent.getCalendarEvents();
      setCalendarEvents(events);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }
  }, []);

  useEffect(() => {
    if (showCalendar && calendarEvents.length === 0) {
      loadCalendarEvents();
    }
  }, [showCalendar, calendarEvents.length, loadCalendarEvents]);

  // Format relative time
  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  // Format schedule interval for display
  const formatIntervalHours = (hours: number): string => {
    if (hours < 1) return 'hour';
    if (hours === 1) return 'hour';
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'day';
    if (days === 7) return 'week';
    if (days === 14) return '2 weeks';
    if (days === 30) return 'month';
    return `${days} days`;
  };

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
        <span className="text-sm text-gray-500">Loading content pipelines...</span>
      </div>
    );
  }

  const enabledCount = configs.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Automated Content Pipelines</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-powered article generation from market data, regulatory changes, news, and calendar events.
            All generated articles land as drafts for your review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCalendar(!showCalendar)}
            className="gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Financial Calendar
          </Button>
          <Button
            size="sm"
            onClick={triggerAllPipelines}
            disabled={triggeringAll || enabledCount === 0}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700"
          >
            {triggeringAll ? (
              <div className="contents">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running...
              </div>
            ) : (
              <div className="contents">
                <Zap className="h-3.5 w-3.5" />
                Run All ({enabledCount})
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {configs.map((config) => {
          const meta = PIPELINE_META[config.id];
          return (
            <Card key={config.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn('p-2 rounded-lg', meta.bgColor)}>
                    <div className={meta.color}>{meta.icon}</div>
                  </div>
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1',
                    config.enabled ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-gray-900">{config.totalGenerated}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{config.name}</p>
                </div>
                {config.lastRunAt && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Last run: {formatRelativeTime(config.lastRunAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline Cards */}
      <div className="space-y-3">
        {configs.map((config) => {
          const meta = PIPELINE_META[config.id];
          const isExpanded = expandedPipeline === config.id;
          const isTriggering = triggeringPipeline === config.id;
          const history = runHistory[config.id] || [];
          const isLoadingHistory = historyLoading[config.id];

          return (
            <Card key={config.id} className="overflow-hidden">
              {/* Pipeline Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => toggleExpand(config.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn('p-2.5 rounded-xl', meta.bgColor)}>
                    <div className={meta.color}>{meta.icon}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{config.name}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5',
                          config.enabled
                            ? 'border-green-300 text-green-700 bg-green-50'
                            : 'border-gray-200 text-gray-500'
                        )}
                      >
                        {config.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {config.scheduleIntervalHours > 0 && config.enabled && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                          Every {formatIntervalHours(config.scheduleIntervalHours)}
                        </span>
                      )}
                      {config.lastRunAt && (
                        <span className="text-[10px] text-gray-400">
                          Last run: {formatRelativeTime(config.lastRunAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Enable/Disable toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEnabled(config.id, !config.enabled);
                    }}
                    className={cn(
                      'h-8 px-2',
                      config.enabled ? 'text-green-600 hover:text-red-600' : 'text-gray-400 hover:text-green-600'
                    )}
                    title={config.enabled ? 'Disable pipeline' : 'Enable pipeline'}
                  >
                    <Power className="h-4 w-4" />
                  </Button>

                  {/* Trigger */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPipeline(config.id);
                    }}
                    disabled={isTriggering || !!triggeringPipeline}
                    className="h-8 gap-1.5"
                  >
                    {isTriggering ? (
                      <div className="contents">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Running...
                      </div>
                    ) : (
                      <div className="contents">
                        <Play className="h-3.5 w-3.5" />
                        Run Now
                      </div>
                    )}
                  </Button>

                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30">
                  {/* Latest Trigger Result */}
                  {triggerResult && triggerResult.pipelineId === config.id && (
                    <div className={cn(
                      'mb-4 p-3 rounded-lg border',
                      triggerResult.status === 'success' ? 'bg-green-50 border-green-200' :
                      triggerResult.status === 'skipped' ? 'bg-gray-50 border-gray-200' :
                      triggerResult.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-amber-50 border-amber-200'
                    )}>
                      <div className="flex items-start gap-2">
                        <div className={STATUS_CONFIG[triggerResult.status]?.color || 'text-gray-500'}>
                          {STATUS_CONFIG[triggerResult.status]?.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{triggerResult.summary}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{triggerResult.articlesGenerated} article(s)</span>
                            <span>{(triggerResult.durationMs / 1000).toFixed(1)}s</span>
                          </div>
                          {triggerResult.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {triggerResult.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600">{err}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Config Summary */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Audience</p>
                      <p className="text-sm text-gray-700 capitalize">{config.audience}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Tone</p>
                      <p className="text-sm text-gray-700 capitalize">{config.tone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Length</p>
                      <p className="text-sm text-gray-700 capitalize">{config.targetLength}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Category</p>
                      <p className="text-sm text-gray-700">{config.categoryName || 'Auto-detect'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Auto-Publish</p>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.autoPublish ?? false}
                          onCheckedChange={async (checked) => {
                            try {
                              await PublicationsAPI.AutoContent.updateConfig(config.id, { autoPublish: checked });
                              setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, autoPublish: checked } : c));
                              toast.success(`Auto-publish ${checked ? 'enabled' : 'disabled'} for ${config.name}`);
                            } catch {
                              toast.error('Failed to update auto-publish setting');
                            }
                          }}
                        />
                        <span className={cn('text-xs font-medium', config.autoPublish ? 'text-green-600' : 'text-gray-400')}>
                          {config.autoPublish ? 'On' : 'Off'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Auto-Run Schedule</p>
                      <select
                        className="text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        value={config.scheduleIntervalHours || 0}
                        onChange={async (e) => {
                          const val = parseInt(e.target.value, 10);
                          try {
                            await PublicationsAPI.AutoContent.updateConfig(config.id, { scheduleIntervalHours: val });
                            setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, scheduleIntervalHours: val } : c));
                            toast.success(val > 0
                              ? `${config.name} will auto-run every ${formatIntervalHours(val)}`
                              : `${config.name} set to manual-only`
                            );
                          } catch {
                            toast.error('Failed to update schedule interval');
                          }
                        }}
                      >
                        <option value={0}>Manual only</option>
                        <option value={6}>Every 6 hours</option>
                        <option value={12}>Every 12 hours</option>
                        <option value={24}>Daily</option>
                        <option value={48}>Every 2 days</option>
                        <option value={72}>Every 3 days</option>
                        <option value={168}>Weekly</option>
                        <option value={336}>Every 2 weeks</option>
                      </select>
                    </div>
                  </div>

                  {/* Run History */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        Recent Runs
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadHistory(config.id)}
                        disabled={isLoadingHistory}
                        className="h-6 px-2 text-xs"
                      >
                        <RefreshCw className={cn('h-3 w-3', isLoadingHistory && 'animate-spin')} />
                      </Button>
                    </div>

                    {isLoadingHistory ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading history...
                      </div>
                    ) : history.length === 0 ? (
                      <p className="text-sm text-gray-400 py-3">No runs yet. Click &quot;Run Now&quot; to generate articles.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {history.map((run) => {
                          const statusCfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.error;
                          return (
                            <div
                              key={run.id}
                              className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-100"
                            >
                              <div className="flex items-center gap-2">
                                <div className={statusCfg.color}>{statusCfg.icon}</div>
                                <div>
                                  <p className="text-xs text-gray-700 line-clamp-1">{run.summary}</p>
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(run.completedAt).toLocaleDateString('en-ZA', {
                                      day: 'numeric', month: 'short', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {run.articlesGenerated} article{run.articlesGenerated !== 1 ? 's' : ''}
                                </Badge>
                                <span className="text-[10px] text-gray-400">
                                  {(run.durationMs / 1000).toFixed(1)}s
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Content Sources Manager */}
      <ContentSourcesManager onArticlesGenerated={onArticlesGenerated} />

      {/* Financial Calendar */}
      {showCalendar && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-amber-600" />
                SA Financial Calendar Events
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {calendarEvents.filter(e => e.isActive).length} active events
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              Articles are automatically generated ahead of these events based on the configured lead time.
            </p>
          </CardHeader>
          <CardContent>
            {calendarEvents.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading calendar events...
              </div>
            ) : (
              <div className="space-y-1">
                {calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-lg border transition-colors',
                      event.isActive
                        ? 'border-gray-100 bg-white'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-center">
                        <p className="text-lg font-bold text-gray-900">{event.day}</p>
                        <p className="text-[10px] uppercase text-gray-500">{MONTH_NAMES[event.month - 1]}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{event.name}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{event.articleTopic}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">{event.leadTimeDays}d lead time</p>
                        {event.lastGeneratedYear && (
                          <p className="text-[10px] text-green-600">Generated {event.lastGeneratedYear}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5',
                          event.recurring
                            ? 'border-blue-200 text-blue-600'
                            : 'border-gray-200 text-gray-500'
                        )}
                      >
                        {event.recurring ? 'Annual' : 'Once'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
        <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-purple-900">How automated content works</p>
          <ul className="text-xs text-purple-700 mt-1 space-y-0.5 list-disc list-inside">
            <li>Each pipeline fetches data from external sources (RSS feeds, calendar) and generates articles using AI</li>
            <li>All articles are created as <strong>drafts</strong> — nothing is ever auto-published</li>
            <li>Duplicate content is prevented via deduplication hashing — the same news item won&apos;t generate twice</li>
            <li>Use <strong>Content Sources</strong> above to add RSS feeds, control check frequency, and set daily/weekly generation caps</li>
            <li>Use &quot;Run Now&quot; to manually trigger any pipeline, or &quot;Run All&quot; for all enabled pipelines</li>
            <li>Enabled pipelines run automatically based on their <strong>schedule interval</strong> — checked every 15 minutes while the admin panel is open</li>
          </ul>
        </div>
      </div>
    </div>
  );
}