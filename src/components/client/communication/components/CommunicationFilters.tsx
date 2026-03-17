/**
 * CommunicationFilters — Search, category, and date-range filter bar.
 */

import { Search } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';
import { Input } from '../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { ALL_CATEGORIES, DATE_RANGE_OPTIONS } from '../constants';
import type { CommunicationFilters as Filters } from '../types';

interface CommunicationFiltersProps {
  filters: Filters;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
}

export function CommunicationFilters({
  filters,
  onSearchChange,
  onCategoryChange,
  onDateRangeChange,
}: CommunicationFiltersProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search communications..."
              value={filters.search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-4 h-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={filters.category} onValueChange={onCategoryChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
