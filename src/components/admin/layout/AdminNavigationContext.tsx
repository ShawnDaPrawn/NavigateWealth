/**
 * Admin Navigation Context
 *
 * Provides a cross-module navigation mechanism for the admin panel.
 * Used by GlobalSearch to navigate directly to a specific account
 * in the Clients or Personnel module (and future account types).
 *
 * Guidelines §11.1 — Local UI state kept close to where it's used.
 * Guidelines §7   — No business logic in context; pure navigation coordination.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { AdminModule } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type AccountType = 'client' | 'personnel';

export interface PendingSelection {
  /** Which account type to navigate to */
  type: AccountType;
  /** The account's canonical ID */
  id: string;
}

interface AdminNavigationContextValue {
  /** Selection waiting to be consumed by the target module */
  pendingSelection: PendingSelection | null;
  /**
   * Navigate to a specific account.
   * Sets the pending selection and switches to the appropriate module.
   */
  navigateToAccount: (type: AccountType, id: string) => void;
  /** Called by the target module once it has handled the selection */
  clearPendingSelection: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AdminNavigationContext = createContext<AdminNavigationContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

const ACCOUNT_TYPE_TO_MODULE: Record<AccountType, AdminModule> = {
  client: 'clients',
  personnel: 'personnel',
};

interface AdminNavigationProviderProps {
  onModuleChange: (module: AdminModule) => void;
  children: React.ReactNode;
}

export function AdminNavigationProvider({
  onModuleChange,
  children,
}: AdminNavigationProviderProps) {
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);

  const navigateToAccount = useCallback(
    (type: AccountType, id: string) => {
      setPendingSelection({ type, id });
      onModuleChange(ACCOUNT_TYPE_TO_MODULE[type]);
    },
    [onModuleChange],
  );

  const clearPendingSelection = useCallback(() => {
    setPendingSelection(null);
  }, []);

  return (
    <AdminNavigationContext.Provider
      value={{ pendingSelection, navigateToAccount, clearPendingSelection }}
    >
      {children}
    </AdminNavigationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access the admin navigation context.
 * Must be called inside <AdminNavigationProvider>.
 */
export function useAdminNavigation(): AdminNavigationContextValue {
  const ctx = useContext(AdminNavigationContext);
  if (!ctx) {
    throw new Error('useAdminNavigation must be used within AdminNavigationProvider');
  }
  return ctx;
}
