/**
 * Tests for usePersonnelFilters hook.
 *
 * This is a pure-logic hook that only uses React state/memo — no external
 * dependencies to mock.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonnelFilters } from '../usePersonnelFilters';
import type { Personnel, PersonnelStatus, UserRole } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0;

function makePersonnel(overrides: Partial<Personnel> = {}): Personnel {
  const id = `p-${++_idCounter}`;
  return {
    id,
    name: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    email: `jane.doe.${id}@example.com`,
    role: 'adviser' as UserRole,
    phone: '0110000000',
    status: 'active' as PersonnelStatus,
    commissionSplit: 70,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('usePersonnelFilters — initial state', () => {
  it('initial searchTerm is empty string', () => {
    const { result } = renderHook(() => usePersonnelFilters([]));
    expect(result.current.searchTerm).toBe('');
  });

  it('initial activeCategory is "all"', () => {
    const { result } = renderHook(() => usePersonnelFilters([]));
    expect(result.current.activeCategory).toBe('all');
  });

  it('initial statusFilter is "all"', () => {
    const { result } = renderHook(() => usePersonnelFilters([]));
    expect(result.current.statusFilter).toBe('all');
  });

  it('filteredPersonnel equals all personnel when no filters are set', () => {
    const people = [makePersonnel(), makePersonnel()];
    const { result } = renderHook(() => usePersonnelFilters(people));
    expect(result.current.filteredPersonnel).toHaveLength(2);
  });
});

describe('usePersonnelFilters — category filter', () => {
  it('filters by role when activeCategory is set', () => {
    const adviser = makePersonnel({ role: 'adviser' });
    const admin = makePersonnel({ role: 'admin' });
    const { result } = renderHook(() => usePersonnelFilters([adviser, admin]));

    act(() => {
      result.current.setActiveCategory('adviser');
    });

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(adviser.id);
  });

  it('shows all when activeCategory is reset to "all"', () => {
    const people = [makePersonnel({ role: 'adviser' }), makePersonnel({ role: 'admin' })];
    const { result } = renderHook(() => usePersonnelFilters(people));

    act(() => result.current.setActiveCategory('adviser'));
    act(() => result.current.setActiveCategory('all'));

    expect(result.current.filteredPersonnel).toHaveLength(2);
  });
});

describe('usePersonnelFilters — status filter', () => {
  it('filters by status when statusFilter is set', () => {
    const active = makePersonnel({ status: 'active' });
    const suspended = makePersonnel({ status: 'suspended' });
    const { result } = renderHook(() => usePersonnelFilters([active, suspended]));

    act(() => {
      result.current.setStatusFilter('active');
    });

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(active.id);
  });

  it('shows all when statusFilter is reset to "all"', () => {
    const people = [makePersonnel({ status: 'active' }), makePersonnel({ status: 'suspended' })];
    const { result } = renderHook(() => usePersonnelFilters(people));

    act(() => result.current.setStatusFilter('active'));
    act(() => result.current.setStatusFilter('all'));

    expect(result.current.filteredPersonnel).toHaveLength(2);
  });
});

describe('usePersonnelFilters — search filter', () => {
  it('filters by name', () => {
    const alice = makePersonnel({ name: 'Alice Smith' });
    const bob = makePersonnel({ name: 'Bob Jones' });
    const { result } = renderHook(() => usePersonnelFilters([alice, bob]));

    act(() => result.current.setSearchTerm('alice'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(alice.id);
  });

  it('filters by firstName', () => {
    const alice = makePersonnel({ firstName: 'Alice', lastName: 'X', name: 'Alice X' });
    const bob = makePersonnel({ firstName: 'Bob', lastName: 'X', name: 'Bob X' });
    const { result } = renderHook(() => usePersonnelFilters([alice, bob]));

    act(() => result.current.setSearchTerm('Alice'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(alice.id);
  });

  it('filters by lastName', () => {
    const alice = makePersonnel({ firstName: 'A', lastName: 'Smith', name: 'A Smith' });
    const bob = makePersonnel({ firstName: 'B', lastName: 'Jones', name: 'B Jones' });
    const { result } = renderHook(() => usePersonnelFilters([alice, bob]));

    act(() => result.current.setSearchTerm('smith'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(alice.id);
  });

  it('filters by email', () => {
    const alice = makePersonnel({ email: 'alice@company.com', name: 'Alice' });
    const bob = makePersonnel({ email: 'bob@company.com', name: 'Bob' });
    const { result } = renderHook(() => usePersonnelFilters([alice, bob]));

    act(() => result.current.setSearchTerm('alice@'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(alice.id);
  });

  it('filters by jobTitle', () => {
    const analyst = makePersonnel({ jobTitle: 'Financial Analyst', name: 'Analyst Person' });
    const planner = makePersonnel({ jobTitle: 'Paraplanner', name: 'Planner Person' });
    const { result } = renderHook(() => usePersonnelFilters([analyst, planner]));

    act(() => result.current.setSearchTerm('analyst'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(analyst.id);
  });

  it('is case-insensitive', () => {
    const alice = makePersonnel({ name: 'Alice', firstName: 'Alice', lastName: 'Smith' });
    const { result } = renderHook(() => usePersonnelFilters([alice]));

    act(() => result.current.setSearchTerm('ALICE'));

    expect(result.current.filteredPersonnel).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    const people = [makePersonnel({ name: 'Alice', firstName: 'Alice' })];
    const { result } = renderHook(() => usePersonnelFilters(people));

    act(() => result.current.setSearchTerm('zzznomatch'));

    expect(result.current.filteredPersonnel).toHaveLength(0);
  });
});

describe('usePersonnelFilters — combined filters', () => {
  it('applies all three filters simultaneously', () => {
    const match = makePersonnel({
      name: 'Alice Smith',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'adviser',
      status: 'active',
    });
    const wrongRole = makePersonnel({
      name: 'Alice Admin',
      firstName: 'Alice',
      lastName: 'Admin',
      role: 'admin',
      status: 'active',
    });
    const wrongStatus = makePersonnel({
      name: 'Alice Suspended',
      firstName: 'Alice',
      lastName: 'Suspended',
      role: 'adviser',
      status: 'suspended',
    });
    const { result } = renderHook(() => usePersonnelFilters([match, wrongRole, wrongStatus]));

    act(() => {
      result.current.setActiveCategory('adviser');
      result.current.setStatusFilter('active');
      result.current.setSearchTerm('alice');
    });

    expect(result.current.filteredPersonnel).toHaveLength(1);
    expect(result.current.filteredPersonnel[0].id).toBe(match.id);
  });
});
