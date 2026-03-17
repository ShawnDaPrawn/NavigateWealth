/**
 * Draft Posts
 *
 * Lists all saved draft social media posts with options to edit,
 * schedule, publish, duplicate, or delete them.
 *
 * Visual identity follows Navigate Wealth brand:
 *   Navy (#1B2A4A) — primary / structural
 *   Gold (#C9A84C) — accent / emphasis
 *   Minimalist layout with generous whitespace
 *
 * @module social-media/components/DraftPosts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Calendar } from '../../../../ui/calendar';
import { toast } from 'sonner@2.0.3';
import {
  FileText,
  Search,
  Pencil,
  Trash2,
  Copy,
  Calendar as CalendarIcon,
  Send,
  Clock,
  Image as ImageIcon,
  Inbox,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
} from 'lucide-react';
import type { SocialPost, SocialPlatform } from '../types';
import { BRAND, PLATFORM_DISPLAY, formatDateZA, formatTimeZA } from '../constants';

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '\u2026';
}

// ============================================================================
// Props
// ============================================================================

interface DraftPostsProps {
  posts: SocialPost[];
  profileNameLookup: Record<string, { name: string; platform: SocialPlatform }>;
  onEdit?: (post: SocialPost) => void;
  onDelete?: (postId: string) => Promise<boolean>;
  onDuplicate?: (post: SocialPost) => void;
  onSchedule?: (postId: string, scheduledAt: Date) => Promise<boolean>;
  onPublish?: (postId: string) => Promise<boolean>;
}

// ============================================================================
// Component
// ============================================================================

export function DraftPosts({
  posts: drafts,
  profileNameLookup,
  onEdit,
  onDelete,
  onDuplicate,
  onSchedule,
  onPublish,
}: DraftPostsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scheduleDialogId, setScheduleDialogId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);

  // --------------------------------------------------------------------------
  // Filtered & sorted
  // --------------------------------------------------------------------------

  const sortedDrafts = useMemo(() => {
    const filtered = drafts.filter((d) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.body.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
    return [...filtered].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [drafts, searchQuery]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        await onDelete?.(postId);
        setDeleteConfirmId(null);
      } catch {
        toast.error('Failed to delete draft');
      }
    },
    [onDelete],
  );

  const handleSchedule = useCallback(async () => {
    if (!scheduleDialogId || !scheduleDate) {
      toast.error('Please select a date');
      return;
    }
    try {
      await onSchedule?.(scheduleDialogId, scheduleDate);
      setScheduleDialogId(null);
      setScheduleDate(undefined);
    } catch {
      toast.error('Failed to schedule draft');
    }
  }, [scheduleDialogId, scheduleDate, onSchedule]);

  const handlePublish = useCallback(
    async (postId: string) => {
      try {
        await onPublish?.(postId);
      } catch {
        toast.error('Failed to publish post');
      }
    },
    [onPublish],
  );

  // --------------------------------------------------------------------------
  // Empty state
  // --------------------------------------------------------------------------

  if (drafts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="flex items-center justify-center h-12 w-12 rounded-full mb-5"
            style={{ backgroundColor: BRAND.navyLight }}
          >
            <Inbox className="h-5 w-5" style={{ color: BRAND.navy }} />
          </div>
          <h3
            className="text-base font-semibold mb-1.5"
            style={{ color: BRAND.navy }}
          >
            No Drafts Yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Create content with the AI Generator, click
            {' '}<span className="font-medium" style={{ color: BRAND.navy }}>"Use in Post"</span>,
            then save as a draft.
          </p>
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------------------
  // Main render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-9 w-9 rounded-lg"
            style={{ backgroundColor: BRAND.navyLight }}
          >
            <FileText className="h-4 w-4" style={{ color: BRAND.navy }} />
          </div>
          <div>
            <h3
              className="text-base font-semibold leading-tight"
              style={{ color: BRAND.navy }}
            >
              Saved Drafts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {drafts.length > 3 && (
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search drafts\u2026"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* No results */}
      {sortedDrafts.length === 0 && searchQuery.trim() && (
        <div className="flex flex-col items-center py-10 text-center">
          <Search className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-sm text-muted-foreground">
            No drafts match "{searchQuery}"
          </p>
        </div>
      )}

      {/* Draft cards */}
      <div className="space-y-2.5">
        {sortedDrafts.map((draft) => {
          const isExpanded = expandedId === draft.id;
          const hasMedia = draft.media && draft.media.length > 0;
          const hasTags = draft.tags && draft.tags.length > 0;

          return (
            <Card
              key={draft.id}
              className="overflow-hidden border transition-shadow hover:shadow-sm"
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Media thumbnail — minimalist, no extra border noise */}
                  {hasMedia && (
                    <div className="relative flex-shrink-0 w-20 bg-gray-50">
                      {draft.media[0].type === 'image' ? (
                        <img
                          src={draft.media[0].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <ImageIcon
                            className="h-5 w-5"
                            style={{ color: BRAND.navy }}
                          />
                        </div>
                      )}
                      {draft.media.length > 1 && (
                        <span
                          className="absolute bottom-1 right-1 text-[9px] font-medium text-white px-1 rounded"
                          style={{ backgroundColor: BRAND.navy }}
                        >
                          +{draft.media.length - 1}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 px-4 py-3">
                    {/* Body */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                      {isExpanded ? draft.body : truncateText(draft.body, 160)}
                    </p>
                    {draft.body.length > 160 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : draft.id)
                        }
                        className="text-xs font-medium mt-1"
                        style={{ color: BRAND.gold }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                      {draft.profiles.map((pid) => {
                        const p = profileNameLookup[pid];
                        if (!p) return null;
                        const pdis = PLATFORM_DISPLAY[p.platform];
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: BRAND.navyLight,
                              color: BRAND.navy,
                            }}
                          >
                            {pdis?.icon}
                            {p.name}
                          </span>
                        );
                      })}

                      {hasTags &&
                        draft.tags!.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      {hasTags && draft.tags!.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{draft.tags!.length - 3}
                        </span>
                      )}

                      <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateZA(draft.updatedAt)}, {formatTimeZA(draft.updatedAt)}
                      </span>
                    </div>

                    {/* Actions — clean row with brand-coloured primary action */}
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(draft)}
                          className="text-xs h-7 px-2.5 gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                      )}
                      {onSchedule && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setScheduleDialogId(draft.id);
                            setScheduleDate(undefined);
                          }}
                          className="text-xs h-7 px-2.5 gap-1"
                        >
                          <CalendarIcon className="h-3 w-3" />
                          Schedule
                        </Button>
                      )}
                      {onPublish && (
                        <Button
                          size="sm"
                          onClick={() => handlePublish(draft.id)}
                          className="text-xs h-7 px-2.5 gap-1 text-white"
                          style={{ backgroundColor: BRAND.navy }}
                        >
                          <Send className="h-3 w-3" />
                          Publish
                        </Button>
                      )}

                      <div className="ml-auto flex items-center gap-0.5">
                        {onDuplicate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDuplicate(draft)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-gray-700"
                            title="Duplicate"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(draft.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this draft? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Schedule Dialog                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!scheduleDialogId}
        onOpenChange={() => {
          setScheduleDialogId(null);
          setScheduleDate(undefined);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Draft</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Choose when to publish this post.
            </p>
            <Calendar
              mode="single"
              selected={scheduleDate}
              onSelect={setScheduleDate}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
              className="rounded-md border mx-auto"
            />
            {scheduleDate && (
              <p className="text-sm text-center text-muted-foreground">
                Scheduled for:{' '}
                <span className="font-medium text-foreground">
                  {formatDateZA(scheduleDate)}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setScheduleDialogId(null);
                setScheduleDate(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!scheduleDate}
              className="text-white"
              style={{ backgroundColor: BRAND.navy }}
            >
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}