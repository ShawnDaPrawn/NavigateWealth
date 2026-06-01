import { Card } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Search, Filter, X } from 'lucide-react';
import type { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

interface DocumentFiltersBarProps {
  searchInputGuard: ReturnType<typeof useSearchInputAutofillGuard>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
  filterDateStart: string;
  setFilterDateStart: (value: string) => void;
  filterDateEnd: string;
  setFilterDateEnd: (value: string) => void;
}

/** Search + category + date-range filter bar for DocumentsTab. */
export function DocumentFiltersBar({
  searchInputGuard,
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  filterDateStart,
  setFilterDateStart,
  filterDateEnd,
  setFilterDateEnd,
}: DocumentFiltersBarProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            {...searchInputGuard}
            placeholder="Search by title, filename, or policy..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="w-full md:w-[200px]">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Life">Life Insurance</SelectItem>
              <SelectItem value="Short-Term">Short-Term</SelectItem>
              <SelectItem value="Investment">Investment</SelectItem>
              <SelectItem value="Medical Aid">Medical Aid</SelectItem>
              <SelectItem value="Retirement">Retirement</SelectItem>
              <SelectItem value="Estate">Estate Planning</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              type="date"
              className="w-[140px]"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              title="Start Date"
            />
          </div>
          <span className="text-muted-foreground">-</span>
          <div className="relative">
            <Input
              type="date"
              className="w-[140px]"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              title="End Date"
            />
          </div>
        </div>

        {(filterCategory !== 'All' || filterDateStart || filterDateEnd) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterCategory('All');
              setFilterDateStart('');
              setFilterDateEnd('');
            }}
            className="px-2"
            title="Clear Filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
