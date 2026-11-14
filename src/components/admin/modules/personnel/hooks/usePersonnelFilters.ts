import { useCallback, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useUrlState } from '../../../layout/page';
import { ROLE_LABELS } from '../constants';
import { Personnel, PersonnelStatus } from '../types';

export const PERSONNEL_STATUS_FILTERS = ['all', 'active', 'suspended', 'pending'] as const;
export type PersonnelStatusFilter = (typeof PERSONNEL_STATUS_FILTERS)[number];

const ROLE_FILTERS = ['all', ...Object.keys(ROLE_LABELS)] as const;

/**
 * Search, role and status filters for the staff list. Role and status are in
 * the address (?status=suspended&role=adviser) so a reload or a pasted link
 * lands on the same list.
 */
export function usePersonnelFilters(personnel: Personnel[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useUrlState<string>('role', 'all', ROLE_FILTERS);
  const [statusFilter, setStatusFilter] = useUrlState<PersonnelStatus | 'all'>(
    'status',
    'all',
    PERSONNEL_STATUS_FILTERS,
  );

  const [, setSearchParams] = useSearchParams();

  // One address change for both URL filters: two setters in the same event
  // would each start from the same address and the second would undo the first.
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete('role');
        params.delete('status');
        return params;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const filteredPersonnel = useMemo(() => {
    let filtered = personnel;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((p) => p.role === activeCategory);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(searchLower) ||
          (p.firstName || '').toLowerCase().includes(searchLower) ||
          (p.lastName || '').toLowerCase().includes(searchLower) ||
          (p.email || '').toLowerCase().includes(searchLower) ||
          (p.jobTitle || '').toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [personnel, activeCategory, statusFilter, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    statusFilter,
    setStatusFilter,
    clearFilters,
    filteredPersonnel,
  };
}
