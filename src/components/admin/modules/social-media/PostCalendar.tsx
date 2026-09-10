/**
 * PostCalendar — Buffer's queue as a calendar.
 *
 * Every post here is a Buffer post (the weekly automation's and the manual
 * ones alike). Editing happens in Buffer; from here a post can be opened once
 * published, or deleted. Dates follow en-ZA (§8.3).
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Instagram,
  Facebook,
  Linkedin,
  MoreVertical,
  Plus,
  Trash2,
  Twitter,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Calendar } from '../../../ui/calendar';
import { Card, CardContent } from '../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import type { PostStatus, SocialPlatform, SocialPost, SocialProfile } from './types';

export type CalendarViewMode = 'month' | 'week' | 'day';

interface PostCalendarProps {
  posts: SocialPost[];
  profiles?: SocialProfile[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onPostDelete: (postId: string) => void | Promise<unknown>;
  onCreatePost: (date: Date) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
};

/** §8.3 vocabulary: green live, blue informational, amber pending, red error. */
const STATUS_CLASSES: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending_approval: 'bg-amber-100 text-amber-700',
};

const STATUS_ICONS: Record<PostStatus, typeof Clock> = {
  draft: MoreVertical,
  scheduled: Clock,
  published: CheckCircle,
  failed: XCircle,
  pending_approval: AlertTriangle,
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
  pending_approval: 'Needs approval',
};

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Monday of the week containing `date`, without mutating the input. */
function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const postDate = (post: SocialPost) => post.scheduledAt ?? post.publishedAt;
const timeLabel = (date?: Date) =>
  date ? date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '';

function PlatformIcon({
  platform,
  className,
}: {
  platform?: SocialPlatform | null;
  className: string;
}) {
  const Icon = platform ? PLATFORM_ICONS[platform] : null;
  return Icon ? <Icon className={className} /> : <CalendarIcon className={className} />;
}

