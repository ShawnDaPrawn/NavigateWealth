/**
 * Filter bar of the resources Forms tab: search, category, client type,
 * status, and the select-mode toggle. Pure view over props from
 * ResourcesModule.
 */
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Search, CheckSquare, Square } from 'lucide-react';

// Module imports

// Phase 1 — Form status config

// ---------------------------------------------------------------------------
// Heavy sub-components — lazy-loaded to reduce initial chunk size.
// These are only rendered on user action (edit, preview, tab switch).

import type { Dispatch, SetStateAction } from 'react';
import type { FormFilters } from '../types';

interface FormsFilterBarProps {
  categories: string[];
  clientTypes: string[];
  filters: FormFilters;
  updateFilters: (newFilters: Partial<FormFilters>) => void;
  isSelectMode: boolean;
  setIsSelectMode: Dispatch<SetStateAction<boolean>>;
  setSelectedFormIds: Dispatch<SetStateAction<Set<string>>>;
}

export function FormsFilterBar({
  categories,
  clientTypes,
  filters,
  updateFilters,
  isSelectMode,
  setIsSelectMode,
  setSelectedFormIds,
}: FormsFilterBarProps) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-end gap-4">
          {/* Search */}
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Search
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search forms by name or description..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-10 h-10"
              />
            </div>
          </div>

          {/* Category */}
          <div className="w-44">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Category
            </Label>
            <Select
              value={filters.category}
              onValueChange={(value) => updateFilters({ category: value })}
            >
              <SelectTrigger className="h-10 mt-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Type */}
          <div className="w-40">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Client Type
            </Label>
            <Select
              value={filters.clientType}
              onValueChange={(value) => updateFilters({ clientType: value })}
            >
              <SelectTrigger className="h-10 mt-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {clientTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase 1: Status Filter */}
          <div className="w-36">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => updateFilters({ status: value })}
            >
              <SelectTrigger className="h-10 mt-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Draft
                  </span>
                </SelectItem>
                <SelectItem value="published">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                    Published
                  </span>
                </SelectItem>
                <SelectItem value="archived">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                    Archived
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select mode toggle */}
          <Button
            variant={isSelectMode ? 'default' : 'outline'}
            size="sm"
            className="h-10 shrink-0"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedFormIds(new Set());
            }}
          >
            {isSelectMode ? (
              <CheckSquare className="h-4 w-4 mr-1.5" />
            ) : (
              <Square className="h-4 w-4 mr-1.5" />
            )}
            {isSelectMode ? 'Done' : 'Select'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
