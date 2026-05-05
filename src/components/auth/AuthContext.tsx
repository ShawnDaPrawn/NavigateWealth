// Authentication Context - Global auth state management

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AppUser,
  signOut as authSignOut,
  onAuthStateChange,
  getSupabaseClient,
} from '../../utils/auth';
import {
  buildAppUserFromAuthSessionFallback,
  loadUserProfile,
  updateUserProfile,
} from '../../utils/auth/profileService';
import type { AuthUser } from '../../utils/auth/types';
import type { User as SupabaseSessionUser } from '@supabase/supabase-js@2.39.3';
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

/** Prevents infinite shell spin if KV profile never settles. Passing the session user into profile load bypasses a redundant getUser() during hydration. */
const PROFILE_HYDRATION_TIMEOUT_MS = 45_000;
const SESSION_USER_SNAPSHOT_MS = 5_000;

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(Object.assign(new Error(label), { name: 'TimeoutError' }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    );
  });
}

async function getSessionUserSnapshotForFallback() {
  try {
    const supabase = getSupabaseClient();
    const { data } = await promiseWithTimeout(
      supabase.auth.getSession(),
      SESSION_USER_SNAPSHOT_MS,
      'session_snapshot_timeout',
    );
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guard flag: prevents refreshUser / onAuthStateChange from re-setting user after logout
  const logoutGuardRef = React.useRef(false);
  const currentAuthUserRef = React.useRef<string | null>(null);

  const profileLoadedForUserRef = React.useRef<string | null>(null);
  /** One shared in-flight hydrate per user id — dedupes INITIAL_SESSION vs SIGNED_IN. */
  const profileHydrateInFlightRef = React.useRef<Map<string, Promise<void>>>(new Map());

  // Supabase client emits INITIAL_SESSION (and SIGNED_IN) via onAuthStateChange;
  // parallel getSession() bootstrap was removed — it contended with auth and produced 30s timeouts.
  useEffect(() => {
    console.log('🔐 Initializing auth state listener...');
    let cancelled = false;

    const finishLoading = () => {
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    const resolveAuthSession = async (
      authUser: AuthUser | null,
      opts?: { supabaseUser?: SupabaseSessionUser },
    ) => {
      try {
        if (cancelled) return;
        currentAuthUserRef.current = authUser?.id || null;

        if (!authUser) {
          profileHydrateInFlightRef.current.clear();
          profileLoadedForUserRef.current = null;
          console.log('❌ No auth user');
          setUser(null);
          logoutGuardRef.current = false;
          return;
        }

        if (logoutGuardRef.current) {
          console.log('⚠️ Auth event ignored — logout in progress');
          return;
        }

        if (profileLoadedForUserRef.current === authUser.id) {
          return;
        }

        let hydrate = profileHydrateInFlightRef.current.get(authUser.id);
        if (!hydrate) {
          hydrate = (async () => {
            try {
              console.log('✅ Auth user detected, loading profile...');
              let userData: AppUser;
              try {
                userData = await promiseWithTimeout(
                  loadUserProfile(authUser.id, authUser.email, opts?.supabaseUser),
                  PROFILE_HYDRATION_TIMEOUT_MS,
                  'profile_hydration_timeout',
                );
              } catch (loadErr) {
                const timedOut =
                  loadErr instanceof Error &&
                  (loadErr.message === 'profile_hydration_timeout' || loadErr.name === 'TimeoutError');
                if (timedOut) {
                  console.warn('Profile hydration timed out; using session-metadata fallback');
                } else {
                  console.error('Profile load failed; using session-metadata fallback', loadErr);
                }
                const sessionUser = await getSessionUserSnapshotForFallback();
                userData = buildAppUserFromAuthSessionFallback(
                  authUser.id,
                  authUser.email,
                  sessionUser,
                );
              }

              if (cancelled || currentAuthUserRef.current !== authUser.id) {
                console.log('⚠️ Discarding stale profile load (auth state changed)');
                return;
              }

              profileLoadedForUserRef.current = authUser.id;
              setUser(userData);
              console.log(`👤 User loaded with role: ${userData.role}`);
            } catch (error) {
              console.error('❌ Critical auth initialization error:', error);
              profileLoadedForUserRef.current = null;
              setUser(null);
            } finally {
              profileHydrateInFlightRef.current.delete(authUser.id);
            }
          })();
          profileHydrateInFlightRef.current.set(authUser.id, hydrate);
        }

        await hydrate;
      } finally {
        finishLoading();
      }
    };

    const subscription = onAuthStateChange(async (authUser, { event, supabaseUser }) => {
      console.log('🔐 Auth pipeline event:', event);
      await resolveAuthSession(authUser, supabaseUser ? { supabaseUser } : undefined);
    });

    return () => {
      cancelled = true;
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
        profileLoadedForUserRef.current = null;
        profileHydrateInFlightRef.current.clear();
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
        profileLoadedForUserRef.current = null;
        profileHydrateInFlightRef.current.clear();
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
      profileLoadedForUserRef.current = null;
      profileHydrateInFlightRef.current.clear();

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
  isLoading: false,
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