/**
 * VersionHistory — Article Version History Panel (Phase 4)
 *
 * Slide-out panel that displays all saved versions of an article,
 * showing diffs, word count changes, and allowing restoration
 * of previous versions.
 *
 * @module publications/components/VersionHistory
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  X,
  RotateCcw,
  Eye,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Check,
  ArrowRight,
  User,
  Hash,
  Type,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import { PublicationsAPI } from '../api';
import type { ArticleVersion } from '../types';
import { toast } from 'sonner@2.0.3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionHistoryProps {
  articleId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a version is restored — the parent should refetch */
  onRestore: () => void;
  /** Current article body for comparison */
  currentBody?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatTimestamp(iso);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionHistory({
  articleId,
  isOpen,
  onClose,
  onRestore,
  currentBody,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ArticleVersion | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  // Fetch versions
  const loadVersions = useCallback(async () => {
    if (!articleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await PublicationsAPI.Versions.getVersions(articleId);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    if (isOpen && articleId) {
      loadVersions();
    }
  }, [isOpen, articleId, loadVersions]);

  // Save current version (manual snapshot)
  const handleSaveVersion = useCallback(async () => {
    try {
      await PublicationsAPI.Versions.createVersion(articleId, 'manual');
      toast.success('Version snapshot saved');
      await loadVersions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save version';
      setError(msg);
      toast.error(msg);
    }
  }, [articleId, loadVersions]);

  // Restore a version
  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoring(versionId);
      try {
        await PublicationsAPI.Versions.restoreVersion(articleId, versionId);
        toast.success('Version restored successfully');
        setConfirmRestore(null);
        setPreviewVersion(null);
        onRestore();
        await loadVersions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to restore version';
        setError(msg);
        toast.error(msg);
      } finally {
        setRestoring(null);
      }
    },
    [articleId, onRestore, loadVersions]
  );

  // Diff indicator
  const getChangeIndicator = useCallback(
    (version: ArticleVersion, index: number) => {
      if (index === versions.length - 1) return null; // first version
      const prev = versions[index + 1];
      if (!prev) return null;

      const wordDiff = version.word_count - prev.word_count;
      if (wordDiff > 0) return { text: `+${wordDiff} words`, color: 'text-green-600' };
      if (wordDiff < 0) return { text: `${wordDiff} words`, color: 'text-red-600' };
      return { text: 'No word change', color: 'text-gray-400' };
    },
    [versions]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <History className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Version History</h3>
              <p className="text-[10px] text-gray-500">
                {versions.length} version{versions.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveVersion}
              className="h-7 text-[11px]"
            >
              <History className="h-3 w-3 mr-1" />
              Save Now
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">Loading history...</span>
            </div>
          )}

          {error && (
            <div className="m-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <History className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No versions yet</p>
              <p className="text-xs text-gray-500 mb-4">
                Versions are created automatically when you save changes.
                You can also create a manual snapshot.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveVersion}
                className="gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                Create First Snapshot
              </Button>
            </div>
          )}

          {!isLoading && versions.length > 0 && (
            <div className="py-2">
              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[29px] top-4 bottom-4 w-px bg-gray-200" />

                {versions.map((version, index) => {
                  const change = getChangeIndicator(version, index);
                  const isFirst = index === 0;
                  const isPreviewing = previewVersion?.id === version.id;
                  const isRestoreConfirm = confirmRestore === version.id;

                  return (
                    <div
                      key={version.id}
                      className={cn(
                        'relative px-5 py-3 transition-colors',
                        isPreviewing && 'bg-blue-50/50'
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute left-[25px] top-[18px] w-[9px] h-[9px] rounded-full border-2 bg-white z-10',
                          isFirst ? 'border-blue-500' : 'border-gray-300'
                        )}
                      />

                      <div className="ml-10">
                        {/* Version header */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">
                              v{version.version_number}
                            </span>
                            {isFirst && (
                              <Badge className="text-[9px] px-1 py-0 h-3.5 bg-blue-100 text-blue-700 border-0">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {timeAgo(version.created_at)}
                          </span>
                        </div>

                        {/* Change summary */}
                        <p className="text-xs text-gray-600 mb-1.5">{version.change_summary}</p>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {version.word_count.toLocaleString()} words
                          </span>
                          <span className="flex items-center gap-1">
                            <Type className="h-3 w-3" />
                            {version.char_count.toLocaleString()} chars
                          </span>
                          {change && (
                            <span className={cn('font-medium', change.color)}>{change.text}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.edited_by}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPreviewVersion(isPreviewing ? null : version)
                            }
                            className="h-6 text-[10px] px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {isPreviewing ? 'Hide' : 'Preview'}
                          </Button>

                          {!isFirst && !isRestoreConfirm && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmRestore(version.id)}
                              className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          )}

                          {isRestoreConfirm && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleRestore(version.id)}
                                disabled={restoring === version.id}
                                className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700"
                              >
                                {restoring === version.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                Confirm
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmRestore(null)}
                                className="h-6 text-[10px] px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Preview content */}
                        {isPreviewing && (
                          <div className="mt-3 bg-white border border-blue-200 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
                                Version {version.version_number} Preview
                              </span>
                              <span className="text-[10px] text-blue-500">
                                {formatTimestamp(version.created_at)}
                              </span>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-medium text-gray-900 mb-1">
                                {version.title}
                              </p>
                              {version.excerpt && (
                                <p className="text-[11px] text-gray-500 mb-2 italic">
                                  {version.excerpt}
                                </p>
                              )}
                              <div
                                className="prose prose-xs max-w-none text-[11px] text-gray-600 leading-relaxed max-h-48 overflow-y-auto"
                                dangerouslySetInnerHTML={{
                                  __html: version.body || '<p class="text-gray-400">No content</p>',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            Up to 50 versions are retained per article
          </p>
        </div>
      </div>
    </div>
  );
}