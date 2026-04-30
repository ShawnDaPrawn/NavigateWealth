/**
 * Client Dashboard Home Page
 *
 * Premium branded dashboard that mirrors the website's design language
 * while providing a functional financial overview.
 *
 * Uses the portal theme system for easy rollback to the classic style.
 *
 * Guidelines refs: §3.1 (dependency direction), §7 (presentation layer),
 * §8.3 (UI standards), §8.4 (AI builder guidelines)
 */

import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Link } from 'react-router';
import {
  Package,
  Bot,
  FileText,
  User,
  MessageSquare,
  Loader2,
  ArrowRight,
  Shield,
  PiggyBank,
  Heart,
  Briefcase,
  Activity,
  Bell,
  Calendar,
  Settings,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ClientOverviewTab } from '../admin/modules/client-management/components/ClientOverviewTab';
import type { Client } from '../admin/modules/client-management/types';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME, QUICK_LINK_STYLES } from '../portal/portal-theme';
import { TwoFactorPromptModal } from '../portal/TwoFactorPromptModal';

// ── Time-based Greeting ─────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Quick Links ─────────────────────────────────────────────────────────────

interface QuickLink {
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  /** For branded theme: glassmorphism-friendly icon bg */
  brandedIconBg: string;
  brandedIconColor: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Products & Services',
    description: 'View your financial products',
    path: '/products-services-dashboard',
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    brandedIconBg: 'bg-purple-500/20',
    brandedIconColor: 'text-purple-300',
  },
  {
    label: 'Ask Vasco',
    description: 'Get personalised guidance',
    path: '/ai-advisor',
    icon: Bot,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    brandedIconBg: 'bg-blue-500/20',
    brandedIconColor: 'text-blue-300',
  },
  {
    label: 'My Profile',
    description: 'Update your personal info',
    path: '/profile',
    icon: User,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    brandedIconBg: 'bg-amber-500/20',
    brandedIconColor: 'text-amber-300',
  },
  {
    label: 'Documents',
    description: 'View your documents',
    path: '/transactions-documents',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    brandedIconBg: 'bg-indigo-500/20',
    brandedIconColor: 'text-indigo-300',
  },
  {
    label: 'Communication',
    description: 'Messages & notifications',
    path: '/communication',
    icon: MessageSquare,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    brandedIconBg: 'bg-rose-500/20',
    brandedIconColor: 'text-rose-300',
  },
];

// ── Quick Link Card ─────────────────────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  const styles = QUICK_LINK_STYLES[ACTIVE_THEME];
  const isBranded = ACTIVE_THEME === 'branded';

  return (
    <Link to={link.path} className="group block">
      <div className={styles.card}>
        <div className={`p-4 flex items-center gap-3`}>
          <div
            className={`${styles.iconWrap} ${
              isBranded ? link.brandedIconBg : link.bgColor
            }`}
          >
            <link.icon
              className={`h-5 w-5 ${
                isBranded ? link.brandedIconColor : link.color
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className={styles.label}>{link.label}</p>
            <p className={styles.description}>{link.description}</p>
          </div>
          {isBranded && (
            <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 ml-auto flex-shrink-0 transition-colors" />
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Stat Pill (branded theme only) ──────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm rounded-lg border border-white/[0.08] px-4 py-3">
      <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4.5 w-4.5 text-purple-300" />
      </div>
      <div>
        <p className="text-xs text-white/40 font-medium">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function HomeDashboardPage() {
  const { user } = useAuth();
  const isBranded = ACTIVE_THEME === 'branded';

  const clientForOverview = useMemo<Client | null>(() => {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: undefined,
      idNumber: undefined,
      accountStatus: user.accountStatus || 'approved',
      preferredName: user.firstName || '',
      createdAt: new Date().toISOString(),
      applicationStatus: user.applicationStatus || 'approved',
      accountType: user.accountType || 'personal',
      deleted: false,
      suspended: user.suspended || false,
    };
  }, [user]);

  if (!user || !clientForOverview) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        role="status"
        aria-label="Loading dashboard"
      >
        <Loader2
          className="h-8 w-8 animate-spin text-purple-600"
          aria-hidden="true"
        />
        <span className="sr-only">Loading dashboard, please wait...</span>
      </div>
    );
  }

  const greeting = getGreeting();
  const firstName = user.firstName || 'there';

  return (
    <div className={`min-h-screen ${isBranded ? 'bg-[#f8f9fb]' : 'bg-gray-50'}`}>
      {/* ── 2FA Prompt (shown once per login if 2FA is not enabled) ── */}
      <TwoFactorPromptModal />

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <PortalPageHeader
        greeting={`${greeting}, ${firstName}`}
        title="Your Financial Dashboard"
        subtitle="Track your wealth, manage your products, and stay connected with your adviser."
        icon={Activity}
      >
        {/* Quick Links inside hero for branded theme */}
        {isBranded && (
          <div className="mt-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {QUICK_LINKS.map((link) => (
                <QuickLinkCard key={link.path} link={link} />
              ))}
            </div>
          </div>
        )}
      </PortalPageHeader>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Quick Links (classic theme: below header) ─────────────── */}
        {!isBranded && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quick Access
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {QUICK_LINKS.map((link) => (
                <QuickLinkCard key={link.path} link={link} />
              ))}
            </div>
          </div>
        )}

        {/* ── Client Overview (from admin panel, client mode) ─────── */}
        <div>
          <ClientOverviewTab client={clientForOverview} mode="client" />
        </div>
      </div>
    </div>
  );
}

export default HomeDashboardPage;
