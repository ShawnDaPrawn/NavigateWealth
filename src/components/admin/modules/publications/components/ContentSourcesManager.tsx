/**
 * ContentSourcesManager — Manage content sources for automated pipelines
 *
 * Allows admins to:
 *  - Add / edit / remove RSS feed sources
 *  - Assign sources to specific pipelines
 *  - Control check frequency (polling interval)
 *  - Set article generation limits (per run, per day, per week)
 *  - Add keyword filters (especially for regulatory monitoring)
 *  - View per-source tracking stats
 *
 * @module publications/components/ContentSourcesManager
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rss,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle,
  X,
  Clock,
  BarChart3,
  Filter,
  Globe,
  AlertTriangle,
  ExternalLink,
  Power,
  Tag,
  Play,
  Search,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Switch } from '../../../../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type { ContentSource, CreateContentSourceInput, PipelineId, DiscoveredFeed } from '../types';
import { toast } from 'sonner@2.0.3';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_LABELS: Record<PipelineId, string> = {
  market_commentary: 'Market Commentary',
  regulatory_monitor: 'Regulatory Monitor',
  news_commentary: 'News Commentary',
  calendar_content: 'Calendar Content',
};

const PIPELINE_COLORS: Record<PipelineId, string> = {
  market_commentary: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  regulatory_monitor: 'bg-blue-100 text-blue-700 border-blue-200',
  news_commentary: 'bg-purple-100 text-purple-700 border-purple-200',
  calendar_content: 'bg-amber-100 text-amber-700 border-amber-200',
};

const INTERVAL_OPTIONS = [
  { value: 0, label: 'No minimum' },
  { value: 1, label: 'Every hour' },
  { value: 3, label: 'Every 3 hours' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Once a day' },
  { value: 48, label: 'Every 2 days' },
  { value: 168, label: 'Once a week' },
];

const EMPTY_FORM: FormState = {
  name: '',
  url: '',
  pipelines: [],
  isActive: true,
  checkIntervalHours: 24,
  maxArticlesPerRun: 1,
  maxArticlesPerDay: 2,
  maxArticlesPerWeek: 5,
  filterKeywords: '',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  url: string;
  pipelines: PipelineId[];
  isActive: boolean;
  checkIntervalHours: number;
  maxArticlesPerRun: number;
  maxArticlesPerDay: number;
  maxArticlesPerWeek: number;
  filterKeywords: string;
}

interface ContentSourcesManagerProps {
  onArticlesGenerated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentSourcesManager({ onArticlesGenerated }: ContentSourcesManagerProps) {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ContentSource | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggeringSourceId, setTriggeringSourceId] = useState<string | null>(null);

  // Feed discovery state
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryDone, setDiscoveryDone] = useState(false);

  // Load sources
  const loadSources = useCallback(async () => {
    try {
      const data = await PublicationsAPI.AutoContent.getContentSources();
      setSources(data);
    } catch (err) {
      console.error('Failed to load content sources:', err);
      toast.error('Failed to load content sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  // Open add dialog
  const handleAdd = useCallback(() => {
    setEditingSource(null);
    setForm(EMPTY_FORM);
    setDiscoveredFeeds([]);
    setDiscoveryDone(false);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback((source: ContentSource) => {
    setEditingSource(source);
    setForm({
      name: source.name,
      url: source.url,
      pipelines: source.pipelines,
      isActive: source.isActive,
      checkIntervalHours: source.checkIntervalHours,
      maxArticlesPerRun: source.maxArticlesPerRun,
      maxArticlesPerDay: source.maxArticlesPerDay,
      maxArticlesPerWeek: source.maxArticlesPerWeek,
      filterKeywords: (source.filterKeywords || []).join(', '),
    });
    setDiscoveredFeeds([]);
    setDiscoveryDone(false);
    setDialogOpen(true);
  }, []);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { toast.error('Source name is required'); return; }
    if (!form.url.trim()) { toast.error('Feed URL is required'); return; }
    if (form.pipelines.length === 0) { toast.error('Select at least one pipeline'); return; }

    // Validate URL
    try { new URL(form.url); } catch { toast.error('Invalid URL format'); return; }

    setSaving(true);
    try {
      const keywords = form.filterKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (editingSource) {
        const updated = await PublicationsAPI.AutoContent.updateContentSource(editingSource.id, {
          name: form.name.trim(),
          url: form.url.trim(),
          pipelines: form.pipelines,
          isActive: form.isActive,
          checkIntervalHours: form.checkIntervalHours,
          maxArticlesPerRun: form.maxArticlesPerRun,
          maxArticlesPerDay: form.maxArticlesPerDay,
          maxArticlesPerWeek: form.maxArticlesPerWeek,
          filterKeywords: keywords.length > 0 ? keywords : undefined,
        });
        setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success('Source updated');
      } else {
        const input: CreateContentSourceInput = {
          name: form.name.trim(),
          url: form.url.trim(),
          type: 'rss',
          pipelines: form.pipelines,
          isActive: form.isActive,
          checkIntervalHours: form.checkIntervalHours,
          maxArticlesPerRun: form.maxArticlesPerRun,
          maxArticlesPerDay: form.maxArticlesPerDay,
          maxArticlesPerWeek: form.maxArticlesPerWeek,
          filterKeywords: keywords.length > 0 ? keywords : undefined,
        };
        const created = await PublicationsAPI.AutoContent.addContentSource(input);
        setSources((prev) => [...prev, created]);
        toast.success('Source added');
      }
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
      console.error('Save source error:', err);
    } finally {
      setSaving(false);
    }
  }, [form, editingSource]);

  // Toggle active
  const handleToggleActive = useCallback(async (source: ContentSource) => {
    try {
      const updated = await PublicationsAPI.AutoContent.updateContentSource(source.id, { isActive: !source.isActive });
      setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(`${source.name} ${updated.isActive ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update source');
      console.error('Toggle source error:', err);
    }
  }, []);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await PublicationsAPI.AutoContent.deleteContentSource(deleteTarget.id);
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" deleted`);
    } catch (err) {
      toast.error('Failed to delete source');
      console.error('Delete source error:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // Trigger article generation from a specific source
  const handleTriggerSource = useCallback(async (source: ContentSource) => {
    setTriggeringSourceId(source.id);
    try {
      const result = await PublicationsAPI.AutoContent.triggerSource(source.id);
      if (result.totalGenerated > 0) {
        toast.success(`${result.totalGenerated} article(s) generated from "${source.name}"`);
        if (onArticlesGenerated) onArticlesGenerated();
      } else {
        toast.info(`No new articles generated from "${source.name}" — content may already be processed`);
      }
      loadSources();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger source';
      toast.error(msg);
      console.error('Trigger source error:', err);
    } finally {
      setTriggeringSourceId(null);
    }
  }, [loadSources, onArticlesGenerated]);

  // Feed discovery — detect RSS feeds from a webpage URL
  const handleDiscoverFeeds = useCallback(async () => {
    if (!form.url.trim()) { toast.error('Enter a URL first'); return; }
    try { new URL(form.url); } catch { toast.error('Invalid URL format'); return; }

    setDiscovering(true);
    setDiscoveryDone(false);
    setDiscoveredFeeds([]);
    try {
      const feeds = await PublicationsAPI.AutoContent.discoverFeeds(form.url.trim());
      setDiscoveredFeeds(feeds);
      setDiscoveryDone(true);

      if (feeds.length === 1) {
        // Single feed found — auto-select it
        setForm((p) => ({
          ...p,
          url: feeds[0].url,
          name: p.name || feeds[0].title,
        }));
        toast.success(`RSS feed detected: "${feeds[0].title}"`);
      } else if (feeds.length > 1) {
        toast.success(`${feeds.length} feeds found — select one below`);
      } else {
        toast.info('No RSS feeds detected on this page. Please provide a direct feed URL.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feed detection failed';
      toast.error(msg);
      console.error('Feed discovery error:', err);
    } finally {
      setDiscovering(false);
    }
  }, [form.url]);

  // Select a discovered feed
  const handleSelectFeed = useCallback((feed: DiscoveredFeed) => {
    setForm((p) => ({
      ...p,
      url: feed.url,
      name: p.name || feed.title,
    }));
    setDiscoveredFeeds([]);
    setDiscoveryDone(false);
    toast.success(`Selected: "${feed.title}"`);
  }, []);

  // Toggle pipeline in form
  const togglePipeline = useCallback((pipeline: PipelineId) => {
    setForm((prev) => ({
      ...prev,
      pipelines: prev.pipelines.includes(pipeline)
        ? prev.pipelines.filter((p) => p !== pipeline)
        : [...prev.pipelines, pipeline],
    }));
  }, []);

  // Relative time
  const formatRelativeTime = (iso: string | undefined): string => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const intervalLabel = (hours: number): string => {
    const opt = INTERVAL_OPTIONS.find((o) => o.value === hours);
    return opt?.label || `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading content sources...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Rss className="h-4.5 w-4.5 text-orange-500" />
            Content Sources
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage RSS feeds and control how often each source is checked and how many articles it generates.
          </p>
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
          <Plus className="h-3.5 w-3.5" />
          Add Source
        </Button>
      </div>

      {/* Empty state */}
      {sources.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <Rss className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No content sources configured</p>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Add RSS feed URLs to control where the automated pipelines get their content.
            Without configured sources, pipelines will use built-in defaults.
          </p>
          <Button size="sm" variant="outline" onClick={handleAdd} className="mt-4 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Your First Source
          </Button>
        </div>
      )}

      {/* Search bar — shown when there are 3+ sources */}
      {sources.length >= 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search sources by name, URL, or pipeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Sources List */}
      {sources.length > 0 && (() => {
        const query = searchQuery.toLowerCase().trim();
        const filteredSources = query
          ? sources.filter(s =>
              s.name.toLowerCase().includes(query) ||
              s.url.toLowerCase().includes(query) ||
              s.pipelines.some(p => PIPELINE_LABELS[p].toLowerCase().includes(query))
            )
          : sources;

        if (filteredSources.length === 0 && query) {
          return (
            <div className="text-center py-6 text-sm text-gray-400">
              No sources match &ldquo;{searchQuery}&rdquo;
            </div>
          );
        }

        return (
        <div className="space-y-2">
          {filteredSources.map((source) => (
            <Card key={source.id} className={cn(
              'transition-all relative overflow-hidden',
              !source.isActive && 'opacity-50',
              triggeringSourceId === source.id && 'ring-2 ring-blue-300 ring-offset-1'
            )}>
              {/* Active generation overlay banner */}
              {triggeringSourceId === source.id && (
                <div className="absolute inset-x-0 top-0 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2.5 z-10">
                  <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-700">
                    Generating article from &ldquo;{source.name}&rdquo;&hellip; This may take 30–60 seconds.
                  </span>
                </div>
              )}
              <CardContent className={cn('p-4', triggeringSourceId === source.id && 'pt-12')}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Status dot + icon */}
                    <div className="relative mt-0.5">
                      <div className={cn('p-2 rounded-lg', source.isActive ? 'bg-orange-50' : 'bg-gray-100')}>
                        <Rss className={cn('h-4 w-4', source.isActive ? 'text-orange-500' : 'text-gray-400')} />
                      </div>
                      <div className={cn(
                        'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        source.isActive ? 'bg-green-500' : 'bg-gray-300'
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-gray-900 truncate">{source.name}</h4>
                        {source.pipelines.map((p) => (
                          <Badge key={p} variant="outline" className={cn('text-[9px] h-4 px-1.5', PIPELINE_COLORS[p])}>
                            {PIPELINE_LABELS[p]}
                          </Badge>
                        ))}
                      </div>

                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-blue-500 truncate block mt-0.5 max-w-lg"
                      >
                        {source.url}
                        <ExternalLink className="h-2.5 w-2.5 inline ml-1 -mt-0.5" />
                      </a>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Check: {intervalLabel(source.checkIntervalHours)}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Limits: {source.maxArticlesPerRun}/run · {source.maxArticlesPerDay}/day · {source.maxArticlesPerWeek}/week
                        </span>
                        {source.filterKeywords && source.filterKeywords.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Filter className="h-3 w-3" />
                            {source.filterKeywords.length} keywords
                          </span>
                        )}
                      </div>

                      {/* Usage row */}
                      <div className="flex items-center gap-4 mt-1 text-[10px]">
                        <span className="text-gray-400">
                          Last checked: <span className="font-medium text-gray-500">{formatRelativeTime(source.lastCheckedAt)}</span>
                        </span>
                        <span className="text-gray-400">
                          Today: <span className="font-medium text-gray-500">{source.articlesGeneratedToday}</span>
                        </span>
                        <span className="text-gray-400">
                          This week: <span className="font-medium text-gray-500">{source.articlesGeneratedThisWeek}</span>
                        </span>
                        <span className="text-gray-400">
                          Total: <span className="font-medium text-gray-500">{source.totalGenerated}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(source)}
                      className={cn('h-7 px-1.5', source.isActive ? 'text-green-600 hover:text-red-600' : 'text-gray-400 hover:text-green-600')}
                      title={source.isActive ? 'Disable' : 'Enable'}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(source)} className="h-7 px-1.5 text-gray-400 hover:text-blue-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(source)} className="h-7 px-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTriggerSource(source)}
                      disabled={triggeringSourceId === source.id}
                      className={cn(
                        'h-7 px-1.5',
                        triggeringSourceId === source.id ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-blue-600'
                      )}
                      title={triggeringSourceId === source.id ? 'Generating article…' : 'Trigger article generation'}
                    >
                      {triggeringSourceId === source.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        );
      })()}

      {/* Info banner */}
      {sources.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            When sources are configured for a pipeline, they replace the built-in defaults.
            If all sources for a pipeline are disabled or exceed their limits, the pipeline will skip that run.
          </p>
        </div>
      )}

      {/* ── Add/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Content Source' : 'Add Content Source'}</DialogTitle>
            <DialogDescription>
              Configure an RSS feed source for automated article generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="source-name">Source Name</Label>
              <Input
                id="source-name"
                placeholder="e.g. Investing.com — Economic News"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* URL + Feed Discovery */}
            <div className="space-y-1.5">
              <Label htmlFor="source-url">Website or Feed URL</Label>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  id="source-url"
                  type="url"
                  placeholder="https://www.reuters.com/business/finance/ or direct RSS URL"
                  value={form.url}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, url: e.target.value }));
                    // Reset discovery when URL changes
                    if (discoveryDone) {
                      setDiscoveredFeeds([]);
                      setDiscoveryDone(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscoverFeeds}
                  disabled={discovering || !form.url.trim()}
                  className="h-9 px-3 whitespace-nowrap text-xs gap-1.5 flex-shrink-0"
                  title="Detect RSS feeds from this URL"
                >
                  {discovering ? (
                    <div className="contents">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Detecting...
                    </div>
                  ) : (
                    <div className="contents">
                      <Search className="h-3.5 w-3.5" />
                      Detect Feeds
                    </div>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">
                Paste any webpage URL and click &quot;Detect Feeds&quot; to automatically find RSS feeds, or enter a direct feed URL.
              </p>

              {/* Discovery results */}
              {discoveryDone && discoveredFeeds.length > 1 && (
                <div className="mt-2 border border-blue-100 bg-blue-50/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5">
                    <Rss className="h-3.5 w-3.5" />
                    {discoveredFeeds.length} feeds found — select one:
                  </p>
                  <div className="space-y-1.5">
                    {discoveredFeeds.map((feed, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectFeed(feed)}
                        className="w-full text-left px-3 py-2 rounded-md border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{feed.title}</p>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{feed.url}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-white">
                              {feed.type.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              Select
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No feeds found */}
              {discoveryDone && discoveredFeeds.length === 0 && (
                <div className="mt-2 border border-amber-100 bg-amber-50/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    No RSS feeds detected on this page. Try a different URL, or look for an RSS icon on the website and paste that URL directly.
                  </p>
                </div>
              )}

              {/* Single feed auto-selected confirmation */}
              {discoveryDone && discoveredFeeds.length === 1 && (
                <div className="mt-2 border border-green-100 bg-green-50/50 rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700">
                    RSS feed detected and selected: <span className="font-medium">{discoveredFeeds[0].title}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Pipelines */}
            <div className="space-y-2">
              <Label>Assign to Pipelines</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PIPELINE_LABELS) as [PipelineId, string][]).map(([id, label]) => {
                  // Calendar content is not RSS-driven
                  if (id === 'calendar_content') return null;
                  const selected = form.pipelines.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePipeline(id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                        selected
                          ? PIPELINE_COLORS[id]
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      )}
                    >
                      {selected && <CheckCircle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Check Interval</Label>
                <Select
                  value={String(form.checkIntervalHours)}
                  onValueChange={(v) => setForm((p) => ({ ...p, checkIntervalHours: parseInt(v, 10) }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-400">Minimum time between checks for this source</p>
              </div>

              <div className="space-y-1.5">
                <Label>Max per Run</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxArticlesPerRun}
                  onChange={(e) => setForm((p) => ({ ...p, maxArticlesPerRun: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  className="h-9"
                />
                <p className="text-[10px] text-gray-400">Max articles per single pipeline trigger</p>
              </div>
            </div>

            {/* Daily / Weekly limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Max per Day</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.maxArticlesPerDay}
                  onChange={(e) => setForm((p) => ({ ...p, maxArticlesPerDay: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="h-9"
                />
                <p className="text-[10px] text-gray-400">0 = no daily limit</p>
              </div>

              <div className="space-y-1.5">
                <Label>Max per Week</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.maxArticlesPerWeek}
                  onChange={(e) => setForm((p) => ({ ...p, maxArticlesPerWeek: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="h-9"
                />
                <p className="text-[10px] text-gray-400">0 = no weekly limit</p>
              </div>
            </div>

            {/* Keyword filter */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                Filter Keywords <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="FSCA, SARB, FAIS, regulation, pension fund..."
                value={form.filterKeywords}
                onChange={(e) => setForm((p) => ({ ...p, filterKeywords: e.target.value }))}
                rows={2}
                className="text-sm"
              />
              <p className="text-[10px] text-gray-400">
                Comma-separated. Items from this feed must match at least one keyword to be processed.
                Leave empty to process all items. Especially useful for the Regulatory Monitor pipeline.
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label>Active</Label>
                <p className="text-[10px] text-gray-400">Inactive sources are skipped during pipeline runs</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </div>
              ) : (
                editingSource ? 'Save Changes' : 'Add Source'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
              The pipeline will fall back to built-in defaults if no other sources are configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Source'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}