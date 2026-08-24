/**
 * Client Dashboard Home Page
 *
 * Premium branded dashboard that mirrors the website's design language
 * while providing a functional financial overview.
 *
 * Guidelines refs: §3.1 (dependency direction), §7 (presentation layer),
 * §8.3 (UI standards), §8.4 (AI builder guidelines)
 */

import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { BrandPageLoader } from '../ui/brand-loader';
import { Link } from 'react-router';
import { Package, Bot, FileText, User, MessageSquare, Activity, ChevronRight } from 'lucide-react';
import { ClientOverviewTab } from '../admin/modules/client-management';
import type { Client } from '../admin/modules/client-management';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { QUICK_LINK_STYLES } from '../portal/portal-theme';
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
  brandedIconBg: string;
  brandedIconColor: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Products & Services',
    description: 'View your financial products',
    path: '/products-services-dashboard',
    icon: Package,
    brandedIconBg: 'bg-purple-500/20',
    brandedIconColor: 'text-purple-300',
  },
  {
    label: 'Ask Vasco',
    description: 'Get personalised guidance',
    path: '/ai-advisor',
    icon: Bot,
    brandedIconBg: 'bg-blue-500/20',
    brandedIconColor: 'text-blue-300',
  },
  {
    label: 'My Profile',
    description: 'Update your personal info',
    path: '/profile',
    icon: User,
    brandedIconBg: 'bg-amber-500/20',
    brandedIconColor: 'text-amber-300',
  },
  {
    label: 'Documents',
    description: 'View your documents',
    path: '/transactions-documents',
    icon: FileText,
    brandedIconBg: 'bg-indigo-500/20',
    brandedIconColor: 'text-indigo-300',
  },
  {
    label: 'Communication',
    description: 'Messages & notifications',
    path: '/communication',
    icon: MessageSquare,
    brandedIconBg: 'bg-rose-500/20',
    brandedIconColor: 'text-rose-300',
  },
];

// ── Quick Link Card ─────────────────────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  const styles = QUICK_LINK_STYLES;

  return (
    <Link to={link.path} className="group block">
      <div className={styles.card}>
        <div className={`p-4 flex items-center gap-3`}>
          <div className={`${styles.iconWrap} ${link.brandedIconBg}`}>
            <link.icon className={`h-5 w-5 ${link.brandedIconColor}`} />
          </div>
          <div className="min-w-0">
            <p className={styles.label}>{link.label}</p>
            <p className={styles.description}>{link.description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 ml-auto flex-shrink-0 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function HomeDashboardPage() {
  const { user } = useAuth();

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
      <BrandPageLoader
        title="Loading your dashboard"
        message="Pulling together your latest Navigate Wealth overview."
      />
    );
  }

  const greeting = getGreeting();
  const firstName = user.firstName || 'there';

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ── 2FA Prompt (shown once per login if 2FA is not enabled) ── */}
      <TwoFactorPromptModal />

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <PortalPageHeader
        greeting={`${greeting}, ${firstName}`}
        title="Your Financial Dashboard"
        subtitle="Track your wealth, manage your products, and stay connected with your adviser."
        icon={Activity}
      >
        <div className="mt-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_LINKS.map((link) => (
              <QuickLinkCard key={link.path} link={link} />
            ))}
          </div>
        </div>
      </PortalPageHeader>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Client Overview (from admin panel, client mode) ─────── */}
        <div>
          <ClientOverviewTab client={clientForOverview} mode="client" />
        </div>
      </div>
    </div>
  );
}

export default HomeDashboardPage;
