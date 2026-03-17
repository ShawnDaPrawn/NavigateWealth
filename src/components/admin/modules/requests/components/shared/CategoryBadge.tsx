import React from 'react';
import { RequestCategory } from '../../types';

interface CategoryBadgeProps {
  category: RequestCategory;
  size?: 'sm' | 'md';
}

const categoryColors: Record<RequestCategory, string> = {
  [RequestCategory.RISK]: 'bg-red-100 text-red-700',
  [RequestCategory.RETIREMENT]: 'bg-blue-100 text-blue-700',
  [RequestCategory.MEDICAL_AID]: 'bg-green-100 text-green-700',
  [RequestCategory.INVESTMENT_PLANNING]: 'bg-purple-100 text-purple-700',
  [RequestCategory.ESTATE_PLANNING]: 'bg-amber-100 text-amber-700',
  [RequestCategory.TAX_PLANNING]: 'bg-indigo-100 text-indigo-700',
  [RequestCategory.GENERAL]: 'bg-slate-100 text-slate-700',
  [RequestCategory.LEGAL_COMPLIANCE]: 'bg-orange-100 text-orange-700',
};

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-full ${sizeClasses} ${categoryColors[category]}`}>
      {category}
    </span>
  );
}
