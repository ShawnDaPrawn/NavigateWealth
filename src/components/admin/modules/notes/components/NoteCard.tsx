/**
 * NoteCard — Individual note display card
 *
 * §7 — Presentation only; no business logic
 * §8.3 — Config-driven colour coding
 */

import { useState } from 'react';
import type { Note } from '../types';
import { NOTE_COLOR_CONFIG } from '../constants';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
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
  Pin,
  MoreVertical,
  Trash2,
  Archive,
  ArchiveRestore,
  ListTodo,
  User,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const colorCfg = NOTE_COLOR_CONFIG[note.color] || NOTE_COLOR_CONFIG.default;

  const contentPreview =
    note.content.length > 180
      ? note.content.slice(0, 180) + '...'
      : note.content;

  const isConverted = !!note.convertedToTaskId;
  const hasSummary = !!note.summary;

  if (viewMode === 'list') {
    return (
      <div className="contents">
        <div
          className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer
            hover:shadow-sm transition-all group ${colorCfg.bg} ${colorCfg.border}${isSelecting && isSelected ? ' ring-2 ring-purple-400 ring-offset-1' : ''}`}
          onClick={() => {
            if (isSelecting && onToggleSelect) {
              onToggleSelect(note.id);
            } else {
              onOpen(note);
            }
          }}
        >
          {/* Selection checkbox */}
          {isSelecting && (
            <button
              type="button"
              className="shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(note.id); }}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-white/90 border-gray-300 hover:border-purple-400'
              }`}>
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          )}
          {/* Accent bar */}
          <div className={`w-1 self-stretch rounded-full ${colorCfg.accent}`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {note.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              <h3 className="font-semibold text-gray-900 truncate text-sm">{note.title}</h3>
              {hasSummary && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 shrink-0">
                  <Sparkles className="h-3 w-3 mr-0.5" /> Summarised
                </Badge>
              )}
              {isConverted && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Task
                </Badge>
              )}
            </div>
            {contentPreview && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{contentPreview}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {note.clientName && (
                <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
                  <User className="h-3 w-3" /> {note.clientName}
                </span>
              )}
              {note.tags.length > 0 && (
                <div className="flex gap-1">
                  {note.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                  ))}
                </div>
              )}
              <span className="text-[10px] text-gray-400 ml-auto">
                {new Date(note.updatedAt).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(note); }}>
                <Pin className="h-4 w-4 mr-2" /> {note.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {!isConverted && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConvertToTask(note); }}>
                  <ListTodo className="h-4 w-4 mr-2" /> Convert to Task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(note); }}>
                {note.isArchived
                  ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                  : <><Archive className="h-4 w-4 mr-2" /> Archive</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{note.title}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(note)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Grid view
  return (
    <div className="contents">
      <div
        className={`rounded-lg border cursor-pointer hover:shadow-md transition-all group flex flex-col relative
          ${colorCfg.bg} ${colorCfg.border} overflow-hidden${isSelecting && isSelected ? ' ring-2 ring-purple-400 ring-offset-1' : ''}`}
        onClick={() => {
          if (isSelecting && onToggleSelect) {
            onToggleSelect(note.id);
          } else {
            onOpen(note);
          }
        }}
      >
        {/* Selection checkbox */}
        {isSelecting && (
          <button
            type="button"
            className="absolute top-2 left-2 z-10"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(note.id); }}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-white/90 border-gray-300 hover:border-purple-400'
            }`}>
              {isSelected && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
        )}
        {/* Header with accent */}
        <div className={`px-4 py-3 flex items-start justify-between ${colorCfg.headerBg}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {note.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              <h3 className="font-semibold text-gray-900 truncate text-sm">{note.title}</h3>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 -mr-1 -mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(note); }}>
                <Pin className="h-4 w-4 mr-2" /> {note.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {!isConverted && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConvertToTask(note); }}>
                  <ListTodo className="h-4 w-4 mr-2" /> Convert to Task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(note); }}>
                {note.isArchived
                  ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                  : <><Archive className="h-4 w-4 mr-2" /> Archive</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex-1">
          {contentPreview ? (
            <p className="text-xs text-gray-600 line-clamp-4 whitespace-pre-wrap leading-relaxed">
              {contentPreview}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Empty note</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-inherit flex items-center gap-2 flex-wrap">
          {note.clientName && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">
              <User className="h-3 w-3 mr-0.5" /> {note.clientName}
            </Badge>
          )}
          {hasSummary && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">
              <Sparkles className="h-3 w-3 mr-0.5" /> Summarised
            </Badge>
          )}
          {isConverted && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Task
            </Badge>
          )}
          {note.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
          <span className="text-[10px] text-gray-400 ml-auto">
            {new Date(note.updatedAt).toLocaleDateString('en-ZA', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{note.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => onDelete(note)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}