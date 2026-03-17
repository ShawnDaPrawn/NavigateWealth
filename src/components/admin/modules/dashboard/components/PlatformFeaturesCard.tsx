/**
 * PlatformFeaturesCard — Admin Dashboard Widget
 * 
 * Allows admins to toggle platform-level feature flags and manage
 * the Vasco article index (RAG).
 * 
 * Currently manages:
 *   - Vasco (Public AI Financial Navigator) — enabled/disabled
 *   - Article Index — trigger/clear indexing for RAG-powered responses
 * 
 * Displays toggle state, last-updated timestamp, and who made the change.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import {
  Compass,
  Settings,
  Loader2,
  ExternalLink,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../../utils/api';
import { vascoKeys } from '../../../../../utils/queryKeys';
import { toast } from 'sonner@2.0.3';

interface VascoConfig {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface ArticleIndexStatus {
  success: boolean;
  indexed: boolean;
  articles: Array<{
    articleId: string;
    title: string;
    slug: string;
    chunkCount: number;
    indexedAt: string;
  }>;
  totalChunks: number;
  lastFullIndex: string | null;
}

interface IndexResult {
  success: boolean;
  articlesIndexed: number;
  totalChunks: number;
  errors: string[];
  durationMs: number;
}

export function PlatformFeaturesCard() {
  const queryClient = useQueryClient();
  const [showIndexDetails, setShowIndexDetails] = useState(false);

  // Fetch current Vasco config
  const { data: vascoConfig, isLoading, isError: configError } = useQuery({
    queryKey: vascoKeys.config(),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; config: VascoConfig }>('/vasco/config');
      return res.config;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });

  // Fetch article index status
  const { data: indexStatus, isLoading: indexLoading } = useQuery({
    queryKey: vascoKeys.indexStatus(),
    queryFn: () => api.get<ArticleIndexStatus>('/vasco/index'),
    staleTime: 2 * 60 * 1000,
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return api.put<{ success: boolean; config: VascoConfig }>('/vasco/config', { enabled });
    },
    onSuccess: (data) => {
      const newConfig = data.config;
      queryClient.setQueryData(vascoKeys.config(), newConfig);
      queryClient.invalidateQueries({ queryKey: vascoKeys.status() });
      toast.success(
        newConfig.enabled
          ? 'Ask Vasco is now live on the public site'
          : 'Ask Vasco has been disabled on the public site'
      );
    },
    onError: (error: Error) => {
      console.error('Failed to toggle Vasco feature flag:', error);
      toast.error('Failed to update feature flag. Please try again.');
    },
  });

  // Index articles mutation
  const indexMutation = useMutation({
    mutationFn: () => api.post<IndexResult>('/vasco/index', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vascoKeys.indexStatus() });
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Indexed ${data.articlesIndexed} articles (${data.totalChunks} chunks) with ${data.errors.length} error(s)`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Indexed ${data.articlesIndexed} articles (${data.totalChunks} chunks) in ${(data.durationMs / 1000).toFixed(1)}s`
        );
      }
    },
    onError: (error: Error) => {
      console.error('Article indexing failed:', error);
      toast.error('Article indexing failed. Check the server logs.');
    },
  });

  // Clear index mutation
  const clearIndexMutation = useMutation({
    mutationFn: () => api.delete<{ success: boolean }>('/vasco/index'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vascoKeys.indexStatus() });
      toast.success('Article index cleared');
    },
    onError: (error: Error) => {
      console.error('Failed to clear index:', error);
      toast.error('Failed to clear article index.');
    },
  });

  const isEnabled = vascoConfig?.enabled ?? false;
  const lastUpdated = vascoConfig?.updatedAt
    ? new Date(vascoConfig.updatedAt).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const hasIndex = indexStatus?.indexed && indexStatus.totalChunks > 0;
  const lastIndexed = indexStatus?.lastFullIndex
    ? new Date(indexStatus.lastFullIndex).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 font-semibold text-gray-900">
          <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <Settings className="h-4 w-4 text-[#6d28d9]" />
          </div>
          Platform Features
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Config fetch error ──────────────────────────────────────── */}
        {configError && (
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700">Unable to load Vasco config</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                The toggle may not reflect the current state. Check that you are logged in as an admin.
              </p>
            </div>
          </div>
        )}

        {/* ── Vasco Feature Toggle ─────────────────────────────────────── */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6d28d9] to-[#4c1d95] flex items-center justify-center flex-shrink-0">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Ask Vasco</span>
                <Badge
                  className={`text-[10px] px-1.5 py-0 ${
                    isEnabled
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-400 hover:bg-gray-500 text-white'
                  }`}
                >
                  {isEnabled ? 'Live' : 'Off'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Public AI financial navigator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isLoading || toggleMutation.isPending) && (
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={isLoading || toggleMutation.isPending}
              aria-label="Toggle Ask Vasco"
            />
          </div>
        </div>

        {/* Last updated info */}
        {lastUpdated && (
          <p className="text-[11px] text-gray-400 px-1">
            Last updated: {lastUpdated}
          </p>
        )}

        {/* Quick link to view the page */}
        {isEnabled && (
          <a
            href="/ask-vasco"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#6d28d9] hover:underline px-1"
          >
            <ExternalLink className="h-3 w-3" />
            View Ask Vasco page
          </a>
        )}

        <Separator className="my-2" />

        {/* ── Article Index (RAG) ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">Article Index</span>
              {hasIndex ? (
                <Badge className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-1.5 py-0">
                  {indexStatus!.articles.length} articles
                </Badge>
              ) : (
                <Badge className="bg-gray-400 hover:bg-gray-500 text-white text-[10px] px-1.5 py-0">
                  Not indexed
                </Badge>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 px-1">
            Index published articles so Vasco can reference them in conversations.
          </p>

          {/* Index stats */}
          {hasIndex && (
            <div className="flex items-center gap-4 px-1">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>{indexStatus!.totalChunks} chunks</span>
              </div>
              {lastIndexed && (
                <span className="text-[11px] text-gray-400">
                  Last indexed: {lastIndexed}
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-gray-200"
              onClick={() => indexMutation.mutate()}
              disabled={indexMutation.isPending}
            >
              {indexMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              {indexMutation.isPending ? 'Indexing...' : hasIndex ? 'Re-index' : 'Index Articles'}
            </Button>

            {hasIndex && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (window.confirm('Clear the entire article index? Vasco will no longer reference articles until re-indexed.')) {
                    clearIndexMutation.mutate();
                  }
                }}
                disabled={clearIndexMutation.isPending}
              >
                {clearIndexMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1.5" />
                )}
                Clear Index
              </Button>
            )}
          </div>

          {/* Index errors */}
          {indexMutation.data?.errors && indexMutation.data.errors.length > 0 && (
            <div className="p-2 rounded border border-amber-200 bg-amber-50 space-y-1">
              <div className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {indexMutation.data.errors.length} indexing error(s)
              </div>
              {indexMutation.data.errors.slice(0, 3).map((err, i) => (
                <p key={i} className="text-[11px] text-amber-600 pl-4">{err}</p>
              ))}
            </div>
          )}

          {/* Expandable indexed articles list */}
          {hasIndex && indexStatus!.articles.length > 0 && (
            <div>
              <button
                onClick={() => setShowIndexDetails(!showIndexDetails)}
                className="text-[11px] text-[#6d28d9] hover:underline px-1"
              >
                {showIndexDetails ? 'Hide' : 'Show'} indexed articles ({indexStatus!.articles.length})
              </button>
              {showIndexDetails && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {indexStatus!.articles.map((article) => (
                    <div
                      key={article.articleId}
                      className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 border border-gray-100"
                    >
                      <span className="text-xs text-gray-700 truncate max-w-[200px]">
                        {article.title}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                        {article.chunkCount} chunks
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}