/**
 * The add/edit source dialog (with feed discovery) and the delete
 * confirmation of the content sources manager. JSX moved verbatim from
 * ContentSourcesManager.tsx; every captured name became a prop.
 */
import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { AlertTriangle, CheckCircle, Globe, Loader2, Rss, Search, Tag } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { ContentSource, DiscoveredFeed, PipelineId } from '../types';
import {
  INTERVAL_OPTIONS,
  PIPELINE_COLORS,
  PIPELINE_LABELS,
  type FormState,
} from './contentSourcesModel';

interface ContentSourceDialogsProps {
  dialogOpen: boolean;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingSource: ContentSource | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  handleSave: () => Promise<void>;
  togglePipeline: (pipeline: PipelineId) => void;
  discoveredFeeds: DiscoveredFeed[];
  setDiscoveredFeeds: React.Dispatch<React.SetStateAction<DiscoveredFeed[]>>;
  discovering: boolean;
  discoveryDone: boolean;
  setDiscoveryDone: React.Dispatch<React.SetStateAction<boolean>>;
  handleDiscoverFeeds: () => Promise<void>;
  handleSelectFeed: (feed: DiscoveredFeed) => void;
  deleteTarget: ContentSource | null;
  setDeleteTarget: React.Dispatch<React.SetStateAction<ContentSource | null>>;
  deleting: boolean;
  handleDelete: () => Promise<void>;
}

export function ContentSourceDialogs({
  dialogOpen,
  setDialogOpen,
  editingSource,
  form,
  setForm,
  saving,
  handleSave,
  togglePipeline,
  discoveredFeeds,
  setDiscoveredFeeds,
  discovering,
  discoveryDone,
  setDiscoveryDone,
  handleDiscoverFeeds,
  handleSelectFeed,
  deleteTarget,
  setDeleteTarget,
  deleting,
  handleDelete,
}: ContentSourceDialogsProps) {
  return (
    <>
      {/* ── Add/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Edit Content Source' : 'Add Content Source'}
            </DialogTitle>
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
                Paste any webpage URL and click &quot;Detect Feeds&quot; to automatically find RSS
                feeds, or enter a direct feed URL.
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
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {feed.title}
                            </p>
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
                    No RSS feeds detected on this page. Try a different URL, or look for an RSS icon
                    on the website and paste that URL directly.
                  </p>
                </div>
              )}

              {/* Single feed auto-selected confirmation */}
              {discoveryDone && discoveredFeeds.length === 1 && (
                <div className="mt-2 border border-green-100 bg-green-50/50 rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700">
                    RSS feed detected and selected:{' '}
                    <span className="font-medium">{discoveredFeeds[0].title}</span>
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
                          : 'border-gray-200 text-gray-400 hover:border-gray-300',
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
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, checkIntervalHours: parseInt(v, 10) }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-400">
                  Minimum time between checks for this source
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Max per Run</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxArticlesPerRun}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      maxArticlesPerRun: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="h-9"
                />
                <p className="text-[10px] text-gray-400">
                  Max articles per single pipeline trigger
                </p>
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
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      maxArticlesPerDay: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
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
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      maxArticlesPerWeek: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
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
                Comma-separated. Items from this feed must match at least one keyword to be
                processed. Leave empty to process all items. Especially useful for the Regulatory
                Monitor pipeline.
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label>Active</Label>
                <p className="text-[10px] text-gray-400">
                  Inactive sources are skipped during pipeline runs
                </p>
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
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </div>
              ) : editingSource ? (
                'Save Changes'
              ) : (
                'Add Source'
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
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot
              be undone. The pipeline will fall back to built-in defaults if no other sources are
              configured.
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
    </>
  );
}
