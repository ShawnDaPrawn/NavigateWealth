/**
 * Filter bar of the resources Forms tab (RE-Forms): search, then the Kind,
 * Type and Status chips, and the select-mode toggle on the right. Pure view
 * over props from ResourcesModule.
 */
import type { Dispatch, SetStateAction } from 'react';
import { DsButton, DsChipSelect } from '../../../layout/page';
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

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

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
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="ds-input w-full sm:w-auto sm:min-w-[300px]"
        placeholder="Search forms by name or description…"
        aria-label="Search forms"
        value={filters.search}
        onChange={(e) => updateFilters({ search: e.target.value })}
      />
      <DsChipSelect
        label="Kind"
        anyLabel="Any kind"
        value={filters.category}
        options={categories.map((c) => ({ value: c, label: c }))}
        onChange={(category) => updateFilters({ category })}
      />
      <DsChipSelect
        label="Type"
        anyLabel="Any client type"
        value={filters.clientType}
        options={clientTypes.map((t) => ({ value: t, label: t }))}
        onChange={(clientType) => updateFilters({ clientType })}
      />
      <DsChipSelect
        label="Status"
        anyLabel="Any status"
        value={filters.status || 'all'}
        options={STATUS_OPTIONS}
        onChange={(status) => updateFilters({ status })}
      />
      <span className="grow" />
      <DsButton
        size="sm"
        variant={isSelectMode ? 'primary' : 'default'}
        aria-pressed={isSelectMode}
        onClick={() => {
          setIsSelectMode(!isSelectMode);
          if (isSelectMode) setSelectedFormIds(new Set());
        }}
      >
        {isSelectMode ? 'Done' : 'Select'}
      </DsButton>
    </div>
  );
}
