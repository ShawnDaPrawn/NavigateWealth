import {
  BarChart3,
  Calendar,
  FilePlus2,
  ClipboardPlus,
  Mail,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { DsCard, DsCardBody, DsCardHead } from '../../../layout/page';
import type { QuickActionsCardProps, QuickAction } from '../types';

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'new-client', label: 'New client', icon: UserPlus, module: 'clients' },
  { id: 'new-application', label: 'New application', icon: ClipboardPlus, module: 'applications' },
  { id: 'new-advice', label: 'New advice record', icon: FilePlus2, module: 'advice-engine' },
  { id: 'compliance', label: 'Compliance check', icon: ShieldCheck, module: 'compliance' },
  { id: 'search-client', label: 'Find client', icon: Search, module: 'clients' },
  { id: 'messages', label: 'Messages', icon: Mail, module: 'communication' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, module: 'calendar' },
  { id: 'reports', label: 'Reports', icon: BarChart3, module: 'reporting' },
];

/** Quick actions (DB-Main board): eight shortcuts in two columns, all alike. */
export function QuickActionsCard({ onModuleChange, customActions }: QuickActionsCardProps) {
  const actions = customActions || DEFAULT_ACTIONS;

  const handleAction = (action: QuickAction) => {
    if (action.onClick) action.onClick();
    else if (action.module && onModuleChange) onModuleChange(action.module);
  };

  return (
    <DsCard aria-label="Quick actions" className="flex-[1_1_380px]">
      <DsCardHead title="Quick actions" />
      <DsCardBody className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              className="ds-qa"
              onClick={() => handleAction(action)}
            >
              <Icon aria-hidden="true" />
              <span className="min-w-0">{action.label}</span>
              {action.badgeCount ? (
                <span className="ds-count ml-auto">{action.badgeCount}</span>
              ) : null}
            </button>
          );
        })}
      </DsCardBody>
    </DsCard>
  );
}
