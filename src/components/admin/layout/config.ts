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
  MessageSquare, 
  Mail, 
  Share2, 
  BarChart3, 
  Calendar,
  BookOpen,
  PenTool,
  Inbox,
  StickyNote,
  Bot,
  ShieldAlert
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
  quotes: { label: 'Requests', icon: MessageSquare },
  submissions: { label: 'Submissions', icon: Inbox },
  communication: { label: 'Communication', icon: Mail },
  marketing: { label: 'Social & Marketing', icon: Share2 },
  reporting: { label: 'Reporting', icon: BarChart3 },
  calendar: { label: 'Calendar & Reminders', icon: Calendar },
  issues: { label: 'Issue Manager', icon: ShieldAlert },
  'ai-management': { label: 'AI Management', icon: Bot }
};

export const moduleGroups: ModuleGroup[] = [
  {
    label: 'Overview',
    modules: ['dashboard']
  },
  {
    label: 'Operations',
    modules: ['applications', 'submissions', 'tasks', 'notes', 'calendar']
  },
  {
    label: 'Manage',
    modules: ['clients', 'esign', 'personnel', 'advice-engine', 'product-management', 'resources', 'publications', 'ai-management']
  },
  {
    label: 'Risk & Compliance',
    modules: ['compliance', 'reporting', 'issues']
  },
  {
    label: 'Growth',
    modules: ['communication', 'marketing']
  }
];

export const operationsModules: AdminModule[] = ['applications', 'submissions', 'tasks', 'notes', 'calendar'];
