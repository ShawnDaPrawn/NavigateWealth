import { useState, useMemo } from 'react';
import { Personnel, PersonnelStatus } from '../types';

export function usePersonnelFilters(personnel: Personnel[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PersonnelStatus | 'all'>('all');

  const filteredPersonnel = useMemo(() => {
    let filtered = personnel;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.role === activeCategory);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(searchLower) ||
        (p.firstName || '').toLowerCase().includes(searchLower) ||
        (p.lastName || '').toLowerCase().includes(searchLower) ||
        (p.email || '').toLowerCase().includes(searchLower) ||
        (p.jobTitle || '').toLowerCase().includes(searchLower)
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
    filteredPersonnel,
  };
}
