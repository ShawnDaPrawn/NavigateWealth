/**
 * FilterPresetBar — Saved filter preset management
 *
 * §7 — Presentation + local UI state only
 * §8.3 — Consistent admin panel styling
 *
 * Presets are stored in localStorage keyed by personnelId.
 */

import { useState, useCallback, useEffect } from 'react';
import type { SavedFilterPreset, NoteColor, NoteArchiveFilter, NoteSortBy } from '../types';
import { FILTER_PRESETS_STORAGE_KEY } from '../constants';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Dialog, DialogContent, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import { toast } from 'sonner';
import { useConfirm } from '../../../layout/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Bookmark,
  BookmarkPlus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  FolderHeart,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface CurrentFilterState {
  search: string;
  archiveFilter: NoteArchiveFilter;
  colorFilter: NoteColor | 'all';
  sortBy: NoteSortBy;
  selectedTags: string[];
  clientFilter: string;
}

interface FilterPresetBarProps {
  personnelId: string;
  currentFilters: CurrentFilterState;
  onApplyPreset: (filters: CurrentFilterState) => void;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function getStorageKey(personnelId: string): string {
  return `${FILTER_PRESETS_STORAGE_KEY}_${personnelId}`;
}

function loadPresets(personnelId: string): SavedFilterPreset[] {
  try {
    const raw = localStorage.getItem(getStorageKey(personnelId));
    if (!raw) return [];
    return JSON.parse(raw) as SavedFilterPreset[];
  } catch {
    return [];
  }
}

function savePresetsToStorage(personnelId: string, presets: SavedFilterPreset[]): void {
  try {
    localStorage.setItem(getStorageKey(personnelId), JSON.stringify(presets));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Check if current filters differ from defaults */
function hasActiveFilters(f: CurrentFilterState): boolean {
  return (
    f.search !== '' ||
    f.archiveFilter !== 'active' ||
    f.colorFilter !== 'all' ||
    f.sortBy !== 'updatedAt' ||
    f.selectedTags.length > 0 ||
    f.clientFilter !== 'all'
  );
}

/** Summarise a preset's filters for display */
function describeFilters(f: CurrentFilterState): string {
  const parts: string[] = [];
  if (f.search) parts.push(`"${f.search}"`);
  if (f.archiveFilter !== 'active') parts.push(f.archiveFilter);
  if (f.colorFilter !== 'all') parts.push(f.colorFilter);
  if (f.selectedTags.length > 0) parts.push(`tags: ${f.selectedTags.join(', ')}`);
  if (f.clientFilter !== 'all')
    parts.push(f.clientFilter === '__unlinked__' ? 'unlinked' : 'client filter');
  return parts.length > 0 ? parts.join(' + ') : 'Default view';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FilterPresetBar({
  personnelId,
  currentFilters,
  onApplyPreset,
}: FilterPresetBarProps) {
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  // Load presets from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets(personnelId));
  }, [personnelId]);

  // Persist to localStorage on change
  const persistPresets = useCallback(
    (updated: SavedFilterPreset[]) => {
      setPresets(updated);
      savePresetsToStorage(personnelId, updated);
    },
    [personnelId],
  );

  const handleSavePreset = useCallback(() => {
    const name = savePresetName.trim();
    if (!name) {
      setNameError('Give the preset a name');
      return;
    }

    const newPreset: SavedFilterPreset = {
      id: generateId(),
      name,
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
    };

    persistPresets([...presets, newPreset]);
    setActivePresetId(newPreset.id);
    setShowSaveDialog(false);
    setSavePresetName('');
    toast.success(`Preset "${name}" saved`);
  }, [savePresetName, currentFilters, presets, persistPresets]);

  const handleDeletePreset = useCallback(
    async (id: string) => {
      const preset = presets.find((p) => p.id === id);
      const ok = await confirm({
        title: 'Delete preset',
        description: `Delete the preset “${preset?.name ?? ''}”? Your notes are not affected.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return;
      persistPresets(presets.filter((p) => p.id !== id));
      if (activePresetId === id) setActivePresetId(null);
      toast.success('Preset deleted');
    },
    [presets, activePresetId, persistPresets, confirm],
  );

  const handleRenamePreset = useCallback(
    (id: string) => {
      const name = editingName.trim();
      if (!name) return;
      persistPresets(presets.map((p) => (p.id === id ? { ...p, name } : p)));
      setEditingPresetId(null);
      setEditingName('');
      toast.success('Preset renamed');
    },
    [editingName, presets, persistPresets],
  );

  const handleApplyPreset = useCallback(
    (preset: SavedFilterPreset) => {
      setActivePresetId(preset.id);
      onApplyPreset(preset.filters);
    },
    [onApplyPreset],
  );

  const handleUpdatePreset = useCallback(
    (id: string) => {
      persistPresets(
        presets.map((p) =>
          p.id === id
            ? { ...p, filters: { ...currentFilters }, createdAt: new Date().toISOString() }
            : p,
        ),
      );
      toast.success('Preset updated with the current filters');
    },
    [presets, currentFilters, persistPresets],
  );

  const canSaveCurrentFilters = hasActiveFilters(currentFilters);
  const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : null;

  return (
    <div className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 gap-1.5 text-[13px] ${activePreset ? 'text-nw-violet-600' : 'text-nw-text-2'}`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${activePreset ? 'fill-nw-violet text-nw-violet' : ''}`}
              aria-hidden="true"
            />
            {activePreset ? `Preset: ${activePreset.name}` : 'Presets'}
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem
            disabled={!canSaveCurrentFilters}
            onSelect={() => {
              setSavePresetName('');
              setNameError(null);
              setShowSaveDialog(true);
            }}
            className="text-[13px]"
          >
            <BookmarkPlus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Save current filters…
          </DropdownMenuItem>
          {presets.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-nw-text-3">
              No presets yet. Set some filters, then save them here.
            </p>
          )}
          {presets.length > 0 && <DropdownMenuSeparator />}
          {presets.map((preset) => (
            <div key={preset.id} className="contents">
              {editingPresetId === preset.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Input
                    value={editingName}
                    aria-label="Preset name"
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleRenamePreset(preset.id);
                      if (e.key === 'Escape') {
                        setEditingPresetId(null);
                        setEditingName('');
                      }
                    }}
                    className="h-7 flex-1 text-xs"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Save name"
                    onClick={() => handleRenamePreset(preset.id)}
                  >
                    <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Cancel rename"
                    onClick={() => {
                      setEditingPresetId(null);
                      setEditingName('');
                    }}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem
                  onSelect={() => handleApplyPreset(preset)}
                  className="flex items-start gap-2 py-2 text-xs"
                >
                  <Bookmark
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      activePresetId === preset.id
                        ? 'fill-nw-violet text-nw-violet'
                        : 'text-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{preset.name}</div>
                    <div className="mt-0.5 truncate text-[10px] text-gray-400">
                      {describeFilters(preset.filters)}
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Rename ${preset.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingPresetId(preset.id);
                        setEditingName(preset.name);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Update ${preset.name} with the current filters`}
                      title="Update with current filters"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUpdatePreset(preset.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <FolderHeart className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${preset.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDeletePreset(preset.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </DropdownMenuItem>
              )}
            </div>
          ))}
          {activePreset && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setActivePresetId(null)}
                className="text-xs text-gray-500"
              >
                <X className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Clear active preset
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-[440px]">
          <DialogTitle className="text-base font-semibold">Save filter preset</DialogTitle>
          <form
            noValidate
            className="mt-2 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePreset();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                value={savePresetName}
                onChange={(e) => {
                  setSavePresetName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'preset-name-error' : 'preset-name-hint'}
                autoFocus
              />
              {nameError ? (
                <p id="preset-name-error" className="text-xs text-red-600">
                  {nameError}
                </p>
              ) : (
                <p id="preset-name-hint" className="text-xs text-nw-text-3">
                  Saves the current search, client, colour and tag filters.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save preset</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
