/**
 * POLICY DETAILS SECTION - WITH SUBTABS
 * Comprehensive policy management with 8 financial planning categories
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Shield,
  Heart,
  PiggyBank,
  Briefcase,
  FileText,
  Landmark,
  Target,
  Plus,
  Eye,
  Edit,
  Archive,
  Download,
  Zap,
  TrendingUp,
  DollarSign,
  Activity,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  BarChart3,
  LineChart,
  Loader2,
  Trash2
} from 'lucide-react';
import { PolicyFormDialog } from './PolicyFormDialog';
import { PolicyCategoryTab } from './PolicyCategoryTab';
import { PolicyOverviewTab, CategoryOverviewData } from './PolicyOverviewTab';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

// Map subtab IDs to category names
const CATEGORY_NAMES: Record<string, string> = {
  'risk-planning': 'Risk Planning',
  'medical-aid': 'Medical Aid',
  'retirement': 'Retirement Planning',
  'investments': 'Investments',
  'employee-benefits': 'Employee Benefits',
  'tax-planning': 'Tax Planning',
  'estate-planning': 'Estate Planning',
};

interface PolicyDetailsSectionProps {
  selectedClient: { id: string; firstName?: string; lastName?: string; [key: string]: unknown };
}

export function PolicyDetailsSection({ selectedClient }: PolicyDetailsSectionProps) {
  const [activePolicyTab, setActivePolicyTab] = useState('overview');

  // Derive the actual client display name
  const clientDisplayName = [selectedClient?.firstName, selectedClient?.lastName]
    .filter(Boolean)
    .join(' ') || 'Client';

  // Subtab configuration
  const policySubtabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'risk-planning', label: 'Risk Planning', icon: Shield },
    { id: 'medical-aid', label: 'Medical Aid', icon: Heart },
    { id: 'retirement', label: 'Retirement Planning', icon: PiggyBank },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'employee-benefits', label: 'Employee Benefits', icon: Briefcase },
    { id: 'tax-planning', label: 'Tax Planning', icon: FileText },
    { id: 'estate-planning', label: 'Estate Planning', icon: Landmark },
  ];

  return (
    <div className="space-y-6">
      {/* SUBTABS - Level 2: Secondary Navigation within Policy Details tab
          Uses white background with purple borders for active state
          See: /components/admin/TAB_DESIGN_STANDARDS.md */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {policySubtabs.map((subtab) => {
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => setActivePolicyTab(subtab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activePolicyTab === subtab.id
                    ? 'bg-white text-[#6d28d9] border-2 border-[#6d28d9] shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{subtab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab Content */}
      {activePolicyTab === 'overview' && (
        <PolicyOverviewTab 
          clientId={selectedClient?.id || 'client_1'}
          onRunFNA={(categoryId) => setActivePolicyTab(categoryId)}
          onAddPolicy={(categoryId) => setActivePolicyTab(categoryId)}
          onViewDetails={(categoryId) => setActivePolicyTab(categoryId)}
        />
      )}

      {/* Risk Planning Tab Content */}
      {activePolicyTab === 'risk-planning' && (
        <PolicyCategoryTab
          categorySubtabId="risk-planning"
          categoryName="Risk Planning"
          icon={Shield}
          iconColor="text-[#6d28d9]"
          description="Life insurance, disability cover, and income protection"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Medical Aid Tab Content */}
      {activePolicyTab === 'medical-aid' && (
        <PolicyCategoryTab
          categorySubtabId="medical-aid"
          categoryName="Medical Aid"
          icon={Heart}
          iconColor="text-red-500"
          description="Healthcare coverage and medical scheme memberships"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Retirement Planning Tab Content */}
      {activePolicyTab === 'retirement' && (
        <PolicyCategoryTab
          categorySubtabId="retirement"
          categoryName="Retirement Planning"
          icon={PiggyBank}
          iconColor="text-green-600"
          description="Pension funds, retirement annuities, and preservation funds"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Investments Tab Content */}
      {activePolicyTab === 'investments' && (
        <PolicyCategoryTab
          categorySubtabId="investments"
          categoryName="Investments"
          icon={TrendingUp}
          iconColor="text-[#6d28d9]"
          description="Unit trusts, tax-free savings, and offshore investments"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Employee Benefits Tab Content */}
      {activePolicyTab === 'employee-benefits' && (
        <PolicyCategoryTab
          categorySubtabId="employee-benefits"
          categoryName="Employee Benefits"
          icon={Briefcase}
          iconColor="text-blue-600"
          description="Employer-sponsored benefits and group schemes"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Tax Planning Tab Content */}
      {activePolicyTab === 'tax-planning' && (
        <PolicyCategoryTab
          categorySubtabId="tax-planning"
          categoryName="Tax Planning"
          icon={FileText}
          iconColor="text-[#6d28d9]"
          description="Tax-efficient investment strategies and planning"
          clientId={selectedClient?.id || 'client_1'}
        />
      )}

      {/* Estate Planning Tab Content */}
      {activePolicyTab === 'estate-planning' && (
        <PolicyCategoryTab
          categorySubtabId="estate-planning"
          categoryName="Estate Planning"
          icon={Landmark}
          iconColor="text-[#6d28d9]"
          description="Wills, trusts, and estate management"
          clientId={selectedClient?.id || 'client_1'}
          clientDisplayName={clientDisplayName}
        />
      )}
    </div>
  );
}