export function PostCalendar({
  posts = [],
  profiles = [],
  selectedDate,
  onDateChange,
  onPostDelete,
  onCreatePost,
  viewMode,
  onViewModeChange,
}: PostCalendarProps) {
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const channelName = (post: SocialPost) =>
    profiles.find((p) => p.id === post.channelId)?.name ?? post.platform ?? 'Channel';

  const postsForDate = (date: Date) =>
    posts
      .filter((post) => {
        const at = postDate(post);
        return at && isSameDay(at, date);
      })
      .sort((a, b) => (postDate(a)?.getTime() ?? 0) - (postDate(b)?.getTime() ?? 0));

  const weekDays = (date: Date) => {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  };

  const shiftSelected = (direction: 1 | -1) => {
    const next = new Date(selectedDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (viewMode === 'day' ? 1 : 7));
    onDateChange(next);
  };

  const headerLabel = () => {
    if (viewMode === 'month') {
      return selectedDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const start = startOfWeek(selectedDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    return selectedDate.toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const PostChip = ({ post }: { post: SocialPost }) => (
    <button
      type="button"
      className="w-full text-left p-2 rounded border text-xs hover:shadow-sm transition-shadow bg-white"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedPost(post);
      }}
    >
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="flex items-center gap-1 text-muted-foreground truncate">
          <PlatformIcon platform={post.platform} className="h-3 w-3 shrink-0" />
          <span className="truncate">{channelName(post)}</span>
        </span>
        <span className={`px-1 py-0.5 rounded ${STATUS_CLASSES[post.status]}`}>
          {STATUS_LABELS[post.status]}
        </span>
      </div>
      <div className="line-clamp-2 mb-1">{post.body}</div>
      <div className="text-muted-foreground">{timeLabel(postDate(post))}</div>
    </button>
  );

  const renderWeekView = () => {
    const days = weekDays(selectedDate);
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {days.map((day) => (
          <div
            key={`h-${day.toISOString()}`}
            className="bg-card p-3 border-b text-center font-medium text-sm"
          >
            {day.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' })}
          </div>
        ))}
        {days.map((day) => {
          const dayPosts = postsForDate(day);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          return (
            <div
              key={`c-${day.toISOString()}`}
              className={`bg-card p-2 min-h-[180px] cursor-pointer hover:bg-muted/20 ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} ${isToday ? 'bg-primary/5' : ''}`}
              onClick={() => onDateChange(day)}
            >
              <div className="space-y-2">
                {dayPosts.map((post) => (
                  <PostChip key={post.id} post={post} />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreatePost(day);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Compose
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && onDateChange(date)}
        month={selectedDate}
        onMonthChange={onDateChange}
        className="rounded-md border"
        modifiers={{ hasPost: (date) => postsForDate(date).length > 0 }}
        modifiersStyles={{ hasPost: { backgroundColor: '#1B2A4A', color: 'white' } }}
      />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">
          {selectedDate.toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
        </p>
        {postsForDate(selectedDate).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing queued for this day.</p>
        ) : (
          postsForDate(selectedDate).map((post) => <PostChip key={post.id} post={post} />)
        )}
      </div>
    </div>
  );

  const renderDayView = () => {
    const dayPosts = postsForDate(selectedDate);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {dayPosts.length} post{dayPosts.length === 1 ? '' : 's'} in Buffer for this day
        </p>
        {dayPosts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nothing queued for this day</p>
            <Button className="mt-4" onClick={() => onCreatePost(selectedDate)}>
              <Plus className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>
        ) : (
          dayPosts.map((post) => {
            const StatusIcon = STATUS_ICONS[post.status];
            return (
              <Card
                key={post.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPost(post)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <PlatformIcon platform={post.platform} className="h-4 w-4" />
                      <span className="font-medium">{channelName(post)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {timeLabel(postDate(post))}
                      </span>
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${STATUS_CLASSES[post.status]}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {STATUS_LABELS[post.status]}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm mb-3 line-clamp-3 whitespace-pre-wrap">{post.body}</p>
                  {post.media.length > 0 && (
                    <div className="flex -space-x-2">
                      {post.media.slice(0, 3).map((media) => (
                        <div
                          key={media.id}
                          className="h-8 w-8 rounded border-2 border-white bg-muted overflow-hidden"
                        >
                          {media.type === 'image' && (
                            <img src={media.url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous"
            onClick={() => shiftSelected(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[12rem] text-center">{headerLabel()}</h2>
          <Button variant="outline" size="sm" aria-label="Next" onClick={() => shiftSelected(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as CalendarViewMode)}>
            <SelectTrigger className="w-32" aria-label="Calendar view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => onCreatePost(selectedDate)}>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post in Buffer</DialogTitle>
            <DialogDescription>
              {selectedPost?.status === 'published'
                ? 'Published — open it on the network below.'
                : 'Queued in Buffer. Edit it there; delete it here or there.'}
            </DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <PlatformIcon platform={selectedPost.platform} className="h-5 w-5" />
                  <span className="font-medium">{channelName(selectedPost)}</span>
                  <span className="text-muted-foreground">
                    {postDate(selectedPost)?.toLocaleString('en-ZA', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <Badge variant="outline" className={STATUS_CLASSES[selectedPost.status]}>
                  {STATUS_LABELS[selectedPost.status]}
                </Badge>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{selectedPost.body}</p>
              </div>
              {selectedPost.media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedPost.media.slice(0, 3).map((media) => (
                    <div key={media.id} className="aspect-square rounded bg-muted overflow-hidden">
                      {media.type === 'image' && (
                        <img src={media.url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedPost.failureReason && (
                <p className="text-sm text-destructive">{selectedPost.failureReason}</p>
              )}
              <div className="flex justify-end gap-2">
                {selectedPost.externalLink && (
                  <Button asChild variant="outline">
                    <a href={selectedPost.externalLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open post
                    </a>
                  </Button>
                )}
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete in Buffer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post in Buffer?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from Buffer’s queue. A post that has already been published on the
              network is not taken down by this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedPost) await onPostDelete(selectedPost.id);
                setConfirmDelete(false);
                setSelectedPost(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
