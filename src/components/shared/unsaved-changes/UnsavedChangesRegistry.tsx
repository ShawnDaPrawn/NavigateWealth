import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { UnsavedChangesRegistryContextValue, UnsavedChangesRegistryEntry } from './types';

const UnsavedChangesRegistryContext = createContext<UnsavedChangesRegistryContextValue | null>(null);

export function UnsavedChangesRegistryProvider({ children }: { children: React.ReactNode }) {
  const entriesRef = useRef<Map<string, UnsavedChangesRegistryEntry>>(new Map());

  const register = useCallback((entry: UnsavedChangesRegistryEntry) => {
    entriesRef.current.set(entry.id, entry);
  }, []);

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id);
  }, []);

  const getDirtyEntries = useCallback(() => {
    return Array.from(entriesRef.current.values()).filter((entry) => entry.isDirty);
  }, []);

  const tryLeaveAny = useCallback((action: () => void) => {
    const dirtyEntries = Array.from(entriesRef.current.values()).filter((entry) => entry.isDirty);
    if (dirtyEntries.length === 0) {
      action();
      return true;
    }

    dirtyEntries[0].tryAction(action);
    return false;
  }, []);

  const value = useMemo<UnsavedChangesRegistryContextValue>(
    () => ({ register, unregister, getDirtyEntries, tryLeaveAny }),
    [register, unregister, getDirtyEntries, tryLeaveAny],
  );

  return (
    <UnsavedChangesRegistryContext.Provider value={value}>
      {children}
    </UnsavedChangesRegistryContext.Provider>
  );
}

export function useUnsavedChangesRegistry() {
  const context = useContext(UnsavedChangesRegistryContext);
  if (!context) {
    throw new Error('useUnsavedChangesRegistry must be used within UnsavedChangesRegistryProvider');
  }
  return context;
}

export function useOptionalUnsavedChangesRegistry() {
  return useContext(UnsavedChangesRegistryContext);
}
