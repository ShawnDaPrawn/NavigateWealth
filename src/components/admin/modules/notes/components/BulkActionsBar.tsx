/**
 * BulkActionsBar — the bar above the notes in select mode (design system: bulk bar)
 *
 * §7 — Presentation only; delegates mutations to parent
 * §8.3 — Consistent with admin panel destructive-action patterns
 */

import { useState } from 'react';
import type { NoteColor } from '../types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS } from '../constants';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { useConfirm } from '../../../layout/page';
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
import { Archive, ArchiveRestore, Trash2, Tag, Palette, X, Loader2 } from 'lucide-react';

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
  const [newTagInput, setNewTagInput] = useState('');
  const { confirm, confirmDialog } = useConfirm();
  const none = selectedCount === 0;
  const noun = selectedCount === 1 ? 'note' : 'notes';

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${selectedCount} ${noun}?`,
      description: `This permanently deletes ${selectedCount} ${noun}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) onDelete();
  };

  const handleAddNewTag = () => {
    const tag = newTagInput.trim();
    if (tag) {
      onAddTag(tag);
      setNewTagInput('');
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-nw-violet/30 bg-nw-violet-50 px-4 py-2"
    >
      <span className="text-sm font-medium text-nw-ink">{selectedCount} selected</span>
      {selectedCount < totalCount && (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-medium text-nw-violet-600 hover:underline"
        >
          Select all ({totalCount})
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={none || isBusy} className="bg-white">
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              Colour
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {NOTE_COLORS.map((c) => (
              <DropdownMenuItem key={c} onSelect={() => onSetColor(c)} className="gap-2 text-xs">
                <span
                  className={`h-3 w-3 rounded-full ${NOTE_COLOR_CONFIG[c].dot}`}
                  aria-hidden="true"
                />
                {getColourLabel ? getColourLabel(c) : NOTE_COLOR_CONFIG[c].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={none || isBusy} className="bg-white">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              Tags
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {allTags.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <Tag className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Add existing tag
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-48 overflow-y-auto">
                  {allTags.map((tag) => (
                    <DropdownMenuItem key={tag} onSelect={() => onAddTag(tag)} className="text-xs">
                      {tag}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <div className="px-2 py-1.5">
              <div className="flex gap-1">
                <Input
                  value={newTagInput}
                  aria-label="New tag"
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewTag();
                    }
                  }}
                  placeholder="New tag…"
                  className="h-7 flex-1 text-xs"
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
            {selectedNoteTags.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs text-red-600">
                    <X className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Remove tag
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {selectedNoteTags.map((tag) => (
                      <DropdownMenuItem
                        key={tag}
                        onSelect={() => onRemoveTag(tag)}
                        className="text-xs text-red-600"
                      >
                        {tag}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {(hasActiveSelected || none) && (
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            onClick={onArchive}
            disabled={none || isBusy}
          >
            {isBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Archive
          </Button>
        )}
        {hasArchivedSelected && (
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            onClick={onUnarchive}
            disabled={isBusy}
          >
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
            Unarchive
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => void handleDelete()}
          disabled={none || isBusy}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete…
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Clear selection"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
