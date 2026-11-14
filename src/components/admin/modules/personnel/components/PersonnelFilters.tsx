import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Tabs } from '../../../../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Search, X } from 'lucide-react';
import { SegmentedList, SegmentedTrigger } from '../../../layout/page';
import type { PersonnelStatus } from '../types';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

interface PersonnelFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  statusFilter: PersonnelStatus | 'all';
  onStatusChange: (value: PersonnelStatus | 'all') => void;
  /** Resets search, role and status together. */
  onClearFilters: () => void;
  roles: Record<string, { label: string }>;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { value: PersonnelStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
];

/** Toolbar above the staff list: search, status (segmented) and role. */
export function PersonnelFilters({
  searchTerm,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  onClearFilters,
  roles,
  totalCount,
  filteredCount,
}: PersonnelFiltersProps) {
  const searchInputGuard = useSearchInputAutofillGuard({ id: 'personnel-filters-search' });
  const hasActiveFilters = searchTerm !== '' || activeCategory !== 'all' || statusFilter !== 'all';
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="flex flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative w-full flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          {...searchInputGuard}
          placeholder="Search by name, email or title…"
          aria-label="Search personnel"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 border-gray-200 bg-white pl-9 text-sm"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Status */}
      <Tabs
        value={statusFilter}
        onValueChange={(val) => onStatusChange(val as PersonnelStatus | 'all')}
      >
        <SegmentedList aria-label="Status">
          {STATUS_OPTIONS.map((opt) => (
            <SegmentedTrigger key={opt.value} value={opt.value}>
              {opt.label}
            </SegmentedTrigger>
          ))}
        </SegmentedList>
      </Tabs>

      {/* Role */}
      <Select value={activeCategory} onValueChange={onCategoryChange}>
        <SelectTrigger
          className="h-9 w-full border-gray-200 bg-white text-sm sm:w-[190px]"
          aria-label="Role"
        >
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          {Object.entries(roles).map(([key, val]) => (
            <SelectItem key={key} value={key}>
              {val.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 flex-shrink-0 gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground"
          onClick={onClearFilters}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </Button>
      )}

      {isFiltered && (
        <span className="ml-auto hidden text-xs whitespace-nowrap text-muted-foreground sm:block">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
