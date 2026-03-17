/**
 * SearchFilters Component
 * Consolidated search and filter controls
 */

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { ProductKeyCategory } from '../types';
import { KeyAPI } from '../api';

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: ProductKeyCategory | 'all';
  onCategoryChange: (value: ProductKeyCategory | 'all') => void;
  selectedDataType: string;
  onDataTypeChange: (value: string) => void;
  showCategoryFilter?: boolean;
  showDataTypeFilter?: boolean;
  className?: string;
}

export function SearchFilters({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedDataType,
  onDataTypeChange,
  showCategoryFilter = true,
  showDataTypeFilter = true,
  className = ''
}: SearchFiltersProps) {
  const dataTypes = KeyAPI.getDataTypes();

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {/* Search Input */}
      <div className="md:col-span-1">
        <Label className="text-sm font-medium text-muted-foreground">SEARCH</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or description..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
      </div>

      {/* Category Filter */}
      {showCategoryFilter && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">CATEGORY</Label>
          <Select 
            value={selectedCategory} 
            onValueChange={(value) => onCategoryChange(value as ProductKeyCategory | 'all')}
          >
            <SelectTrigger className="h-11 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {KeyAPI.KEY_CATEGORIES.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Data Type Filter */}
      {showDataTypeFilter && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">DATA TYPE</Label>
          <Select 
            value={selectedDataType} 
            onValueChange={onDataTypeChange}
          >
            <SelectTrigger className="h-11 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {dataTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
