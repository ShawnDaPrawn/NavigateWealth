/**
 * NoteCard — Individual note display card
 *
 * §7 — Presentation only; no business logic
 * §8.3 — Config-driven colour coding
 */

import type { Note } from '../types';
import { NOTE_COLOR_CONFIG } from '../constants';
import { cn } from '../../../../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { useConfirm } from '../../../layout/page';
import { Pin, MoreHorizontal, Trash2, Archive, ArchiveRestore, ListTodo } from 'lucide-react';

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onPin: (note: Note) => void;
  onArchive: (note: Note) => void;
  onDelete: (note: Note) => void;
  onConvertToTask: (note: Note) => void;
  viewMode: 'grid' | 'list';
  /** Selection mode — show checkbox */
  isSelecting?: boolean;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Toggle selection callback */
  onToggleSelect?: (noteId: string) => void;
}

export function NoteCard({
  note,
  onOpen,
  onPin,
  onArchive,
  onDelete,
  onConvertToTask,
  viewMode,
  isSelecting = false,
  isSelected = false,
  onToggleSelect,
}: NoteCardProps) {
  const { confirm, confirmDialog } = useConfirm();
  const askDelete = async () => {
    const ok = await confirm({
      title: 'Delete note',
      description: `Delete “${note.title || 'Untitled note'}”? This action cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) onDelete(note);
  };
  const colorCfg = NOTE_COLOR_CONFIG[note.color] || NOTE_COLOR_CONFIG.default;
  const isConverted = !!note.convertedToTaskId;
  const preview = note.content.length > 180 ? note.content.slice(0, 180) + '…' : note.content;
  const when = note.isArchived
    ? `Archived ${shortDate(note.updatedAt)}`
    : isConverted
      ? 'Converted to task'
      : shortDate(note.updatedAt);
  const meta = `${note.clientName || 'No client'} · ${when}`;

  const handleClick = () => {
    if (isSelecting && onToggleSelect) onToggleSelect(note.id);
    else onOpen(note);
  };

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`More actions for ${note.title || 'note'}`}
          className="ds-btn ds-btn-ghost ds-btn-sm absolute right-2 top-2 !w-8 !justify-center !p-0 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onPin(note);
          }}
        >
          <Pin className="mr-2 h-4 w-4" /> {note.isPinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        {!isConverted && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onConvertToTask(note);
            }}
          >
            <ListTodo className="mr-2 h-4 w-4" /> Convert to task
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onArchive(note);
          }}
        >
          {note.isArchived ? (
            <>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
            </>
          ) : (
            <>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            void askDelete();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const checkbox = isSelecting ? (
    <input
      type="checkbox"
      checked={isSelected}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="mr-1.5 align-[-2px] accent-[#6d28d9]"
    />
  ) : null;

  return (
    <div className="contents">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelecting ? isSelected : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          // Only the card itself: Enter/Space on a control inside it (the ⋯ menu,
          // the selection box) must keep that control's own behaviour.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={cn(
          'ds-note group',
          // List rows sit on one line from sm up; on a phone they stack like a
          // compact card, because a 256px title plus the meta ran off the screen.
          viewMode === 'list' && 'sm:!flex-row sm:!items-center sm:!gap-4',
          isSelecting && isSelected && 'sel',
        )}
      >
        {note.color !== 'default' && (
          <span className={cn('sw', colorCfg.accent)} aria-hidden="true" />
        )}
        <b
          className={cn(
            'pr-8',
            viewMode === 'list' ? 'truncate sm:w-64 sm:shrink-0' : 'line-clamp-2',
          )}
        >
          {checkbox}
          {note.title || 'Untitled note'}
        </b>
        {preview ? (
          <p className={viewMode === 'list' ? 'min-w-0 truncate sm:flex-1' : 'line-clamp-3'}>
            {preview}
          </p>
        ) : (
          <p className={cn('italic text-nw-text-3', viewMode === 'list' && 'flex-1')}>Empty note</p>
        )}
        <span className={cn('ds-meta', viewMode === 'list' ? 'sm:shrink-0 sm:pr-8' : 'mt-auto')}>
          {meta}
        </span>
        {menu}
      </div>

      <span className="contents" onClick={(e) => e.stopPropagation()}>
        {confirmDialog}
      </span>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
