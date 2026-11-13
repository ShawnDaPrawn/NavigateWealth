import {
  Home,
  Users,
  UserCheck,
  FileText,
  Package,
  FolderOpen,
  Shield,
  CheckSquare,
  ClipboardList,
  Mail,
  Share2,
  BarChart3,
  Calendar,
  BookOpen,
  PenTool,
  Inbox,
  StickyNote,
  Bot,
  ShieldAlert,
  Lock,
  Newspaper,
} from 'lucide-react';
import { AdminModule, ModuleConfigItem, ModuleGroup } from './types';

export const moduleConfig: Record<AdminModule, ModuleConfigItem> = {
  dashboard: { label: 'Dashboard', icon: Home },
  clients: { label: 'Client Management', icon: Users },
  esign: { label: 'E-Signature', icon: PenTool },
  personnel: { label: 'Personnel', icon: UserCheck },
  'advice-engine': { label: 'Advice Engine', icon: FileText },
  'product-management': { label: 'Product Management', icon: Package },
  resources: { label: 'Resources', icon: FolderOpen },
  publications: { label: 'Publications', icon: BookOpen },
  compliance: { label: 'Compliance', icon: Shield },
  tasks: { label: 'To-Do', icon: CheckSquare },
  notes: { label: 'Notes', icon: StickyNote },
  applications: { label: 'Applications', icon: ClipboardList },
  submissions: { label: 'Submissions', icon: Inbox },
  communication: { label: 'Communication', icon: Mail },
  newsletter: { label: 'Newsletters', icon: Newspaper },
  marketing: { label: 'Social & Marketing', icon: Share2 },
  reporting: { label: 'Reporting', icon: BarChart3 },
  calendar: { label: 'Calendar & Reminders', icon: Calendar },
  issues: { label: 'Issue Manager', icon: ShieldAlert },
  'ai-management': { label: 'AI Management', icon: Bot },
  locked: { label: 'Locked', icon: Lock },
};

/**
 * Every admin module, grouped as the sidebar shows them (design system,
 * "Shell and navigation"). The permission screens in Personnel use the same
 * groups, so every module must appear exactly once.
 */
export const moduleGroups: ModuleGroup[] = [
  {
    label: 'Overview',
    modules: ['dashboard'],
  },
  {
    label: 'Work',
    modules: ['tasks', 'applications', 'submissions', 'calendar', 'notes'],
  },
  {
    label: 'Clients',
    modules: ['clients', 'communication', 'esign'],
  },
  {
    label: 'Advice',
    modules: ['advice-engine', 'product-management', 'resources'],
  },
  {
    label: 'Marketing',
    modules: ['publications', 'newsletter', 'marketing'],
  },
  {
    label: 'Practice',
    modules: ['personnel', 'compliance', 'reporting', 'issues', 'ai-management', 'locked'],
  },
];

/** Shown above the groups, without a group heading. */
export const sidebarHomeModules: AdminModule[] = ['dashboard'];

/** Shown in the sidebar footer, above the account menu, instead of in their group. */
export const sidebarFooterModules: AdminModule[] = ['locked'];

/** The groups the sidebar lists under collapsible headings, minus home and footer items. */
export const sidebarGroups: ModuleGroup[] = moduleGroups
  .map((group) => ({
    label: group.label,
    modules: group.modules.filter(
      (m) => !sidebarHomeModules.includes(m) && !sidebarFooterModules.includes(m),
    ),
  }))
  .filter((group) => group.modules.length > 0);

/** The sidebar group a module sits in, for the breadcrumb. Home and footer items have none. */
export const sidebarGroupOf = (module: AdminModule): string | null =>
  sidebarGroups.find((group) => group.modules.includes(module))?.label ?? null;

// Modules that display numeric sidebar counters.
export const operationsModules: AdminModule[] = [
  'applications',
  'submissions',
  'tasks',
  'notes',
  'calendar',
  'issues',
];

// Modules whose counter is a backlog (open items), not new arrivals: shown
// grey, never amber (design system: sidebar counts).
export const backlogCounterModules: AdminModule[] = ['tasks'];

// Modules whose counters are status indicators and should remain visible at zero.
export const alwaysShowCounterModules: AdminModule[] = ['issues'];

/** Cap the compact (collapsed-rail) badge so it never overflows its pill. */
export const formatSidebarBadgeCount = (count: number): string =>
  count > 99 ? '99+' : String(Math.max(0, count));

/** Human-readable pending summary used by tooltips and accessible labels. */
export const formatPendingSummary = (count: number): string =>
  count <= 0 ? 'nothing pending' : `${count.toLocaleString()} pending`;

/** "super_admin" → "Super admin". */
export function formatRole(role: string | undefined): string {
  if (!role) return 'Administrator';
  const words = role.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
