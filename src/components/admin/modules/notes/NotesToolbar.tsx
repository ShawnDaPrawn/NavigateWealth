/**
 * The notes toolbar: search, sort, archive/colour/client filters, view
 * toggle, result count, saved presets, and the tag bar. JSX moved verbatim
 * from NotesModule.tsx; every captured name became a prop.
 */
import React from 'react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { ArrowUpDown, LayoutGrid, List, Palette, Search, Tag, User, X } from 'lucide-react';
import type { Note, NoteArchiveFilter, NoteColor, NoteSortBy, NoteViewMode } from './types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS, NOTE_SORT_OPTIONS } from './constants';
import { FilterPresetBar, type CurrentFilterState } from './components/FilterPresetBar';
import type { UseColourLabelsReturn } from './hooks';

interface NotesToolbarProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  sortBy: NoteSortBy;
  setSortBy: React.Dispatch<React.SetStateAction<NoteSortBy>>;
  archiveFilter: NoteArchiveFilter;
  setArchiveFilter: React.Dispatch<React.SetStateAction<NoteArchiveFilter>>;
  colorFilter: NoteColor | 'all';
  setColorFilter: React.Dispatch<React.SetStateAction<NoteColor | 'all'>>;
  clientFilter: string;
  setClientFilter: React.Dispatch<React.SetStateAction<string>>;
  viewMode: NoteViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<NoteViewMode>>;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  setColourLabelsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colourLabels: UseColourLabelsReturn;
  allTags: string[];
  linkedClients: { id: string; name: string }[];
  filteredNotes: Note[];
  activeFilterCount: number;
  currentFilters: CurrentFilterState;
  personnelId: string;
  handleToggleTag: (tag: string) => void;
  handleClearFilters: () => void;
  handleApplyPreset: (filters: CurrentFilterState) => void;
}

export function NotesToolbar({
  search,
  setSearch,
  sortBy,
  setSortBy,
  archiveFilter,
  setArchiveFilter,
  colorFilter,
  setColorFilter,
  clientFilter,
  setClientFilter,
  viewMode,
  setViewMode,
  selectedTags,
  setSelectedTags,
  setColourLabelsOpen,
  colourLabels,
  allTags,
  linkedClients,
  filteredNotes,
  activeFilterCount,
  currentFilters,
  personnelId,
  handleToggleTag,
  handleClearFilters,
  handleApplyPreset,
}: NotesToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Primary toolbar row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as NoteSortBy)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {NOTE_SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Archive filter */}
        <Select
          value={archiveFilter}
          onValueChange={(v) => setArchiveFilter(v as NoteArchiveFilter)}
        >
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        {/* Colour filter */}
        <div className="flex items-center gap-1">
          <Select value={colorFilter} onValueChange={(v) => setColorFilter(v as NoteColor | 'all')}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="All colours" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colours</SelectItem>
              {NOTE_COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${NOTE_COLOR_CONFIG[c].dot}`} />
                    {colourLabels.getLabel(c)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-gray-400 hover:text-purple-600"
            onClick={() => setColourLabelsOpen(true)}
            title="Customise colour labels"
          >
            <Palette className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Client filter */}
        {linkedClients.length > 0 && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <SelectValue placeholder="All Clients" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="__unlinked__">Unlinked</SelectItem>
              {linkedClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className={`h-8 px-2.5 rounded-r-none ${viewMode === 'grid' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className={`h-8 px-2.5 rounded-l-none ${viewMode === 'list' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Result count & clear filters */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          </Badge>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={handleClearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear filters ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Saved presets + tag bar row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Saved filter presets */}
        <FilterPresetBar
          personnelId={personnelId}
          currentFilters={currentFilters}
          onApplyPreset={handleApplyPreset}
        />

        {/* Tag bar — only shown when tags exist */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {allTags.map((tag) => {
              const isActive = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    isActive
                      ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                  {isActive && <X className="h-3 w-3 ml-0.5" />}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
              >
                Clear tags
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
