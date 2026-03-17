import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { TopBar } from './TopBar';
import { Navigation } from './Navigation';
import { DashboardNavigation } from './DashboardNavigation';
import { ResumeApplicationBanner } from './ResumeApplicationBanner';
import { Footer } from './Footer';
import { DashboardFooter } from './DashboardFooter';
import { AccountSuspendedPage } from '../pages/AccountSuspendedPage';
import { ErrorBoundary } from '../shared/ErrorBoundary';

interface MainLayoutProps {
  children: React.ReactNode;
  showNavAndFooter?: boolean;
  /**
   * When true, always render the public website layout (public nav, TopBar,
   * public footer) regardless of auth state. This prevents the dashboard
   * navigation from appearing on public website pages when a user happens
   * to be logged in from another tab.
   */
  forcePublicLayout?: boolean;
}

export function MainLayout({ children, showNavAndFooter = true, forcePublicLayout = false }: MainLayoutProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  // When forcePublicLayout is on, treat as unauthenticated for layout decisions
  const effectivelyAuthenticated = forcePublicLayout ? false : isAuthenticated;
  // Use accountStatus (primary) with applicationStatus fallback for backward compat
  const userStatus = user?.accountStatus || user?.applicationStatus;
  const isDashboardPage = effectivelyAuthenticated && userStatus === 'approved';
  const isApplicationInProgress = effectivelyAuthenticated && userStatus === 'application_in_progress';
  const isPendingReview = effectivelyAuthenticated && userStatus === 'submitted_for_review';
  const isDeclined = effectivelyAuthenticated && userStatus === 'declined';
  const isAccountTypeSelection = window.location.pathname === '/account-type';
  const isAdminDashboard = window.location.pathname === '/admin';
  const isApplicationPage = window.location.pathname.startsWith('/application');

  // Focused experience: hide footer for application-in-progress, pending review, and declined
  const isFocusedExperience = isApplicationInProgress || isPendingReview || isDeclined;
  
  // Display suspension page if user is suspended (informational only)
  // This check uses real auth state — suspension should always be enforced
  if (isAuthenticated && !forcePublicLayout && user?.suspended) {
    return (
      <AccountSuspendedPage 
        reason={user.suspendedReason}
        suspendedAt={user.suspendedAt}
        onLogout={logout}
      />
    );
  }

  // Scroll detection with debouncing to prevent flickering
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          // Hysteresis: hide at >60, only re-show at <20
          // Prevents flicker when TopBar removal shifts scroll position
          setIsScrolled((prev) => {
            if (prev && scrollTop < 20) return false;
            if (!prev && scrollTop > 60) return true;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  if (!showNavAndFooter) {
    return (
      <div className="min-h-screen bg-white">
        <main id="main-content">
          <ErrorBoundary inline fallbackTitle="Page Error">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* TopBar - only show for logged out users (or forcePublicLayout), smoothly collapses on scroll */}
      {!effectivelyAuthenticated && (
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isScrolled ? 'max-h-0 opacity-0' : 'max-h-12 opacity-100'
          }`}
        >
          <TopBar />
        </div>
      )}
      
      {/* Navigation - sticky positioned */}
      <div className={`sticky top-0 z-50 ${isScrolled ? 'shadow-lg' : ''}`}>
        <Navigation forcePublic={forcePublicLayout} />
      </div>
      
      {isDashboardPage && !isAdminDashboard && <DashboardNavigation />}
      {isApplicationInProgress && !isApplicationPage && <ResumeApplicationBanner />}
      <main id="main-content" className="flex-1">
        <ErrorBoundary inline fallbackTitle="Page Error">
          {children}
        </ErrorBoundary>
      </main>
      {(!isFocusedExperience || isAccountTypeSelection) && !isAdminDashboard && (
        effectivelyAuthenticated ? <DashboardFooter /> : <Footer />
      )}
    </div>
  );
}