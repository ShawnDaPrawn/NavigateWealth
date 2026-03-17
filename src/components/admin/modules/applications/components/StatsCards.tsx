/**
 * Stats Cards — Application Module
 *
 * Navigational stat cards that double as tab selectors.
 * Follows §8.3 stat card standards: white background, semantic icon
 * container, large bold number, small muted description.
 */

import React from 'react';
import { Clock, CheckCircle2, XCircle, FileText, Send } from 'lucide-react';
import { ApplicationStats, TabStatus } from '../types';

interface StatsCardsProps {
  stats: ApplicationStats | null;
  activeTab: TabStatus;
  setActiveTab: (tab: TabStatus) => void;
}

const TAB_CARDS: {
  label: string;
  tab: TabStatus;
  icon: React.ElementType;
  subtitle: string;
  statKey: keyof ApplicationStats;
  activeIconBg: string;
  activeIconColor: string;
}[] = [
  {
    label: 'Pending Review',
    tab: 'pending',
    icon: Clock,
    subtitle: 'Awaiting decision',
    statKey: 'submitted_for_review',
    activeIconBg: 'bg-amber-100',
    activeIconColor: 'text-amber-600',
  },
  {
    label: 'Invited',
    tab: 'invited',
    icon: Send,
    subtitle: 'Invitation sent',
    statKey: 'invited',
    activeIconBg: 'bg-purple-100',
    activeIconColor: 'text-purple-600',
  },
  {
    label: 'Approved',
    tab: 'approved',
    icon: CheckCircle2,
    subtitle: 'Access granted',
    statKey: 'approved',
    activeIconBg: 'bg-emerald-100',
    activeIconColor: 'text-emerald-600',
  },
  {
    label: 'Rejected',
    tab: 'rejected',
    icon: XCircle,
    subtitle: 'Not approved',
    statKey: 'declined',
    activeIconBg: 'bg-red-100',
    activeIconColor: 'text-red-600',
  },
];

export function StatsCards({ stats, activeTab, setActiveTab }: StatsCardsProps) {
  const total = stats?.total || 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {TAB_CARDS.map((card) => {
        const isActive = activeTab === card.tab;
        const count = (stats?.[card.statKey] as number) || 0;
        const Icon = card.icon;

        return (
          <button
            key={card.tab}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(card.tab)}
            className={`
              bg-white p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]/40 focus-visible:ring-offset-2
              ${isActive
                ? 'border-[#6d28d9]/30 shadow-sm ring-1 ring-[#6d28d9]/20'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${isActive ? card.activeIconBg : 'bg-gray-50'}`}>
                <Icon className={`h-4 w-4 ${isActive ? card.activeIconColor : 'text-gray-400'}`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{count}</div>
            <div className="text-xs text-muted-foreground mt-1">{card.subtitle}</div>
          </button>
        );
      })}

      {/* Total — non-clickable summary card */}
      <div className="bg-white p-5 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">Total</span>
          <div className="p-2 bg-gray-50 rounded-lg">
            <FileText className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-900">{total}</div>
        <div className="text-xs text-muted-foreground mt-1">All applications</div>
      </div>
    </div>
  );
}
