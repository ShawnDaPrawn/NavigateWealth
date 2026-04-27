import type { LucideIcon } from 'lucide-react';

export type AdminModule = 
  | 'dashboard' 
  | 'clients' 
  | 'personnel' 
  | 'advice-engine' 
  | 'product-management'
  | 'resources'
  | 'publications'
  | 'compliance' 
  | 'tasks' 
  | 'notes'
  | 'applications' 
  | 'quotes' 
  | 'submissions'
  | 'communication' 
  | 'marketing' 
  | 'reporting' 
  | 'calendar'
  | 'esign'
  | 'issues'
  | 'ai-management';

export interface ModuleConfigItem {
  label: string;
  icon: LucideIcon;
}

export interface ModuleGroup {
  label: string;
  modules: AdminModule[];
}

export interface PendingCounts {
  [key: string]: {
    count: number;
    [key: string]: unknown;
  };
}
