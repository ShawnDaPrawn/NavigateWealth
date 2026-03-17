import React from 'react';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Badge } from '../../../../ui/badge';
import { Search, X } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { PersonnelStatus } from '../types';

interface PersonnelFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  statusFilter: PersonnelStatus | 'all';
  onStatusChange: (value: PersonnelStatus | 'all') => void;
  roles: Record<string, { label: string }>;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { value: PersonnelStatus | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active', dot: 'bg-green-500' },
  { value: 'suspended', label: 'Suspended', dot: 'bg-red-500' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
];

export function PersonnelFilters({
  searchTerm,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  roles,
  totalCount,
  filteredCount,
}: PersonnelFiltersProps) {
  const hasActiveFilters =
    searchTerm !== '' || activeCategory !== 'all' || statusFilter !== 'all';
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, or title..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-gray-200"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <Select value={activeCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm bg-white border-gray-200">
            <SelectValue placeholder="Filter by Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(roles).map(([key, val]) => (
              <SelectItem key={key} value={key}>
                {val.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(val) => onStatusChange(val as PersonnelStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-white border-gray-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.dot && (
                    <span className={cn('h-2 w-2 rounded-full', opt.dot)} />
                  )}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground gap-1.5 flex-shrink-0"
            onClick={() => {
              onSearchChange('');
              onCategoryChange('all');
              onStatusChange('all');
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Result count */}
        {isFiltered && (
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto hidden sm:block">
            Showing {filteredCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}
