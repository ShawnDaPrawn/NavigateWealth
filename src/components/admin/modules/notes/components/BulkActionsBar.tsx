/**
 * BulkActionsBar — Floating action bar for multi-select note operations
 *
 * §7 — Presentation only; delegates mutations to parent
 * §8.3 — Consistent with admin panel destructive-action patterns
 */

import { useState } from 'react';
import type { NoteColor } from '../types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS } from '../constants';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Archive,
  ArchiveRestore,
  Trash2,
  Tag,
  Palette,
  X,
  CheckSquare,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  /** Whether any selected note is archived (to show Unarchive vs Archive) */
  hasArchivedSelected: boolean;
  hasActiveSelected: boolean;
  /** All unique tags from the selected notes */
  selectedNoteTags: string[];
  /** All unique tags from ALL notes (for "add tag" suggestions) */
  allTags: string[];
  isBusy: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onSetColor: (color: NoteColor) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  totalCount: number;
  /** Optional custom colour label resolver */
  getColourLabel?: (color: NoteColor) => string;
}

export function BulkActionsBar({
  selectedCount,
  hasArchivedSelected,
  hasActiveSelected,
  selectedNoteTags,
  allTags,
  isBusy,
  onArchive,
  onUnarchive,
  onDelete,
  onAddTag,
  onRemoveTag,
  onSetColor,
  onClearSelection,
  onSelectAll,
  totalCount,
  getColourLabel,
}: BulkActionsBarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  if (selectedCount === 0) return null;

  const handleAddNewTag = () => {
    const tag = newTagInput.trim();
    if (tag) {
      onAddTag(tag);
      setNewTagInput('');
    }
  };

  return (
    <div className="contents">
      {/* Floating bar — fixed to bottom centre */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-2.5 border border-gray-700">
          {/* Selection info */}
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
            <CheckSquare className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">{selectedCount} selected</span>
            {selectedCount < totalCount && (
              <button
                type="button"
                onClick={onSelectAll}
                className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2"
              >
                Select all ({totalCount})
              </button>
            )}
          </div>

          {/* Primary actions */}
          {hasActiveSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-700 h-8 text-xs gap-1.5"
              onClick={onArchive}
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              Archive
            </Button>
          )}
          {hasArchivedSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-700 h-8 text-xs gap-1.5"
              onClick={onUnarchive}
              disabled={isBusy}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Unarchive
            </Button>
          )}

          {/* Tag menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700 h-8 text-xs gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              {/* Add existing tag */}
              {allTags.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <Tag className="h-3.5 w-3.5 mr-2" /> Add existing tag
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-48 overflow-y-auto">
                    {allTags.map((tag) => (
                      <DropdownMenuItem key={tag} onClick={() => onAddTag(tag)} className="text-xs">
                        {tag}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {/* Add new tag inline */}
              <div className="px-2 py-1.5">
                <div className="flex gap-1">
                  <Input
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewTag(); } }}
                    placeholder="New tag..."
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleAddNewTag}
                    disabled={!newTagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
              {/* Remove tags */}
              {selectedNoteTags.length > 0 && (
                <div className="contents">
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs text-red-600">
                      <X className="h-3.5 w-3.5 mr-2" /> Remove tag
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {selectedNoteTags.map((tag) => (
                        <DropdownMenuItem key={tag} onClick={() => onRemoveTag(tag)} className="text-xs text-red-600">
                          {tag}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Colour menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700 h-8 text-xs gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Colour
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40">
              {NOTE_COLORS.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onSetColor(c)} className="text-xs gap-2">
                  <span className={`w-3 h-3 rounded-full ${NOTE_COLOR_CONFIG[c].dot}`} />
                  {getColourLabel ? getColourLabel(c) : NOTE_COLOR_CONFIG[c].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Destructive */}
          <div className="pl-1 border-l border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8 text-xs gap-1.5"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isBusy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>

          {/* Close */}
          <div className="pl-1 border-l border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-700 h-8 w-8 p-0"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} {selectedCount === 1 ? 'Note' : 'Notes'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedCount} {selectedCount === 1 ? 'note' : 'notes'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { onDelete(); setShowDeleteDialog(false); }}
            >
              Delete {selectedCount} {selectedCount === 1 ? 'Note' : 'Notes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}