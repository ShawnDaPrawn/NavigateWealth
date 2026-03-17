/**
 * CategoryFilter Component
 * Reusable category filter badge UI used across all tabs
 */

import React from 'react';
import { Badge } from '../../../../../ui/badge';
import { Label } from '../../../../../ui/label';
import { ProductKey, ProductKeyCategory } from '../types';
import { KeyAPI } from '../api';
import { CATEGORY_ICONS } from '../constants';

interface CategoryFilterProps {
  keys: ProductKey[];
  selectedCategory: ProductKeyCategory | 'all';
  onCategoryChange: (category: ProductKeyCategory | 'all') => void;
  filterType?: 'profile' | 'product' | 'all';
  label?: string;
  showIcons?: boolean;
  className?: string;
}

export function CategoryFilter({
  keys,
  selectedCategory,
  onCategoryChange,
  filterType = 'all',
  label = 'FILTER BY CATEGORY',
  showIcons = true,
  className = ''
}: CategoryFilterProps) {
  // Get categories to display based on filter type
  const categoriesToShow = React.useMemo(() => {
    return KeyAPI.KEY_CATEGORIES.filter(category => {
      if (filterType === 'profile') {
        return category.id.startsWith('profile_');
      } else if (filterType === 'product') {
        return !category.id.startsWith('profile_');
      }
      return true; // 'all' shows everything
    });
  }, [filterType]);

  // Count keys per category
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    categoriesToShow.forEach(category => {
      counts[category.id] = keys.filter(k => k.category === category.id).length;
    });
    return counts;
  }, [keys, categoriesToShow]);

  // Total count for "All" badge
  const totalCount = keys.length;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-sm font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="flex flex-wrap gap-2">
        {/* All Categories Badge */}
        <Badge
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          className="cursor-pointer px-3 py-1.5 text-sm"
          onClick={() => onCategoryChange('all')}
        >
          All ({totalCount})
        </Badge>

        {/* Individual Category Badges */}
        {categoriesToShow.map((category) => {
          const count = categoryCounts[category.id] || 0;
          
          // Don't show categories with 0 keys
          if (count === 0) return null;
          
          const Icon = CATEGORY_ICONS[category.id];
          
          return (
            <Badge
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5 text-sm flex items-center gap-1.5"
              onClick={() => onCategoryChange(category.id)}
            >
              {showIcons && Icon && <Icon className="w-3.5 h-3.5" />}
              {category.name} ({count})
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
