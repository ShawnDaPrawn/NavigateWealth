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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../../../ui/dialog';
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
  if (f.clientFilter !== 'all') parts.push(f.clientFilter === '__unlinked__' ? 'unlinked' : 'client filter');
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

  // Load presets from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets(personnelId));
  }, [personnelId]);

  // Persist to localStorage on change
  const persistPresets = useCallback((updated: SavedFilterPreset[]) => {
    setPresets(updated);
    savePresetsToStorage(personnelId, updated);
  }, [personnelId]);

  const handleSavePreset = useCallback(() => {
    const name = savePresetName.trim();
    if (!name) return;

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
  }, [savePresetName, currentFilters, presets, persistPresets]);

  const handleDeletePreset = useCallback((id: string) => {
    persistPresets(presets.filter((p) => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  }, [presets, activePresetId, persistPresets]);

  const handleRenamePreset = useCallback((id: string) => {
    const name = editingName.trim();
    if (!name) return;
    persistPresets(presets.map((p) => p.id === id ? { ...p, name } : p));
    setEditingPresetId(null);
    setEditingName('');
  }, [editingName, presets, persistPresets]);

  const handleApplyPreset = useCallback((preset: SavedFilterPreset) => {
    setActivePresetId(preset.id);
    onApplyPreset(preset.filters);
  }, [onApplyPreset]);

  const handleUpdatePreset = useCallback((id: string) => {
    persistPresets(presets.map((p) =>
      p.id === id
        ? { ...p, filters: { ...currentFilters }, createdAt: new Date().toISOString() }
        : p
    ));
  }, [presets, currentFilters, persistPresets]);

  const canSaveCurrentFilters = hasActiveFilters(currentFilters);
  const activePreset = activePresetId ? presets.find((p) => p.id === activePresetId) : null;

  return (
    <div className="contents">
      <div className="flex items-center gap-2">
        {/* Preset selector dropdown */}
        {presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs gap-1.5 ${activePreset ? 'border-purple-300 bg-purple-50 text-purple-700' : ''}`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${activePreset ? 'fill-purple-500 text-purple-500' : ''}`} />
                {activePreset ? activePreset.name : 'Presets'}
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {/* Clear preset */}
              {activePreset && (
                <div className="contents">
                  <DropdownMenuItem
                    onClick={() => setActivePresetId(null)}
                    className="text-xs text-gray-500"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Clear active preset
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
              )}

              {presets.map((preset) => (
                <div key={preset.id} className="contents">
                  {editingPresetId === preset.id ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenamePreset(preset.id);
                          if (e.key === 'Escape') { setEditingPresetId(null); setEditingName(''); }
                        }}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleRenamePreset(preset.id)}
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => { setEditingPresetId(null); setEditingName(''); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => handleApplyPreset(preset)}
                      className="text-xs flex items-start gap-2 py-2"
                    >
                      <Bookmark className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                        activePresetId === preset.id ? 'fill-purple-500 text-purple-500' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{preset.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {describeFilters(preset.filters)}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPresetId(preset.id);
                            setEditingName(preset.name);
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdatePreset(preset.id);
                          }}
                          className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                          title="Update with current filters"
                        >
                          <FolderHeart className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePreset(preset.id);
                          }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </DropdownMenuItem>
                  )}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Save current filters button */}
        {canSaveCurrentFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-gray-500 hover:text-purple-700"
            onClick={() => { setSavePresetName(''); setShowSaveDialog(true); }}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save Preset
          </Button>
        )}
      </div>

      {/* Save preset dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-base font-semibold">Save Filter Preset</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Save your current filter combination for quick access later.
          </p>
          <div className="mt-3 space-y-3">
            <Input
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
              placeholder="e.g. Client meeting notes"
              className="h-9 text-sm"
              autoFocus
            />
            <div className="text-xs text-gray-400">
              Filters: {describeFilters(currentFilters)}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleSavePreset}
                disabled={!savePresetName.trim()}
              >
                <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                Save Preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}