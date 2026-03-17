// Authentication Context - Global auth state management

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  AppUser, 
  signOut as authSignOut,
  onAuthStateChange,
} from '../../utils/auth';
import { loadUserProfile, updateUserProfile } from '../../utils/auth/profileService';
import { broadcastLogout, onLogoutBroadcast, broadcastNavigate } from '../../utils/auth/sessionSync';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../utils/api/client';
import { toast } from 'sonner@2.0.3';

// Context Type Definition
interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  updateUser: (userData: Partial<AppUser>) => Promise<void>;
  completeApplication: (data?: { accountStatus?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// WORKAROUND: Persist context reference across HMR module re-evaluations.
// In Figma Make's environment, HMR re-evaluates this module, creating a new
// createContext() reference. Components still mounted with the old reference
// can't find the new provider (React matches contexts by object identity).
// Storing the context on globalThis ensures the same object is reused.
// Proper fix: framework-level HMR boundary that preserves module-level state.
// Searchable tag: // WORKAROUND: HMR-stable-auth-context
const CONTEXT_GLOBAL_KEY = '__navigate_wealth_auth_context__';
const _global = globalThis as unknown as Record<string, unknown>;
if (!_global[CONTEXT_GLOBAL_KEY]) {
  _global[CONTEXT_GLOBAL_KEY] = createContext<AuthContextType | undefined>(undefined);
}
const AuthContext = _global[CONTEXT_GLOBAL_KEY] as React.Context<AuthContextType | undefined>;

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guard flag: prevents refreshUser / onAuthStateChange from re-setting user after logout
  const logoutGuardRef = React.useRef(false);
  const currentAuthUserRef = React.useRef<string | null>(null);

  // Initialize auth state listener
  useEffect(() => {
    console.log('🔐 Initializing auth state listener...');
    
    const subscription = onAuthStateChange(async (authUser) => {
      currentAuthUserRef.current = authUser?.id || null;
      
      try {
        if (authUser) {
          // If we're in the middle of a logout, ignore stale auth events
          if (logoutGuardRef.current) {
            console.log('⚠️ Auth event ignored — logout in progress');
            return;
          }
          console.log('✅ Auth user detected, loading profile...');
          
          // Load full user profile from database
          // This function has its own error handling/fallback, but we wrap it just in case
          const userData = await loadUserProfile(authUser.id, authUser.email);
          
          // If the latest auth event is no longer for this user, discard the profile
          if (currentAuthUserRef.current !== authUser.id) {
            console.log('⚠️ Discarding stale profile load (auth state changed)');
            return;
          }
          
          setUser(userData);
          
          console.log(`👤 User loaded with role: ${userData.role}`);
        } else {
          console.log('❌ No auth user');
          setUser(null);
          // Logout is complete — reset the guard so the next sign-in is processed
          logoutGuardRef.current = false;
        }
      } catch (error) {
        console.error('❌ Critical auth initialization error:', error);
        // Fallback: clear user to force login or allow public access, but stop loading
        setUser(null); 
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for logout events from other tabs
  useEffect(() => {
    console.log('🔗 Setting up cross-tab session sync...');
    
    const unsubscribe = onLogoutBroadcast(async () => {
      console.log('📡 Logout broadcast received from another tab');
      
      // Sign out in this tab without broadcasting again (to prevent infinite loop)
      try {
        logoutGuardRef.current = true;
        await authSignOut();
        setUser(null);
        console.log('✅ Synced logout from other tab');
      } catch (error) {
        console.error('❌ Error syncing logout:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for session-expired events from the API client.
  // When getAuthToken() detects the Supabase session is irrecoverably dead
  // (getSession + refreshSession both fail), it dispatches this event so we
  // can clear the stale user state and stop firing authenticated queries.
  useEffect(() => {
    const handleSessionExpired = () => {
      // Only act if we currently think the user is logged in
      if (!logoutGuardRef.current && user) {
        console.warn('⚠️ Session expired event received — clearing stale auth state');
        logoutGuardRef.current = true;
        setUser(null);

        // Notify the user with a toast
        toast.error('Your session has expired. Please sign in again to continue.', {
          duration: 5000,
          id: 'session-expired', // Prevent duplicate toasts
        });

        // Attempt a clean sign-out (non-blocking) to clear Supabase local storage
        authSignOut().catch(() => {}).finally(() => {
          broadcastLogout();
          logoutGuardRef.current = false;

          // Redirect to login after a brief delay so the toast is visible.
          // Uses window.location (full navigation) to clear any stale in-memory state.
          // Includes returnUrl so users return to their previous page after re-auth.
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              const currentPath = window.location.pathname + window.location.search;
              const returnUrl = encodeURIComponent(currentPath);
              window.location.href = `/login?returnUrl=${returnUrl}`;
            }
          }, 1500);
        });
      }
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [user]);

  // Update user data (local state + database)
  const updateUser = async (userData: Partial<AppUser>): Promise<void> => {
    if (!user) return;

    try {
      // Update local state immediately for better UX
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      
      console.log('📝 Updating user profile:', {
        userId: user.id,
        updates: userData
      });

      // Filter out undefined values to prevent overwriting existing KV data with undefined
      const cleanUpdates: Partial<Record<string, unknown>> = {};
      if (userData.role !== undefined) cleanUpdates.role = userData.role;
      if (userData.accountType !== undefined) cleanUpdates.accountType = userData.accountType;
      if (userData.accountStatus !== undefined) cleanUpdates.accountStatus = userData.accountStatus;
      if (userData.applicationStatus !== undefined) cleanUpdates.applicationStatus = userData.applicationStatus;
      if (userData.adviserAssigned !== undefined) cleanUpdates.adviserAssigned = userData.adviserAssigned;
      if (userData.firstName !== undefined) {
        cleanUpdates.firstName = userData.firstName;
        cleanUpdates.personalInformation = {
          firstName: userData.firstName,
          lastName: userData.lastName,
        };
      }
      if (userData.lastName !== undefined) {
        cleanUpdates.lastName = userData.lastName;
        cleanUpdates.personalInformation = {
          firstName: userData.firstName || user.firstName,
          lastName: userData.lastName,
        };
      }

      // Update database with only defined fields
      await updateUserProfile(user.id, cleanUpdates);

      console.log('✅ User updated successfully');
    } catch (error) {
      console.error('❌ Failed to update user:', error);
      // Revert local state on error
      setUser(user);
      throw error;
    }
  };

  // Complete application (approve user or update status)
  const completeApplication = async (data?: { accountStatus?: string }): Promise<void> => {
    if (!user) return;

    await updateUser({
      accountStatus: data?.accountStatus || 'approved',
      adviserAssigned: !data?.accountStatus || data.accountStatus === 'approved',
    });
  };

  // Logout user
  const logout = async (): Promise<void> => {
    try {
      // Set guard BEFORE signOut to prevent any in-flight refreshUser calls
      // from re-setting the user after we clear it
      logoutGuardRef.current = true;

      await authSignOut();
      console.log('✅ Logout successful on backend');
    } catch (error) {
      // Even on error (e.g. session already expired on backend), 
      // we MUST clear local state to prevent zombie authenticated sessions.
      console.error('❌ Backend logout error (proceeding with local logout):', error);
    } finally {
      setUser(null);
      console.log('✅ Local logout successful');
      broadcastLogout();
    }
  };

  // Refresh user data from database
  const refreshUser = async (): Promise<void> => {
    if (!user) return;
    // If logout is in progress, bail out to avoid re-setting the user
    if (logoutGuardRef.current) return;

    try {
      const userData = await loadUserProfile(user.id, user.email);
      // Double-check guard after the async gap — logout may have started while we waited
      if (logoutGuardRef.current) return;
      setUser(userData);
      console.log('✅ User data refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh user:', error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    updateUser,
    completeApplication,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom Hook to use Auth Context
// Returns a safe default during HMR context resets to prevent crash loops
const AUTH_DEFAULT: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  updateUser: async () => {},
  completeApplication: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    // During HMR, the context reference may temporarily be stale.
    // Return a safe default instead of throwing to prevent crash loops.
    console.warn('⚠️ useAuth: AuthContext unavailable (likely HMR reset). Returning safe default.');
    return AUTH_DEFAULT;
  }
  
  return context;
}