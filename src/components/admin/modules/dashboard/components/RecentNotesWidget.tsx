/**
 * RecentNotesWidget — Dashboard widget showing recent notes
 *
 * Follows the TasksWidget structural pattern.
 * §7 — Presentation only
 * §8.3 — Stat card and widget standards
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import { StickyNote, ArrowRight, Plus, User, Pin } from 'lucide-react';
import { useAuth } from '../../../../auth/AuthContext';
import { useNotes } from '../../notes/hooks';
import { NOTE_COLOR_CONFIG } from '../../notes/constants';
import type { Note } from '../../notes/types';

interface RecentNotesWidgetProps {
  onModuleChange?: (module: string) => void;
  maxNotes?: number;
}

export function RecentNotesWidget({
  onModuleChange,
  maxNotes = 5,
}: RecentNotesWidgetProps) {
  const { user } = useAuth();
  const personnelId = user?.id || '';
  const { data: allNotes = [], isLoading } = useNotes(personnelId);

  // Show only active (non-archived) notes, sorted by updatedAt descending
  const recentNotes = allNotes
    .filter((n) => !n.isArchived)
    .slice(0, maxNotes);

  const handleViewAll = () => {
    if (onModuleChange) {
      onModuleChange('notes');
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center">
            <StickyNote className="h-5 w-5 mr-2 text-purple-600" />
            Recent Notes
          </CardTitle>
          <CardDescription>Your latest notes and memos</CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={handleViewAll}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3 p-3 rounded-lg border border-border">
                <Skeleton className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : recentNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <StickyNote className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900">No notes yet</p>
            <p className="text-xs text-gray-500 mt-0.5 max-w-[240px]">
              Create your first note to capture ideas and meeting information.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={handleViewAll}
            >
              <Plus className="h-4 w-4 mr-1" /> Create Note
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentNotes.map((note) => (
              <NoteRow key={note.id} note={note} onClick={handleViewAll} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INTERNAL: Note row in the widget
// ============================================================================

function NoteRow({ note, onClick }: { note: Note; onClick: () => void }) {
  const colorCfg = NOTE_COLOR_CONFIG[note.color] || NOTE_COLOR_CONFIG.default;
  const snippet = note.content.length > 80 ? note.content.slice(0, 80) + '...' : note.content;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left group"
    >
      {/* Colour dot */}
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${colorCfg.dot}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {note.isPinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
          <p className="text-sm font-medium text-gray-900 truncate">{note.title}</p>
        </div>
        {snippet && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{snippet}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {note.clientName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-600 border-purple-200">
              <User className="h-2.5 w-2.5 mr-0.5" /> {note.clientName}
            </Badge>
          )}
          {note.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
        {formatRelativeTime(note.updatedAt)}
      </span>
    </button>
  );
}

// ============================================================================
// UTILITY: Relative time formatting
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(isoDate).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
  });
}
