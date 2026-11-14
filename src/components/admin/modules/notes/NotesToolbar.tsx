/**
 * The notes toolbar (design system: list toolbar): search, filter chips
 * (Client, Colour, Tag), the Presets menu, Sort, the Grid | List segmented
 * control and Colour labels.
 */
import React from 'react';
import { ArrowUpDown, Check, ChevronDown, Palette, Plus, Search, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Tabs } from '../../../ui/tabs';
import { cn } from '../../../ui/utils';
import { SegmentedList, SegmentedTrigger } from '../../layout/page';
import { ClearFiltersButton, FilterChip } from '../../layout/page/FilterControls';
import type { NoteColor, NoteSortBy, NoteViewMode } from './types';
import { NOTE_COLORS, NOTE_SORT_OPTIONS } from './constants';
import { FilterPresetBar, type CurrentFilterState } from './components/FilterPresetBar';
import type { UseColourLabelsReturn } from './hooks';

interface NotesToolbarProps {
  search: string;
  setSearch: (next: string) => void;
  searchPlaceholder?: string;
  sortBy: NoteSortBy;
  setSortBy: React.Dispatch<React.SetStateAction<NoteSortBy>>;
  colorFilter: NoteColor | 'all';
  setColorFilter: React.Dispatch<React.SetStateAction<NoteColor | 'all'>>;
  clientFilter: string;
  setClientFilter: React.Dispatch<React.SetStateAction<string>>;
  viewMode: NoteViewMode;
  setViewMode: (next: NoteViewMode) => void;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  setColourLabelsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colourLabels: UseColourLabelsReturn;
  allTags: string[];
  linkedClients: { id: string; name: string }[];
  filtersActive: boolean;
  currentFilters: CurrentFilterState;
  personnelId: string;
  handleToggleTag: (tag: string) => void;
  handleClearFilters: () => void;
  handleApplyPreset: (filters: CurrentFilterState) => void;
}

const UNLINKED = '__unlinked__';

/** Tag filter: a chip that takes several tags (a note must carry all of them). */
function TagChip({
  allTags,
  selectedTags,
  onToggle,
  onClear,
}: {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const active = selectedTags.length > 0;
  const label = active
    ? selectedTags.length === 1
      ? `Tag: ${selectedTags[0]}`
      : `Tags: ${selectedTags.length}`
    : 'Tag';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={active ? label : 'Filter by tag'}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
            'focus-visible:ring-2 focus-visible:ring-nw-violet/60 focus-visible:outline-none',
            active
              ? 'border-nw-violet bg-nw-violet text-white hover:bg-nw-violet-hover'
              : 'border-dashed border-gray-400 bg-white text-nw-text-2 hover:text-nw-ink',
          )}
        >
          {active ? (
            <>
              {label}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Tag
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-44 overflow-y-auto">
        {allTags.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-nw-text-3">No tags on your notes yet.</p>
        ) : (
          allTags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag}
              checked={selectedTags.includes(tag)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onToggle(tag)}
            >
              {tag}
            </DropdownMenuCheckboxItem>
          ))
        )}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClear} className="text-xs text-nw-text-2">
              <X className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Clear tags
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotesToolbar({
  search,
  setSearch,
  searchPlaceholder = 'Search notes…',
  sortBy,
  setSortBy,
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
  filtersActive,
  currentFilters,
  personnelId,
  handleToggleTag,
  handleClearFilters,
  handleApplyPreset,
}: NotesToolbarProps) {
  const sortLabel = NOTE_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Last updated';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          aria-label="Search notes"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 bg-white pl-9 text-sm"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch('')}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <FilterChip
        label="Client"
        value={clientFilter}
        allValue="all"
        allLabel="All clients"
        onChange={setClientFilter}
        options={[
          { value: UNLINKED, label: 'No client' },
          ...linkedClients.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <FilterChip
        label="Colour"
        value={colorFilter}
        allValue="all"
        allLabel="All colours"
        onChange={(v) => setColorFilter(v as NoteColor | 'all')}
        options={NOTE_COLORS.map((c) => ({ value: c, label: colourLabels.getLabel(c) }))}
      />
      <TagChip
        allTags={allTags}
        selectedTags={selectedTags}
        onToggle={handleToggleTag}
        onClear={() => setSelectedTags([])}
      />
      {filtersActive && <ClearFiltersButton onClick={handleClearFilters} />}

      <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
        <FilterPresetBar
          personnelId={personnelId}
          currentFilters={currentFilters}
          onApplyPreset={handleApplyPreset}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[13px] text-nw-text-2">
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
              Sort: {sortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {NOTE_SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setSortBy(opt.value)}
                className="flex items-center gap-2"
              >
                <Check
                  className={cn('h-3.5 w-3.5', opt.value === sortBy ? 'opacity-100' : 'opacity-0')}
                  aria-hidden="true"
                />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as NoteViewMode)}>
          <SegmentedList aria-label="Layout">
            <SegmentedTrigger value="grid">Grid</SegmentedTrigger>
            <SegmentedTrigger value="list">List</SegmentedTrigger>
          </SegmentedList>
        </Tabs>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-[13px] text-nw-text-2"
          onClick={() => setColourLabelsOpen(true)}
          aria-label="Customise colour labels"
        >
          <Palette className="h-3.5 w-3.5" aria-hidden="true" />
          Colour labels
        </Button>
      </div>
    </div>
  );
}
