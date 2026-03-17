/**
 * Inactivity Manager
 * 
 * Handles two key features:
 * 1. Cross-tab navigation on logout
 * 2. Auto-logout after 10 minutes of inactivity (client users only)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { onLogoutBroadcast, onNavigateBroadcast } from '../../utils/auth/sessionSync';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Clock } from 'lucide-react';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_TIME = 9 * 60 * 1000; // 9 minutes - show warning
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds

// Events that count as user activity
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
];

export function InactivityManager() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const lastActivityRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Handle cross-tab logout navigation
  useEffect(() => {
    const unsubscribe = onLogoutBroadcast(() => {
      console.log('🔀 Navigating to homepage due to logout in another tab');
      // Navigate to homepage
      navigate('/', { replace: true });
    });

    return () => unsubscribe();
  }, [navigate]);

  // Handle cross-tab navigation events
  useEffect(() => {
    const unsubscribe = onNavigateBroadcast(() => {
      console.log('🔀 Navigation broadcast received');
      // Could be used for future navigation sync features
    });

    return () => unsubscribe();
  }, []);

  // Update activity timestamp on user interaction
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning is showing and user interacts, hide it
    if (showWarning) {
      setShowWarning(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [showWarning]);

  // Inactivity auto-logout (client users only)
  useEffect(() => {
    // Only apply to authenticated client users
    if (!isAuthenticated || !user || user.role !== 'client') {
      return;
    }

    console.log('⏰ Inactivity manager started for client user (Timestamp approach)');
    lastActivityRef.current = Date.now();

    // Add event listeners for activity
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const performLogout = async () => {
      console.log('⏰ Auto-logout due to inactivity');
      setShowWarning(false);
      
      try {
        await logout();
      } catch (error) {
        console.error('Failed to logout on backend, forcing local redirect:', error);
      } finally {
        navigate('/', { replace: true });
      }
    };

    // Periodic check for inactivity (immune to computer sleep)
    checkIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;

      if (inactiveTime >= INACTIVITY_TIMEOUT) {
        // User has been inactive for the full timeout (even if computer slept)
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        performLogout();
      } else if (inactiveTime >= WARNING_TIME) {
        // Show warning if we are in the warning window and it's not already showing
        setShowWarning(prevShowing => {
          if (!prevShowing) {
            console.log('⚠️ Showing inactivity warning');
            const secondsLeft = Math.max(1, Math.floor((INACTIVITY_TIMEOUT - inactiveTime) / 1000));
            setCountdown(secondsLeft);

            // Start precise visual countdown
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = window.setInterval(() => {
              setCountdown(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
              });
            }, 1000);
            
            return true;
          }
          return prevShowing;
        });
      }
    }, CHECK_INTERVAL);

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isAuthenticated, user, logout, navigate, handleActivity]);

  // Handle extend session
  const handleExtendSession = () => {
    console.log('✅ Session extended by user');
    handleActivity();
  };

  // Don't render anything if not showing warning
  if (!showWarning) {
    return null;
  }

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Session Timeout Warning</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            You've been inactive for a while. For your security, you will be automatically logged out in:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock className="h-10 w-10 text-purple-600 absolute animate-pulse" />
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-4xl font-bold text-purple-600">
              {countdown}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              seconds remaining
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={handleExtendSession}
            className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto px-8"
            size="lg"
          >
            Continue Session
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-muted-foreground mt-2">
          Click "Continue Session" to stay logged in, or you'll be automatically logged out when the timer reaches zero.
        </p>
      </DialogContent>
    </Dialog>
  );
}
