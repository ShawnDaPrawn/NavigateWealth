/**
 * Pending Dashboard Page — Application Under Review
 *
 * Single-screen experience shown after a client submits their application.
 * Remains visible until admin approves the application, at which point
 * the client is automatically redirected to their full dashboard.
 *
 * Design:
 *   - Dark branded hero matching the website/application design language
 *   - Animated status indicator
 *   - Clean timeline with purple accents
 *   - Professional, reassuring tone appropriate to a wealth management platform
 *   - Fills viewport — no scrolling needed (single screen)
 *
 * Auto-polls for status changes every 15 seconds.
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards),
 * §8.4 (AI builder — use react-router not react-router-dom)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../ui/badge';
import {
  Clock,
  CheckCircle2,
  User,
  LogOut,
  Shield,
  Award,
  TrendingUp,
  Mail,
  Phone,
  Sparkles,
} from 'lucide-react';

const TRUST_POINTS = [
  { icon: Shield, label: 'FSP 54606 Regulated' },
  { icon: Award, label: 'POPIA Compliant' },
  { icon: TrendingUp, label: 'Independent Advice' },
];

const TIMELINE_STEPS = [
  {
    status: 'complete' as const,
    icon: CheckCircle2,
    title: 'Application Submitted',
    description: 'Your application has been successfully received by our team.',
  },
  {
    status: 'active' as const,
    icon: Clock,
    title: 'Under Review',
    description: 'Our compliance team is verifying your information. This typically takes 1–2 business days.',
  },
  {
    status: 'pending' as const,
    icon: User,
    title: 'Dashboard Access',
    description: 'Upon approval, your full personalised dashboard and financial tools will be activated.',
  },
];

export function PendingDashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const intervalRef = useRef<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkApprovalStatus = useCallback(async () => {
    try {
      await refreshUser();
      setLastChecked(new Date());

      if (user?.accountStatus === 'approved') {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Status check failed:', err);
    }
  }, [user?.accountStatus, refreshUser, navigate]);

  // Poll for approval status every 15 seconds
  useEffect(() => {
    checkApprovalStatus();
    intervalRef.current = window.setInterval(checkApprovalStatus, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkApprovalStatus]);

  const handleLogout = async () => {
    try {
      // Stop polling BEFORE logout to prevent in-flight refreshUser calls
      // from racing with the logout and re-setting the user
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      await logout();
      // Belt-and-suspenders: explicitly navigate to login in case
      // the route guard redirect doesn't fire immediately
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Failed to logout:', error);
      // Even if logout throws, still try to navigate away
      navigate('/login', { replace: true });
    }
  };

  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* ── Dark Branded Hero ───────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#1a1e36] flex-shrink-0">
        {/* Background accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/6 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 lg:py-14 text-center">
          {/* Animated pulse ring */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-20 h-20 rounded-2xl bg-purple-500/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="relative w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <Clock className="h-8 w-8 text-purple-300" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Thank you, {firstName}
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Your application is being reviewed by our team. We'll notify you as soon as a decision has been made.
          </p>

          <div className="mt-5">
            <Badge className="bg-amber-500/15 text-amber-300 border border-amber-400/20 hover:bg-amber-500/15 text-xs px-3 py-1">
              <Clock className="h-3 w-3 mr-1.5" />
              Pending Review
            </Badge>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-5 mt-8 pt-5 border-t border-white/5">
            {TRUST_POINTS.map((point) => (
              <div key={point.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <point.icon className="h-3 w-3 text-purple-400/70" />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content — single screen, no scroll ─────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-8 lg:py-10">
        <div className="w-full max-w-2xl space-y-5">

          {/* ── Status Timeline ────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600" />
            <div className="p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                Application Progress
              </h2>

              <div className="space-y-0">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isLast = idx === TIMELINE_STEPS.length - 1;
                  const Icon = step.icon;

                  return (
                    <div key={step.title} className="flex items-start gap-4 relative">
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className={`absolute left-[19px] top-10 bottom-0 w-px ${
                            step.status === 'complete' ? 'bg-green-200' : 'bg-gray-200'
                          }`}
                        />
                      )}

                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                          step.status === 'complete'
                            ? 'bg-green-100'
                            : step.status === 'active'
                            ? 'bg-purple-100'
                            : 'bg-gray-100'
                        } ${step.status === 'active' ? 'ring-4 ring-purple-100' : ''}`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            step.status === 'complete'
                              ? 'text-green-600'
                              : step.status === 'active'
                              ? 'text-purple-600'
                              : 'text-gray-400'
                          } ${step.status === 'active' ? 'animate-pulse' : ''}`}
                        />
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-6 ${step.status === 'pending' ? 'opacity-40' : ''}`}>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{step.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Info & Contact Row ─────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* What to expect */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">What to Expect</h3>
              </div>
              <ul className="space-y-2">
                {[
                  'Review takes 1–2 business days',
                  'Email confirmation once reviewed',
                  'Full dashboard access on approval',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="bg-gradient-to-br from-purple-50/80 to-white rounded-2xl border border-purple-100 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Need Assistance?</h3>
              </div>
              <div className="space-y-2.5">
                <a
                  href="mailto:info@navigatewealth.co"
                  className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-purple-700 transition-colors group"
                >
                  <Mail className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-500" />
                  <span>info@navigatewealth.co</span>
                </a>
                <a
                  href="tel:+27126672505"
                  className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-purple-700 transition-colors group"
                >
                  <Phone className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-500" />
                  <span>+27 12 667 2505</span>
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-3">Mon – Fri, 9:00 AM – 5:00 PM SAST</p>
            </div>
          </div>

          {/* ── Footer Bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              Status updates sent to <span className="font-medium text-gray-500">{user?.email || '—'}</span>
            </p>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PendingDashboardPage;
